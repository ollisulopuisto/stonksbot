import { cleanName } from './instrument-name.js';
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { validateQuote } from './provider.js';
import { tickerCurrency, validCurrencies } from './tickers.js';

const MINUTE = 60000;
const fail = () => new Error('Finnhub unavailable or invalid data; no raw response logged.');
export class FinnhubProvider {
  constructor({ apiKey, currencies, stateDir, minuteLimit = 60, cacheMs = 15000, fetchImpl = fetch, now = Date.now, resolveNames = false }) {
    if (typeof apiKey !== 'string' || !apiKey || typeof stateDir !== 'string' || !stateDir ||
        !validCurrencies(currencies, true) ||
        !Number.isInteger(minuteLimit) || minuteLimit < 1 || minuteLimit > 60 ||
        !Number.isFinite(cacheMs) || cacheMs < 15000 || cacheMs > 15000) {
      throw Error('Set Finnhub key, private persistent state directory and optional symbol currencies; default US/USD; limit 1..60.');
    }
    Object.assign(this, { apiKey, currencies: currencies === undefined ? undefined : { ...currencies }, stateDir: resolve(stateDir), minuteLimit, cacheMs, fetchImpl, now });
    this.resolveNames=resolveNames;
    this.queue = Promise.resolve();
  }
  lookup(symbol) {
    if(typeof symbol==='string'&&symbol.endsWith('.US'))symbol=symbol.slice(0,-3);
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
      let state = { provider: 'finnhub', calls: [], cache: {}, blockedUntil: 0 };
      try { state = JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw fail(); }
      if (state.provider !== 'finnhub' || !Array.isArray(state.calls) || state.calls.some(t => !Number.isFinite(t)) ||
          !state.cache || Array.isArray(state.cache) || typeof state.cache !== 'object' || !Number.isFinite(state.blockedUntil)) throw fail();
      const now = this.now();
      if (state.calls.some(t => t > now)) throw fail(); // Clock rollback must not reset quota.
      state.calls = state.calls.filter(t => now - t < MINUTE);
      const cached = Object.hasOwn(state.cache, symbol) ? state.cache[symbol] : null;
      if (cached && now >= cached.fetchedAt && now - cached.fetchedAt < this.cacheMs) {
        const quote = validateQuote(cached.quote);
        if (quote.symbol !== symbol || quote.currency !== tickerCurrency(this.currencies, symbol) || quote.fixture !== false || quote.priceKind !== 'us-quote') throw fail();
        return quote;
      }
      if (now < state.blockedUntil || state.calls.length >= this.minuteLimit || state.calls.filter(t => now - t < 1000).length >= 30) throw Error('Finnhub local rolling-minute quota exhausted. No request sent.');
      const save = async () => {
        const temporary = path + '.tmp';
        await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
        await rename(temporary, path);
      };
      // Count before the request, including timeouts/errors and across restarts.
      state.calls.push(now);
      await save();
      const url = new URL('https://finnhub.io/api/v1/quote');
      url.search = new URLSearchParams({ symbol });
      let response, body;
      try {
        response = await this.fetchImpl(url, { headers: { 'X-Finnhub-Token': this.apiKey }, signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (response.status === 429) {
          state.blockedUntil = now + MINUTE;
          await save();
          throw Error('rate-limit');
        }
        if (!response.ok) throw fail();
        body = await response.json();
      } catch { throw fail(); }
      // /quote contains no symbol/currency or free historical series. The
      // The selected market scope is US/USD; an optional map restricts it further.
      // Zero quotes can be transient too. Confirm absence with an exact US search,
      // counting the request under the same lock/budget. Malformed results fail closed.
      if(body&&['c','h','l','o','pc','t'].every(k=>body[k]===0)){
        if(state.calls.length>=this.minuteLimit||state.calls.filter(t=>now-t<1000).length>=30)throw fail();
        state.calls.push(now);await save();
        const search=new URL('https://finnhub.io/api/v1/search');search.search=new URLSearchParams({q:symbol,exchange:'US'});
        try{const r=await this.fetchImpl(search,{headers:{'X-Finnhub-Token':this.apiKey},signal:AbortSignal.timeout(15000),redirect:'error'});
         if(r.status===429){state.blockedUntil=now+MINUTE;await save();throw fail();}
         if(!r.ok)throw fail();const found=await r.json();
         if(Number.isInteger(found?.count)&&found.count===0&&Array.isArray(found.result)&&found.result.length===0)return null;
        }catch{throw fail();}
        throw fail();
      }
      if (!Number.isFinite(body?.c) || body.c <= 0 || !Number.isInteger(body?.t) || body.t <= 0 || body.t * 1000 > now + 60000) throw fail();
      // Exact symbol search covers stocks AND ETFs, one metered name request.
      // Opt-in avoids changing the quote-only quota for existing installations.
      let name=symbol;
      if (this.resolveNames) {
        state.names ??= {};
        if (!state.names || typeof state.names!=='object' || Array.isArray(state.names)) throw fail();
        const entry=Object.hasOwn(state.names,symbol)&&state.names[symbol];
        if (entry && Number.isFinite(entry.at) && entry.at<=now && now-entry.at<86400000 && entry.version===2 && typeof entry.name==='string') name=entry.name;
        else if(state.calls.length<this.minuteLimit && state.calls.filter(t=>now-t<1000).length<30 && now>=state.blockedUntil) {
          state.calls.push(now);await save();
          try {
            const profileUrl=new URL('https://finnhub.io/api/v1/search');profileUrl.search=new URLSearchParams({q:symbol,exchange:'US'});
            const response=await this.fetchImpl(profileUrl,{headers:{'X-Finnhub-Token':this.apiKey},signal:AbortSignal.timeout(15000),redirect:'error'});
            if(response.status===429)state.blockedUntil=now+MINUTE;
            if(response.ok){const found=await response.json();const exact=Array.isArray(found?.result)?found.result.filter(x=>x.symbol===symbol):[];if(exact.length===1&&typeof exact[0].description==='string')name=cleanName(exact[0].description)||symbol;}
          }catch{} // No raw errors, and ticker remains a valid fallback.
          state.names[symbol]={at:now,name,version:2};await save();
        }
      }
      const quote = validateQuote({ symbol, name, price: body.c, currency: tickerCurrency(this.currencies, symbol),
        ...(Number.isFinite(body.pc) && body.pc > 0 ? { previousClose: body.pc } : {}),
        asOf: new Date(body.t * 1000).toISOString(), source: 'Finnhub real-time US quote', fixture: false, priceKind: 'us-quote', history: [] });
      state.cache[symbol] = { fetchedAt: now, quote };
      await save();
      return quote;
    } finally { await lock.close(); await unlink(lockPath); }
  }
}
