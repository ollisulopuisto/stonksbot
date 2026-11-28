import { readFile } from 'node:fs/promises';

export class FixtureProvider {
  constructor(path = new URL('../fixtures/quotes.json', import.meta.url)) { this.path = path; }
  async lookup(symbol) {
    const fixtures = JSON.parse(await readFile(this.path, 'utf8'));
    const item = fixtures[symbol];
    if (!item) return null;
    return { ...item, symbol, fixture: true };
  }
}
export function validateQuote(quote) {
  if (!quote || !/^[A-Z0-9.^-]{1,16}$/.test(quote.symbol) ||
      !Number.isFinite(quote.price) || quote.price < 0 ||
      !/^[A-Z]{3}$/.test(quote.currency) || !Number.isFinite(Date.parse(quote.asOf)) ||
      typeof quote.source !== 'string' || !quote.source || typeof quote.name !== 'string' ||
      !Array.isArray(quote.history) || (quote.priceKind === 'us-quote' && quote.history.length === 0 ? false : quote.history.length < 2) || quote.history.length > 1000) throw new Error('Invalid provider result');
  if (quote.priceKind === 'us-quote' && quote.history.length && (quote.historyKind !== 'daily-close' || typeof quote.historySource !== 'string' || !quote.historySource || !Number.isFinite(Date.parse(quote.historyAsOf)))) throw new Error('Missing independent history attribution');
  let previous = -Infinity;
  for (const point of quote.history) {
    const date = Date.parse(point.date);
    if (!Number.isFinite(date) || date <= previous || !Number.isFinite(point.close) || point.close < 0) throw new Error('Invalid provider history');
    previous = date;
  }
  return quote;
}
