import { readFile } from 'node:fs/promises';
import { loadHelsinkiSymbols, StaticHelsinkiRouter } from './helsinki-symbols.js';
import { EodhdProvider, HelsinkiRouter } from './eodhd.js';
import { currencyMap } from './tickers.js';
import { join } from 'node:path';
import { QuoteWithDailyHistory } from './history.js';
import { FixtureProvider } from './provider.js';
import { FinnhubProvider } from './finnhub.js';
import { AlphaVantageProvider } from './alpha-vantage.js';
function baseProvider(env) {
  if (!env.STONKSBOT_PROVIDER || env.STONKSBOT_PROVIDER === 'fixture') {
    if (env.STONKSBOT_ALLOW_FIXTURE_POSTING !== 'yes') throw Error('Fixture posting requires explicit STONKSBOT_ALLOW_FIXTURE_POSTING=yes. Offline demo needs no opt-in.');
    return new FixtureProvider();
  }
  if (env.STONKSBOT_PROVIDER === 'finnhub') {
    if (env.FINNHUB_PERSONAL_USE_CONFIRMED !== 'yes') throw Error('Confirm Finnhub personal-only use and no third-party sharing before enabling.');
    let currencies;
    try { currencies = currencyMap(env.FINNHUB_US_SYMBOL_CURRENCIES); }
    catch { throw Error('Set FINNHUB_US_SYMBOL_CURRENCIES to explicitly verified US symbols mapped to USD.'); }
    if (!env.STONKSBOT_STATE_DIR) throw Error('Set a private persistent STONKSBOT_STATE_DIR.');
    const quote = new FinnhubProvider({ apiKey: env.FINNHUB_API_KEY, currencies, stateDir: join(env.STONKSBOT_STATE_DIR, 'finnhub'),
      resolveNames: env.FINNHUB_RESOLVE_NAMES !== 'no', minuteLimit: Number(env.FINNHUB_MINUTE_LIMIT ?? 60) });
    if (!env.STONKSBOT_HISTORY_PROVIDER) return quote;
    if (env.STONKSBOT_HISTORY_PROVIDER !== 'alpha-vantage') throw Error('Unknown history provider. Choose alpha-vantage or leave unset.');
    return new QuoteWithDailyHistory(quote, new AlphaVantageProvider({ apiKey: env.ALPHAVANTAGE_API_KEY, currencies,
      stateDir: join(env.STONKSBOT_STATE_DIR, 'alpha-vantage'), dailyLimit: Number(env.ALPHAVANTAGE_DAILY_LIMIT ?? 25) }));
  }
  if (env.STONKSBOT_PROVIDER !== 'alpha-vantage') throw Error('Unknown provider. Choose fixture, finnhub or alpha-vantage.');
  let currencies;
  try { currencies = currencyMap(env.ALPHAVANTAGE_SYMBOL_CURRENCIES); }
  catch { throw Error('Set ALPHAVANTAGE_SYMBOL_CURRENCIES to a symbol-to-currency JSON object.'); }
  if (!env.STONKSBOT_STATE_DIR) throw Error('Set a private persistent STONKSBOT_STATE_DIR.');
  return new AlphaVantageProvider({ apiKey: env.ALPHAVANTAGE_API_KEY, currencies, stateDir: join(env.STONKSBOT_STATE_DIR, 'alpha-vantage'),
    resolveNames: env.ALPHAVANTAGE_RESOLVE_NAMES !== 'no', dailyLimit: Number(env.ALPHAVANTAGE_DAILY_LIMIT ?? 25) });
}

export function configuredProvider(env = process.env, helsinkiSymbols,usSymbols=new Set()) {
  const enabled = env.STONKSBOT_PROVIDER === 'eodhd' || env.EODHD_ENABLED === 'yes';
  if (!enabled) return baseProvider(env);
  if (env.EODHD_PERSONAL_USE_CONFIRMED !== 'yes') throw Error('Confirm EODHD sole-user personal use and no public/shared data access before enabling.');
  if (!env.STONKSBOT_STATE_DIR) throw Error('Set a private persistent STONKSBOT_STATE_DIR.');
  const helsinki = new EodhdProvider({apiKey:env.EODHD_API_KEY,stateDir:join(env.STONKSBOT_STATE_DIR,'eodhd'),
    dailyLimit:Number(env.EODHD_DAILY_LIMIT ?? 20),minuteLimit:Number(env.EODHD_MINUTE_LIMIT ?? 20)});
  if (env.STONKSBOT_PROVIDER === 'eodhd') return helsinkiSymbols ? new StaticHelsinkiRouter(null,helsinki,helsinkiSymbols,join(env.STONKSBOT_STATE_DIR,'bare-symbol-misses.json'),Date.now,usSymbols) : helsinki;
  if (env.STONKSBOT_PROVIDER !== 'finnhub') throw Error('EODHD_ENABLED routing requires Finnhub US mode, or select eodhd alone.');
  return helsinkiSymbols ? new StaticHelsinkiRouter(baseProvider(env),helsinki,helsinkiSymbols,join(env.STONKSBOT_STATE_DIR,'bare-symbol-misses.json'),Date.now,usSymbols) : new HelsinkiRouter(baseProvider(env),helsinki);
}

export async function startupProvider(env=process.env){
 const enabled=env.STONKSBOT_PROVIDER==='eodhd'||env.EODHD_ENABLED==='yes';
 const usSymbols=enabled?new Set(JSON.parse(await readFile(new URL('../data/us-symbol-names.json',import.meta.url),'utf8')).entries.map(x=>x.symbol)):new Set();
 return configuredProvider(env,enabled?await loadHelsinkiSymbols(env.STONKSBOT_HELSINKI_SYMBOLS_FILE):undefined,usSymbols);
}
