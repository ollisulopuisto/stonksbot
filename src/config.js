import { FixtureProvider } from './provider.js';
import { FinnhubProvider } from './finnhub.js';
import { AlphaVantageProvider } from './alpha-vantage.js';
export function configuredProvider(env = process.env) {
  if (!env.STONKSBOT_PROVIDER || env.STONKSBOT_PROVIDER === 'fixture') {
    if (env.STONKSBOT_ALLOW_FIXTURE_POSTING !== 'yes') throw Error('Fixture posting requires explicit STONKSBOT_ALLOW_FIXTURE_POSTING=yes. Offline demo needs no opt-in.');
    return new FixtureProvider();
  }
  if (env.STONKSBOT_PROVIDER === 'finnhub') {
    if (env.FINNHUB_PERSONAL_USE_CONFIRMED !== 'yes') throw Error('Confirm Finnhub personal-only use and no third-party sharing before enabling.');
    let currencies;
    try { currencies = JSON.parse(env.FINNHUB_US_SYMBOL_CURRENCIES ?? ''); }
    catch { throw Error('Set FINNHUB_US_SYMBOL_CURRENCIES to explicitly verified US symbols mapped to USD.'); }
    return new FinnhubProvider({ apiKey: env.FINNHUB_API_KEY, currencies, stateDir: env.STONKSBOT_STATE_DIR,
      minuteLimit: Number(env.FINNHUB_MINUTE_LIMIT ?? 60) });
  }
  if (env.STONKSBOT_PROVIDER !== 'alpha-vantage') throw Error('Unknown provider. Choose fixture, finnhub or alpha-vantage.');
  let currencies;
  try { currencies = JSON.parse(env.ALPHAVANTAGE_SYMBOL_CURRENCIES ?? ''); }
  catch { throw Error('Set ALPHAVANTAGE_SYMBOL_CURRENCIES to a symbol-to-currency JSON object.'); }
  return new AlphaVantageProvider({ apiKey: env.ALPHAVANTAGE_API_KEY, currencies, stateDir: env.STONKSBOT_STATE_DIR,
    dailyLimit: Number(env.ALPHAVANTAGE_DAILY_LIMIT ?? 25) });
}
