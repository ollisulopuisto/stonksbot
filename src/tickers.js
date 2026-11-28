// With no list, accept US-style tickers in the selected US/USD market scope.
// A ticker is not an exchange/currency lookup: never interpret .HE as USD.
export function tickerCurrency(currencies, symbol) {
  if (currencies === undefined) return typeof symbol === 'string' && /^[A-Z][A-Z0-9]{0,9}(?:[.-][AB])?$/.test(symbol) ? 'USD' : null;
  return Object.hasOwn(currencies, symbol) ? currencies[symbol] : null;
}
export function validCurrencies(currencies, usdOnly = false) {
  return currencies === undefined || (currencies !== null && typeof currencies === 'object' &&
    !Array.isArray(currencies) && Object.keys(currencies).length > 0 &&
    Object.entries(currencies).every(([s,c]) => /^[A-Z][A-Z0-9.-]{0,15}$/.test(s) &&
      (usdOnly ? c === 'USD' : /^[A-Z]{3}$/.test(c))));
}
export function currencyMap(value) {
  if (value === undefined) return undefined;
  const currencies = JSON.parse(value);
  if (!validCurrencies(currencies)) throw Error('Ticker map must be a nonempty symbol-to-currency object, or omitted for US/USD defaults.');
  return currencies;
}
