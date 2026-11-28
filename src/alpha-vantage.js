import { cleanName } from './instrument-name.js';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { validateQuote } from './provider.js';
import { tickerCurrency, validCurrencies } from './tickers.js';

const DAY = 86400000;
const fail = () => new Error('Alpha Vantage unavailable or invalid data; no raw response logged.');
export class AlphaVantageProvider {
  constructor({ apiKey, currencies, stateDir, dailyLimit = 25, cacheMs = 6 * 3600000, fetchImpl = fetch, now = Date.now, resolveNames = false }) {
    if (typeof apiKey !== 'string' || !apiKey || typeof stateDir !== 'string' || !stateDir ||
        !validCurrencies(currencies, false) ||
        !Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 25 ||
        !Number.isFinite(cacheMs) || cacheMs < 3600000 || cacheMs > DAY) {
      throw Error('Set Alpha Vantage key, private persistent state directory and optional symbol currencies (default US/USD); limit 1..25.');
    }
    Object.assign(this, { apiKey, currencies: currencies === undefined ? undefined : { ...currencies }, stateDir: resolve(stateDir), dailyLimit, cacheMs, fetchImpl, now });
    this.resolveNames=resolveNames;
    this.queue = Promise.resolve();
  }
  lookup(symbol) {
    if (!tickerCurrency(this.currencies, symbol)) return Promise.resolve(null);
    const result = this.queue.then(() => this.lookupLocked(symbol));
    this.queue = result.catch(() => {});
    return result;
  }
  async lookupLocked(symbol) {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    const lockPath = join(this.stateDir, 'provider.lock');
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw Error('Provider state lock could not be created. Check directory permissions.');
      let age;
      try { age = Date.now() - (await stat(lockPath)).mtimeMs; }
      catch { throw Error('Provider state lock changed during inspection. Retry later.'); }
      if (age > 5 * 60000) throw Error('Provider state lock is more than 5 minutes old and may be stale. Stop all bot instances and inspect before removing it. No lock removed.');
      throw Error('Provider state is busy. One bot instance per state directory; inspect stale lock only when stopped.');
    }
    try {
      const path = join(this.stateDir, 'state.json');
      let state = { provider: 'alpha-vantage', calls: [], cache: {}, blockedUntil: 0 };
      try { state = JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw fail(); }
      if (state.provider !== 'alpha-vantage' || !Array.isArray(state.calls) || state.calls.some(t => !Number.isFinite(t)) ||
          !state.cache || typeof state.cache !== 'object' || !Number.isFinite(state.blockedUntil)) throw fail();
      const now = this.now();
      if (state.calls.some(t => t > now)) throw fail(); // Clock rollback must not reset quota.
      state.calls = state.calls.filter(t => now - t < DAY);
      const cached = Object.hasOwn(state.cache, symbol) ? state.cache[symbol] : null;
      if (cached && now >= cached.fetchedAt && now - cached.fetchedAt < this.cacheMs) {
        const quote = validateQuote(cached.quote);
        if (quote.symbol !== symbol || quote.currency !== tickerCurrency(this.currencies, symbol) || quote.fixture !== false || quote.priceKind !== 'daily-close') throw fail();
        return quote;
      }
      if (now < state.blockedUntil || state.calls.length >= this.dailyLimit) throw Error('Alpha Vantage local rolling-24h quota exhausted. No request sent.');
      const save = async () => {
        const temporary = path + '.tmp';
        await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
        await rename(temporary, path);
      };
      // Count before the request, including timeouts/errors and across restarts.
      state.calls.push(now);
      await save();
      const url = new URL('https://www.alphavantage.co/query');
      url.search = new URLSearchParams({ function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact', apikey: this.apiKey });
      let response, body;
      try {
        response = await this.fetchImpl(url, { signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (!response.ok) throw fail();
        body = await response.json();
      } catch { throw fail(); }
      if (body?.Note || body?.Information) {
        state.blockedUntil = now + DAY;
        await save();
        throw Error('Alpha Vantage reported a limit or entitlement notice. Paused for 24h; no automatic retries.');
      }
      if (body?.['Error Message']) throw fail();
      const meta = body?.['Meta Data'];
      const series = body?.['Time Series (Daily)'];
      if (meta?.['2. Symbol'] !== symbol || !series || typeof series !== 'object') throw fail();
      const history = Object.entries(series).map(([date, values]) => {
        const close = values?.['4. close'];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date ||
            typeof close !== 'string' || !/^\d+(?:\.\d+)?$/.test(close)) throw fail();
        return { date, close: Number(close) };
      }).sort((a, b) => a.date.localeCompare(b.date));
      const last = history.at(-1);
      if (!last || Date.parse(last.date) > now) throw fail();
      let name=symbol;
      if(this.resolveNames){
        state.names ??= {};
        if(!state.names||typeof state.names!=='object'||Array.isArray(state.names))throw fail();
        const cachedName=Object.hasOwn(state.names,symbol)&&state.names[symbol];
        if(cachedName&&Number.isFinite(cachedName.at)&&cachedName.at<=now&&now-cachedName.at<DAY&&typeof cachedName.name==='string')name=cachedName.name;
        else if(state.calls.length<this.dailyLimit&&now>=state.blockedUntil){
          state.calls.push(now);await save();
          try{
            const searchUrl=new URL('https://www.alphavantage.co/query');searchUrl.search=new URLSearchParams({function:'SYMBOL_SEARCH',keywords:symbol,apikey:this.apiKey});
            const response=await this.fetchImpl(searchUrl,{signal:AbortSignal.timeout(15000),redirect:'error'});
            if(response.status===429)state.blockedUntil=now+DAY;
            if(response.ok){const found=await response.json();if(found?.Note||found?.Information)state.blockedUntil=now+DAY;
              const exact=Array.isArray(found?.bestMatches)?found.bestMatches.filter(x=>x['1. symbol']===symbol&&x['8. currency']===tickerCurrency(this.currencies,symbol)):[];
              if(exact.length===1)name=cleanName(exact[0]['2. name'])||symbol;
            }
          }catch{} // Quote still valid; no raw token-bearing errors logged.
          state.names[symbol]={at:now,name};await save();
        }
      }
      const quote = validateQuote({ symbol, name, price: last.close, currency: tickerCurrency(this.currencies, symbol),
        asOf: last.date + 'T00:00:00Z', source: 'Alpha Vantage daily unadjusted close', fixture: false, priceKind: 'daily-close', history });
      state.cache[symbol] = { fetchedAt: now, quote };
      await save();
      return quote;
    } finally { await lock.close(); await unlink(lockPath); }
  }
}
