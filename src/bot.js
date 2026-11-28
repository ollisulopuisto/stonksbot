import { helsinkiRegularSession } from './helsinki-session.js';
import { chartPng } from './chart.js';
import { questionSymbols } from './questions.js';
import { validateQuote } from './provider.js';
import { evaluateMood, moodText, oldDailyDate } from './mood.js';

const plainMessage = text => text.replace(/```[\s\S]*?```|`[^`]*`|<[^>]*>|https?:\/\/\S+/g, ' ');
export function extractTickers(text = '') {
  // Cashtags avoid common English words such as IT, ON and A.
  const plain = plainMessage(text);
  return [...new Set([...plain.matchAll(/(?:^|[^\w$])\$([A-Za-z][A-Za-z0-9]{0,9}(?:[.-][A-Za-z0-9]{1,5})?)(?!\w)/g)].map(m => m[1].toUpperCase()))].slice(0, 3);
}
// Explicit, bounded phrase grammar. Unrecognized cashtags still use normal cards.
export function moodQuestionTickers(text = '') {
  const plain = plainMessage(text);
  const questions = questionSymbols(plain);
  return extractTickers(text).filter(symbol => questions.has(symbol));
}
const safe = text => String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).slice(0, 200);
export function buildCard(quote, now = Date.now(), mood = {}, question = false) {
  validateQuote(quote);
  const age = now - Date.parse(quote.asOf);
  const status = quote.priceKind === 'delayed-quote' && age > 3 * 86400000 ? 'OLD DATA, last delayed quote more than 3 days old' : quote.fixture ? 'DEMO FIXTURE, not a live price' : quote.priceKind === 'daily-close' ? `DAILY CLOSE, not a live price; UTC timestamp denotes trading date only${oldDailyDate(quote.asOf, now) ? '; OLD DATA: more than 5 calendar days old' : ''}` : age < -60_000 ? 'INVALID FUTURE TIMESTAMP, not a current quote' : age > (quote.priceKind === 'delayed-quote' ? 65 : 15) * 60_000 && (quote.priceKind !== 'delayed-quote' || helsinkiRegularSession(now)) ? 'STALE, not a current quote' : quote.priceKind === 'delayed-quote' ? `${helsinkiRegularSession(now) ? 'DELAYED HELSINKI QUOTE' : 'OUTSIDE REGULAR HELSINKI HOURS, last delayed quote'}, indicative not execution-grade; provider typically 15-20 min delayed, bot cached up to 60 min during regular hours` : quote.priceKind === 'us-quote' ? 'REAL-TIME US QUOTE, on demand; may be cached up to 15 seconds' : 'Provider quote, may be delayed';
  const result = quote.fixture ? { label: null, basis: 'unavailable', reason: 'DEMO fixture, not a real-market mood' } : evaluateMood(quote, now, mood);
  const moodSummary = quote.fixture ? null : moodText(result);
  const answer = question ? `${quote.symbol}: ${result.label ?? (result.basis === 'unavailable' ? 'Mood unavailable' : 'No mood trigger')}.` : null;
  const prices = quote.history.map(p => p.close);
  const summary = `${quote.symbol}: ${quote.price.toFixed(2)} ${quote.currency}. ${status}. As of ${quote.asOf}.${moodSummary ? ` ${moodSummary}` : ''}`;
  return {
    text: answer ? `${answer} ${summary}` : summary,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `${quote.symbol} · ${quote.name}`.slice(0, 150), emoji: false } },
      ...(answer ? [{ type: 'section', text: { type: 'plain_text', text: answer, emoji: false } }] : []),
      { type: 'section', text: { type: 'plain_text', text: `${quote.price.toFixed(2)} ${quote.currency}\n${status}`, emoji: false } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Source: ${safe(quote.source)} | As of ${safe(quote.asOf)}` }] },
      ...(moodSummary ? [{ type: 'context', elements: [{ type: 'plain_text', text: moodSummary }] }] : []),
      ...(quote.history.length ? [{ type: 'section', text: { type: 'plain_text', text: `${quote.historyKind === 'daily-close' ? 'DAILY CLOSE HISTORY (not live/intraday) | Source: ' + quote.historySource + (oldDailyDate(quote.historyAsOf, now) ? ' | OLD HISTORY: more than 5 calendar days old' : '') + '\n' : ''}History: ${quote.history[0].date} to ${quote.history.at(-1).date}\nClose range: ${Math.min(...prices).toFixed(2)}–${Math.max(...prices).toFixed(2)} ${quote.currency}. Line chart, equally spaced observations, vertical range shown here.`, emoji: false } }] : [{ type: 'context', elements: [{ type: 'plain_text', text: quote.historyNotice || 'No history chart: Finnhub free quotes do not include historical candles.' }] }]),
    ],
  };
}

export function replyOptions(env = process.env) {
 const replyMode=env.STONKSBOT_REPLY_MODE ?? 'channel';
 if(!['channel','thread'].includes(replyMode)) throw Error('STONKSBOT_REPLY_MODE must be channel or thread.');
 return {replyMode};
}
export function createHandler({ provider, send, now = Date.now, onError = () => {}, mood = {}, replyMode = 'channel' }) {
 replyOptions({STONKSBOT_REPLY_MODE:replyMode});
  const delivered = new Map();
  const inFlight = new Set();
  let active = 0;
  return async event => {
    if (!event || event.bot_id || event.subtype || !/^[A-Z0-9]+$/.test(event.channel ?? '') || !/^\d+\.\d+$/.test(event.ts ?? '')) return;
    const symbols = extractTickers(event.text);
    const questions = new Set(moodQuestionTickers(event.text));
    if (!symbols.length) return;
    const key = `${event.channel}:${event.ts}`;
    const time = now();
    for (const [k, until] of delivered) if (until <= time) delivered.delete(k);
    if (delivered.has(key) || inFlight.has(key) || active >= 4) return;
    inFlight.add(key); active++;
    try {
      for (const symbol of symbols) {
        const symbolKey = `${key}:${symbol}`;
        if (delivered.has(symbolKey)) continue;
        const quote = await provider.lookup(symbol);
        if (!quote) continue;
        const card = buildCard(quote, now(), mood, questions.has(symbol));
        await send({ channel: event.channel, ...(replyMode === 'thread' ? { thread_ts: /^\d+\.\d+$/.test(event.thread_ts ?? '') ? event.thread_ts : event.ts } : {}), symbol, card, chartTitle: quote.historyKind === 'daily-close' ? `${symbol} ${quote.priceKind === 'delayed-quote' ? 'EODHD' : 'Alpha Vantage'} daily closes, not live` : quote.fixture ? `${symbol} DEMO fixture history` : `${symbol} daily close history`, png: quote.history.length >= 2 ? chartPng(quote.history,640,320,{ ...quote, historyKind: quote.historyKind }) : null });
        delivered.set(symbolKey, now() + 10 * 60_000);
      }
      delivered.set(key, now() + 10 * 60_000);
      if (delivered.size > 500) delivered.delete(delivered.keys().next().value);
    } catch (error) { onError(error); }
    finally { inFlight.delete(key); active--; }
  };
}
