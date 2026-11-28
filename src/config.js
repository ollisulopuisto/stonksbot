import { FixtureProvider } from './provider.js';
import { AlphaVantageProvider } from './alpha-vantage.js';
export function configuredProvider(env = process.env) {
  if (!env.STONKSBOT_PROVIDER || env.STONKSBOT_PROVIDER === 'fixture') {
    if (env.STONKSBOT_ALLOW_FIXTURE_POSTING !== 'yes') throw Error('Fixture posting requires explicit STONKSBOT_ALLOW_FIXTURE_POSTING=yes. Offline demo needs no opt-in.');
    return new FixtureProvider();
  }
  if (env.STONKSBOT_PROVIDER !== 'alpha-vantage') throw Error('Unknown provider. Choose fixture or alpha-vantage.');
  let currencies;
  try { currencies = JSON.parse(env.ALPHAVANTAGE_SYMBOL_CURRENCIES ?? ''); }
  catch { throw Error('Set ALPHAVANTAGE_SYMBOL_CURRENCIES to a symbol-to-currency JSON object.'); }
  return new AlphaVantageProvider({ apiKey: env.ALPHAVANTAGE_API_KEY, currencies, stateDir: env.STONKSBOT_STATE_DIR,
    dailyLimit: Number(env.ALPHAVANTAGE_DAILY_LIMIT ?? 25) });
}
