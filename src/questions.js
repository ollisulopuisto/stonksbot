// Deterministic whole-question patterns, not price-level or prediction parsing.
// Cashtag extraction/sanitization and the three-symbol cap remain in bot.js.
const ticker = String.raw`\$([A-Za-z][A-Za-z0-9]{0,9}(?:[.-][A-Za-z0-9]{1,5})?)`;
const englishState = String.raw`(?:over\s+or\s+back|back\s+or\s+over|back|over|done)`;
const englishTail = String.raw`(?:\s+(?:yet|now|already|today|again|right\s+now))?`;
const finnishState = String.raw`(?:over\s+vai\s+back|back\s+vai\s+over|over|back|takaisin|palannut|pohjalla|ohi|nousussa|laskussa|(?:vielä\s+)?pelissä)`;
const finnishTail = String.raw`(?:\s+(?:jo|vielä|nyt|taas|tänään))?`;
const definitions = [
  String.raw`(?:is\s+)?${ticker}\s+(?:is\s+)?(?:still\s+|already\s+)?${englishState}${englishTail}`,
  String.raw`(?:what(?:'s|\s+is)\s+the\s+mood\s+(?:on|for)|how\s+is|how's)\s+${ticker}(?:\s+(?:doing|looking|today|now))?`,
  String.raw`(?:onko|joko)\s+${ticker}\s+(?:on\s+)?(?:(?:jo|vielä|nyt|taas)\s+)?${finnishState}${finnishTail}`,
  String.raw`${ticker}\s+(?:onko\s+|joko\s+)?(?:(?:jo|vielä|nyt|taas)\s+)?${finnishState}${finnishTail}`,
  String.raw`miltä\s+${ticker}\s+näyttää(?:\s+(?:nyt|tänään))?`,
  String.raw`miten\s+${ticker}\s+(?:menee|voi)(?:\s+(?:nyt|tänään))?`,
  String.raw`mikä\s+(?:on\s+)?${ticker}(?::n)?\s+(?:fiilis|tilanne)(?:\s+(?:nyt|tänään))?`,
];
const patterns = definitions.map(pattern => new RegExp(`^(?:(?:hey|please|hei|no|noh)[, ]+)?${pattern}(?:[, ]+(?:please|kiitos))?$`, 'iu'));
export function questionSymbols(plain) {
  const symbols = new Set();
  // Period separates sentences only before whitespace/end, not share classes.
  for (const sentence of plain.split(/[?!;\n]+|\.(?=\s|$)/u)) {
    const text = sentence.trim();
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) { symbols.add(match[1].toUpperCase()); break; }
    }
  }
  return symbols;
}
