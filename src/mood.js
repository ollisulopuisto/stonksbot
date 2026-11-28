import { helsinkiDate } from './eodhd.js';
const DAY = 86400000;
export const oldDailyDate = (date, now) => Date.parse(new Date(now).toISOString().slice(0,10)) - Date.parse(date.slice(0,10)) > 5 * DAY;
const defaults = { window: 7, multiplier: 3, fallbackPercent: 5 };
export function moodOptions(env = process.env) {
  return checked({ window: Number(env.STONKSBOT_MOOD_WINDOW ?? 7),
    multiplier: Number(env.STONKSBOT_MOOD_MULTIPLIER ?? 3),
    fallbackPercent: Number(env.STONKSBOT_MOOD_FALLBACK_PERCENT ?? 5) });
}
function checked(options) {
  const settings = { ...defaults, ...options };
  if (!Number.isInteger(settings.window) || settings.window < 5 || settings.window > 7 ||
      !Number.isFinite(settings.multiplier) || settings.multiplier < 2 || settings.multiplier > 3 ||
      !Number.isFinite(settings.fallbackPercent) || settings.fallbackPercent <= 0 || settings.fallbackPercent > 100)
    throw Error('Mood requires window 5..7, multiplier 2..3 and fallback percent >0..100.');
  return settings;
}
const unavailable = reason => ({ label: null, basis: 'unavailable', reason });
const usSession = timestamp => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(timestamp);

// Mean absolute close-to-close percentage moves, not signed mean or VIX.
// The target session never participates in its own comparison baseline.
export function evaluateMood(quote, now = Date.now(), options = {}) {
  const settings = checked(options);
  const timestamp = Date.parse(quote.asOf);
  const daily = quote.priceKind === 'daily-close';
  const delayed = quote.priceKind === 'delayed-quote';
  if (delayed && (quote.historySource !== quote.source || quote.exchange !== 'XHEL' || quote.currency !== 'EUR' || quote.moodUnavailable)) return unavailable(quote.moodUnavailable || 'Unverified Helsinki identity');
  if (!['us-quote', 'daily-close', 'delayed-quote'].includes(quote.priceKind) || !Number.isFinite(timestamp) ||
      timestamp > now + 60000 || now - timestamp > (daily ? Infinity : (delayed ? 65 : 15) * 60000))
    return unavailable('No fresh session move');
  const targetDate = daily ? quote.asOf.slice(0, 10) : (delayed ? helsinkiDate(timestamp) : usSession(timestamp));
  const currentDate = daily ? new Date(now).toISOString().slice(0,10) : (delayed ? helsinkiDate(now) : usSession(now));
  if (daily && Date.parse(currentDate) - Date.parse(targetDate) > 5 * DAY) return unavailable('No fresh session move');
  if (delayed && (targetDate !== currentDate || ['Sat','Sun'].includes(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Helsinki',weekday:'short'}).format(now)))) return unavailable('No current Helsinki session move');
  const history = quote.history;
  if (!Array.isArray(history)) return unavailable('Invalid daily history');
  let previousDate = '';
  for (const point of history) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || !Number.isFinite(Date.parse(point.date)) ||
        new Date(point.date).toISOString().slice(0,10) !== point.date || point.date <= previousDate ||
        !Number.isFinite(point.close) || point.close <= 0) return unavailable('Invalid daily history');
    previousDate = point.date;
  }
  const prior = history.filter(point => point.date < targetDate);
  let previousClose = quote.previousClose;
  if (daily) {
    const target = history.find(point => point.date === targetDate);
    if (!target || target !== history.at(-1) || target.close !== quote.price) return unavailable('Daily close identity mismatch');
    previousClose = prior.at(-1)?.close;
  }
  if (!Number.isFinite(quote.price) || quote.price <= 0 || !Number.isFinite(previousClose) || previousClose <= 0)
    return unavailable('No valid same-provider previous close');
  // Do not silently turn old or contradictory history into a rolling baseline.
  if (history.length && (history.some(point => point.date > targetDate) ||
      Date.parse(targetDate) - Date.parse(prior.at(-1)?.date ?? targetDate) > 5 * DAY ||
      (!daily && (quote.historyKind !== 'daily-close' || !quote.historySource ||
        !Number.isFinite(Date.parse(quote.historyAsOf)) || Date.parse(quote.historyAsOf) > now ||
        quote.historyAsOf.slice(0,10) !== history.at(-1).date || Date.parse(currentDate) - Date.parse(quote.historyAsOf.slice(0,10)) > 5 * DAY))))
    return unavailable('Old or unverified daily history');
  const recent = prior.slice(-(settings.window + 1));
  const moves = recent.slice(1).map((point,i) => Math.abs((point.close / recent[i].close - 1) * 100));
  if (moves.some(move => !Number.isFinite(move))) return unavailable('Invalid daily percentage move');
  const typicalPercent = moves.reduce((sum,move) => sum + move,0) / moves.length;
  const rolling = moves.length === settings.window && Number.isFinite(typicalPercent) && typicalPercent > 1e-10;
  const thresholdPercent = rolling ? typicalPercent * settings.multiplier : settings.fallbackPercent;
  const changePercent = (quote.price / previousClose - 1) * 100;
  if (!Number.isFinite(changePercent) || !Number.isFinite(thresholdPercent)) return unavailable('Invalid percentage move');
  const triggered = changePercent !== 0 && Math.abs(changePercent) + 1e-10 >= thresholdPercent;
  return { label: triggered ? (changePercent > 0 ? "We're back" : "It's over") : null,
    basis: rolling ? 'rolling' : 'fixed', changePercent, thresholdPercent,
    typicalPercent: rolling ? typicalPercent : null, ...settings,
    source: daily ? quote.source : quote.historySource, targetDate,
    baselineEnd: rolling ? recent.at(-1).date : null, daily };
}

export function moodText(mood) {
  if (mood.basis === 'unavailable') return `Mood unavailable: ${mood.reason}.`;
  const move = `${mood.changePercent >= 0 ? '+' : ''}${mood.changePercent.toFixed(2)}%`;
  const basis = mood.basis === 'rolling'
    ? `${mood.multiplier}x mean absolute move ${mood.typicalPercent.toFixed(2)}% over ${mood.window} preceding trading sessions through ${mood.baselineEnd}; baseline source: ${mood.source}`
    : `fixed ${mood.fallbackPercent}% fallback (short or flat history)`;
  return `${mood.label ?? 'No mood trigger'}. ${mood.daily ? 'Daily close move' : 'Session move'} ${move}; trigger at ${mood.thresholdPercent.toFixed(2)}%: ${basis}. Not VIX or investment advice.`;
}
