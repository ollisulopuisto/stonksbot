import { validateQuote } from './provider.js';

// Never blend a current quote into a daily-close series or compute a return
// across feeds. A history failure must not turn a valid quote into fake data.
export class QuoteWithDailyHistory {
  constructor(quoteProvider, historyProvider) {
    this.quoteProvider = quoteProvider;
    this.historyProvider = historyProvider;
  }
  async lookup(symbol) {
    const quote = await this.quoteProvider.lookup(symbol);
    if (!quote) return null;
    try {
      const daily = await this.historyProvider.lookup(symbol);
      if (!daily || daily.fixture !== false || daily.priceKind !== 'daily-close' ||
          daily.symbol !== quote.symbol || daily.currency !== quote.currency) throw Error('History identity mismatch');
      validateQuote(daily);
      return validateQuote({ ...quote, history: daily.history, historyKind: 'daily-close', historySource: daily.source,
        historyAsOf: daily.asOf });
    } catch {
      return { ...quote, history: [], historyNotice: 'Daily history unavailable; no chart shown.' };
    }
  }
}
