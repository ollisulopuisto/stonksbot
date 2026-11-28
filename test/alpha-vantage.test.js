import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AlphaVantageProvider } from '../src/alpha-vantage.js';
import { configuredProvider } from '../src/config.js';
import { buildCard, createHandler } from '../src/bot.js';
const fixture = JSON.parse(await readFile(new URL('./fixtures/alpha-daily.json', import.meta.url)));
const now = Date.parse('2026-11-28T08:00:00Z');
async function setup(t, overrides = {}) {
  const stateDir = await mkdtemp(join(tmpdir(), 'stonksbot-test-'));
  t.after(() => rm(stateDir, { recursive: true, force: true }));
  const calls = [];
  const options = { apiKey: 'fake-test-key', currencies: { AAPL: 'USD' }, stateDir, now: () => now,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => structuredClone(fixture) }; }, ...overrides };
  return { provider: new AlphaVantageProvider(options), options, calls, stateDir };
}
test('one daily request becomes a labeled close and ascending chart; cached across restarts', async t => {
  const { provider, options, calls, stateDir } = await setup(t);
  const [a, b] = await Promise.all([provider.lookup('AAPL'), provider.lookup('AAPL')]);
  assert.equal(a.price, 250.12); assert.equal(a.currency, 'USD'); assert.equal(a.fixture, false);
  assert.equal(a.history[0].date, '2026-11-25'); assert.deepEqual(a, b);
  assert.equal(calls.length, 1); assert.equal(calls[0].url.hostname, 'www.alphavantage.co');
  assert.equal(calls[0].url.searchParams.get('function'), 'TIME_SERIES_DAILY');
  assert.equal(calls[0].options.redirect, 'error');
  assert.match(buildCard(a, now).text, /daily close age/);
  assert.doesNotMatch(buildCard(a, now).text, /DEMO/);
  assert.deepEqual(await new AlphaVantageProvider(options).lookup('AAPL'), a);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(await readFile(join(stateDir, 'state.json'), 'utf8'), /fake-test-key/);
});
test('unsupported symbols never consume quota; explicit ticker maps restrict and reject invalid currency', async t => {
  const { provider, calls } = await setup(t);
  assert.equal(await provider.lookup('NOKIA.HE'), null); assert.equal(calls.length, 0);
  assert.throws(() => new AlphaVantageProvider({ apiKey: 'x', stateDir: '/tmp/x', currencies: { AAPL: 'dollars' } }));
});
test('failed requests count durably and rolling24h quota does not reset at midnight', async t => {
  const { provider, options, stateDir } = await setup(t, { dailyLimit: 1,
    fetchImpl: async () => { throw Error('https://example/?apikey=fake-test-key'); } });
  await assert.rejects(provider.lookup('AAPL'), e => !e.message.includes('fake-test-key'));
  await assert.rejects(new AlphaVantageProvider({ ...options, now: () => now + 3600000 }).lookup('AAPL'), /quota/);
  assert.equal(JSON.parse(await readFile(join(stateDir, 'state.json'))).calls.length, 1);
});
test('provider notice pauses requests across restarts and raw notice never escapes', async t => {
  let count = 0;
  const { provider, options } = await setup(t, { fetchImpl: async () => { count++; return { ok: true, json: async () => ({ Note: 'secret-key free quota exceeded' }) }; } });
  await assert.rejects(provider.lookup('AAPL'), { message: 'Alpha Vantage reported a limit or entitlement notice. Paused for 24h; no automatic retries.' });
  await assert.rejects(new AlphaVantageProvider(options).lookup('AAPL'), /quota/); assert.equal(count, 1);
});
test('bad payloads produce no quote, no fallback invented fixtures, and handler sends nothing', async t => {
  for (const payload of [{}, { 'Error Message': 'invalid symbol' }, { ...fixture, 'Meta Data': { '2. Symbol': 'WRONG' } },
    { ...fixture, 'Time Series (Daily)': { '2026-02-30': { '4. close': '1' } } },
    { ...fixture, 'Time Series (Daily)': { '2026-11-26': { '4. close': 'NaN' } } },
    { ...fixture, 'Time Series (Daily)': { '2027-01-01': { '4. close': '1' } } }]) {
    const { provider } = await setup(t, { fetchImpl: async () => ({ ok: true, json: async () => payload }) });
    const sent = [], errors = [];
    await createHandler({ provider, send: async x => sent.push(x), onError: e => errors.push(e) })({ channel: 'C123', ts: '123.4', text: '$AAPL' });
    assert.equal(sent.length, 0); assert.equal(errors.length, 1);
  }
});
test('corrupt state and held cross-process lock fail closed', async t => {
  const { provider, stateDir, calls } = await setup(t);
  await writeFile(join(stateDir, 'provider.lock'), '');
  await assert.rejects(provider.lookup('AAPL'), /busy/);
  await rm(join(stateDir, 'provider.lock'));
  await writeFile(join(stateDir, 'state.json'), '{invalid');
  await assert.rejects(provider.lookup('AAPL'));
  assert.equal(calls.length, 0);
});
test('configuration is fixture-default, explicit live selector never silently falls back', () => {
  assert.throws(() => configuredProvider({}), /Fixture posting/);
  assert.throws(() => configuredProvider({ STONKSBOT_PROVIDER: 'typo' }), /Unknown/);
  assert.throws(() => configuredProvider({ STONKSBOT_PROVIDER: 'alpha-vantage' }), /STATE_DIR/);
  assert.ok(configuredProvider({ STONKSBOT_ALLOW_FIXTURE_POSTING: 'yes' }));
});
test('real handler can render provider result as PNG without live Slack or credentials', async t => {
  const { provider } = await setup(t); const sent = [];
  await createHandler({ provider, now: () => now, send: async p => sent.push(p) })({ channel: 'C123', ts: '123.4', text: '$AAPL' });
  assert.equal(sent.length, 1); assert.match(sent[0].card.text, /daily close age/); assert.ok(sent[0].png.length > 1000);
});
test('daily-close card flags old dates and never claims a current quote', async t => {
  const { provider } = await setup(t);
  const quote = await provider.lookup('AAPL');
  assert.equal(buildCard(quote, now + 7 * 86400000).text, 'AAPL: 250.12 USD. daily close age 8 d ago · STALE');
  assert.throws(() => new AlphaVantageProvider({ apiKey: 'x', stateDir: '/tmp/x', currencies: ['USD'] }));
});


test('aged lock is detected but never removed while another process may own it', async t => {
  const { provider, stateDir, calls } = await setup(t);
  const lock = join(stateDir, 'provider.lock');
  await writeFile(lock, '');
  const old = new Date(Date.now() - 6 * 60000);
  await utimes(lock, old, old);
  await assert.rejects(provider.lookup('AAPL'), { message: 'Provider state lock is more than 5 minutes old and may be stale. Stop all bot instances and inspect before removing it. No lock removed.' });
  assert.equal(await readFile(lock, 'utf8'), '');
  assert.equal(calls.length, 0);
});
