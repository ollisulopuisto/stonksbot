import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { extractTickers, buildCard, createHandler } from '../src/bot.js';
import { FixtureProvider, validateQuote } from '../src/provider.js';
import { chartPng } from '../src/chart.js';
const provider = new FixtureProvider();
const event = { channel: 'C123', ts: '123.456', text: '$AAPL $SPY' };

test('extracts bounded cashtags, no bot mentions, URLs, code or ordinary words', () => {
  assert.deepEqual(extractTickers('IT AAPL $aapl $AAPL $BRK.B $NOKIA.HE $MSFT'), ['AAPL', 'BRK.B', 'NOKIA.HE']);
  assert.deepEqual(extractTickers('`$AAPL` <https://site/$SPY> https://site/$MSFT $123 $TOOLONGSYMBOL'), []);
});
test('fixtures cannot be mistaken for current prices; source/date/range are present', async () => {
  const q = await provider.lookup('AAPL');
  const card = buildCard(q);
  assert.match(card.text, /DEMO FIXTURE, not a live price/);
  assert.match(JSON.stringify(card), /Synthetic test data/);
  assert.match(JSON.stringify(card), /2026-01-30/);
  assert.match(JSON.stringify(card), /Close range/);
  assert.match(buildCard({ ...q, fixture: false }, Date.parse(q.asOf) + 3600000).text, /STALE/);
});
test('provider boundary rejects invalid prices, dates, unordered history and short history', async () => {
  const q = await provider.lookup('AAPL');
  for (const change of [{ price: NaN }, { asOf: 'bad' }, { history: [] }, { history: [...q.history].reverse() }]) assert.throws(() => validateQuote({ ...q, ...change }));
  assert.equal(await provider.lookup('UNKNOWN'), null);
});
test('chart is valid bounded PNG with nonempty plotted pixels, handles flat history', async () => {
  const q = await provider.lookup('AAPL');
  for (const history of [q.history, q.history.map(p => ({ ...p, close: 0 }))]) {
    const png = chartPng(history);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 640);
    const size = png.readUInt32BE(33);
    const pixels = inflateSync(png.subarray(41, 41 + size));
    assert.equal(pixels.length, 240 * (640 * 3 + 1));
    assert.ok(pixels.includes(111));
  }
});
test('real handler sends price cards and local PNGs threaded, ignores repeats and bots', async () => {
  const sent = [];
  const handler = createHandler({ provider, send: async payload => sent.push(payload) });
  await Promise.all([handler(event), handler(event)]);
  await handler(event);
  await handler({ ...event, ts: '123.457', bot_id: 'B1' });
  await handler({ ...event, ts: '123.458', subtype: 'message_changed' });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].thread_ts, event.ts);
  assert.equal(sent[0].symbol, 'AAPL');
  assert.ok(Buffer.isBuffer(sent[0].png));
});
test('unknown data and failed provider never fabricate a card; failed send can retry', async () => {
  let calls = 0;
  const errors = [];
  const handler = createHandler({ provider, send: async () => { if (++calls === 1) throw Error('failure'); }, onError: e => errors.push(e) });
  await handler({ ...event, text: '$AAPL' });
  await handler({ ...event, text: '$AAPL' });
  assert.equal(calls, 2); assert.equal(errors.length, 1);
  await handler({ ...event, ts: '124.5', text: '$UNKNOWN' });
  assert.equal(calls, 2);
});
test('metadata uses plain text and escaped context to avoid Slack mentions', async () => {
  const q = await provider.lookup('AAPL');
  const card = buildCard({ ...q, name: '<!everyone>', source: '<!everyone>' });
  assert.equal(card.blocks[0].text.type, 'plain_text');
  assert.match(card.blocks[2].elements[0].text, /&lt;!everyone&gt;/);
});

test('partial batch retry does not repost already delivered symbols', async () => {
  const sent = []; let failed = false;
  const handler = createHandler({ provider, send: async p => {
    if (p.symbol === 'SPY' && !failed) { failed = true; throw Error('upload'); }
    sent.push(p.symbol);
  }});
  await handler(event); await handler(event);
  assert.deepEqual(sent, ['AAPL', 'SPY']);
  assert.throws(() => chartPng([{close:1},{close:2}], 100000, 100000));
});
