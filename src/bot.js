import { helsinkiRegularSession } from './helsinki-session.js';
import { chartPng } from './chart.js';
import { questionSymbols } from './questions.js';
import { validateQuote } from './provider.js';
import { evaluateMood, oldDailyDate } from './mood.js';

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
export function relativeAge(asOf, now) {
  const age=now-Date.parse(asOf);
  if(age < -60000)return 'INVALID TIME';
  const minutes=Math.floor(Math.max(0,age)/60000);
  if(minutes<1)return 'updated just now';
  if(minutes<60)return `updated ${minutes} min ago`;
  if(minutes<1440)return `updated ${Math.floor(minutes/60)} h ago`;
  return `updated ${Math.floor(minutes/1440)} d ago`;
}
export function buildCard(quote, now = Date.now(), mood = {}, question = false) {
  validateQuote(quote);
  const age=now-Date.parse(quote.asOf), daily=quote.priceKind==='daily-close';
  const delayed=quote.priceKind==='delayed-quote';
  const old=delayed&&age>3*86400000;
  const stale=daily?oldDailyDate(quote.asOf,now):age>(delayed?65:15)*60000&&(!delayed||helsinkiRegularSession(now));
  const status=quote.fixture?'DEMO':age < -60000?'INVALID TIME':old?'OLD DATA':stale?'STALE':delayed?(helsinkiRegularSession(now)?'delayed':'outside regular hours, delayed'):null;
  const ageText=daily?relativeAge(quote.asOf,now).replace('updated','daily close age'):relativeAge(quote.asOf,now);
  const result=quote.fixture?null:evaluateMood(quote,now,mood);
  // Unknown mood is silence, not a warning or a fabricated answer.
  const answer=result?.basis!=='unavailable'?(result?.label || (question?'no trigger':null)):null;
  const label=quote.name && quote.name !== quote.symbol ? `${quote.name.replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim().slice(0,120)} ($${quote.symbol})` : quote.symbol;
  const text=`${label}: ${quote.price.toFixed(2)} ${quote.currency}. ${ageText}${status?` · ${status}`:''}${answer?` · ${answer}`:''}`;
  const fallback=text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
  return {text:fallback,blocks:[{type:'section',text:{type:'plain_text',text,emoji:false}}]};
}

export function replyOptions(env = process.env) {
 const replyMode=env.STONKSBOT_REPLY_MODE ?? 'channel';
 if(!['channel','thread'].includes(replyMode)) throw Error('STONKSBOT_REPLY_MODE must be channel or thread.');
 return {replyMode};
}
export function createHandler({ provider, send, now = Date.now, onError = () => {}, mood = {}, replyMode = 'channel', react = async () => {}, reactionNames = {over:'over',back:'back'} }) {
 replyOptions({STONKSBOT_REPLY_MODE:replyMode});
  const delivered = new Map();
  const reacted = new Map();
  const inFlight = new Set();
  let active = 0;
  return async event => {
    if (!event || event.bot_id || event.subtype || !/^[A-Z0-9]+$/.test(event.channel ?? '') || !/^\d+\.\d+$/.test(event.ts ?? '')) return;
    const symbols = extractTickers(event.text);
    const questions = new Set(moodQuestionTickers(event.text));
    if (!symbols.length) return;
    const key = `${event.channel}:${event.ts}`;
    const time = now();
    for(const [k,until] of reacted)if(until<=time)reacted.delete(k);
    for (const [k, until] of delivered) if (until <= time) delivered.delete(k);
    if (delivered.has(key) || inFlight.has(key) || active >= 4) return;
    inFlight.add(key); active++;
    try {
      for (const symbol of symbols) {
        const symbolKey = `${key}:${symbol}`;
        if (delivered.has(symbolKey)) continue;
        const quote = await provider.lookup(symbol);
        if (!quote) continue;
        // Independent of card posting, and only uses this same provider result.
        const verdict=quote.fixture?null:evaluateMood(quote,now(),mood);
        const reaction=verdict?.label === "We're back" ? reactionNames.back : verdict?.label === "It's over" ? reactionNames.over : null;
        const reactionKey=`${key}:${reaction}`;
        if(reaction && !reacted.has(reactionKey)) {
          try { await react({channel:event.channel,timestamp:event.ts,name:reaction});reacted.set(reactionKey,now()+10*60_000);if(reacted.size>500)reacted.delete(reacted.keys().next().value); }
          catch { onError(Error('Slack reaction failed; card posting continues.')); }
        }
        const card = buildCard(quote, now(), mood, questions.has(symbol));
        await send({ channel: event.channel, ...(replyMode === 'thread' ? { thread_ts: /^\d+\.\d+$/.test(event.thread_ts ?? '') ? event.thread_ts : event.ts } : {}), symbol, card, chartTitle: quote.historyKind === 'daily-close' ? `${symbol} ${quote.priceKind === 'delayed-quote' ? 'EODHD' : 'Alpha Vantage'} daily closes, not live${quote.priceKind === 'us-quote' ? '; quote: Finnhub' : ''}` : quote.fixture ? `${symbol} DEMO fixture history` : `${symbol} daily close history`, png: quote.history.length >= 2 ? chartPng(quote.history,640,320,{ ...quote, historyKind: quote.historyKind }) : null });
        delivered.set(symbolKey, now() + 10 * 60_000);
      }
      delivered.set(key, now() + 10 * 60_000);
      if (delivered.size > 500) delivered.delete(delivered.keys().next().value);
    } catch (error) { onError(error); }
    finally { inFlight.delete(key); active--; }
  };
}
