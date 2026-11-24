# Stonksbot

Slack stock-ticker cards. This first version uses **synthetic fixtures only**.
It does not fetch current market prices. No data-provider account is needed.

## Try without Slack

Node 22 or newer:

```
npm ci
npm test
npm run demo
```

The demo writes `demo-output/card.json` and `demo-output/AAPL.png` locally.
The card labels the data DEMO and includes source, timestamp, history dates and
close range. The PNG is an equally spaced line of closes, with its date/range
context in the card, not a time-axis financial chart. Fixtures include AAPL,
SPY and NOKIA.HE. These numbers are invented, not investment information.

## Slack adapter, not deployed

The adapter uses Bolt Socket Mode. Installation, tokens, channel selection and
live posting are separate steps, not performed by this PR. Use a bot app with
Socket Mode and a connections:write app token. Bot scopes: chat:write,
files:write and channels:history; add groups:history only if private channels
are intended. Subscribe to message.channels, and message.groups only as needed.
Invite it only to intended channels.

Set SLACK_BOT_TOKEN, SLACK_APP_TOKEN and an explicit comma-separated
SLACK_CHANNEL_IDS allowlist in your process environment. Do not commit tokens.
`npm start` refuses to connect unless STONKSBOT_ALLOW_FIXTURE_POSTING=yes is
also set. All posted cards remain labelled DEMO. No live provider is selected.

The bot reacts to `$AAPL`, not bare AAPL, to avoid ordinary-word false positives.
It ignores bots, message edits, URLs and code, handles at most three distinct
symbols per message, and replies in a thread with a card followed by a local PNG
upload. Active work is capped at four messages. Overload is dropped, not queued.
Event and symbol deduplication lasts ten minutes, in memory, so it resets on
restart. Multi-instance deduplication is not implemented. If a Slack card posts
but its PNG upload fails, retry can duplicate the card. No delivery guarantee.

## Provider boundary and data rights

Implement `lookup(symbol)` returning null or `{symbol, name, price, currency,
asOf, source, fixture, history: [{date, close}]}`. Prices must be finite and
nonnegative, currency a three-letter code, history sorted with unique dates.
A non-fixture quote older than 15 minutes is labelled stale; timestamps in the
future are labelled invalid. This is a conservative display rule, not an
exchange-hours freshness model. Invalid data produces no card.

Code licenses do not grant market-data rights. Yahoo's unofficial APIs,
Finnhub's sharing limits and Alpha Vantage's private/individual use and daily
quota need an explicit provider/audience decision before enabling live data.
No paid plan, signup or scraping workaround is included.

## Reference research

These informed behavior only; no code copied:

- https://github.com/TNowalk/stock-slack-bot/ : MIT, passive cashtags and history
  charts; old Node/Botkit/Yahoo stack, not used as a base.
- https://github.com/dblock/slack-market/ : MIT, ticker and chart controls;
  archived, hosted service shut down after IEX pricing changes.
- https://github.com/thorfour/stocktopus : Go slash-command cards and graphs.
- https://github.com/project-badass/slack-stock-js : MIT JS endpoint reference.

## Verification and limits

Node tests exercise actual extraction, provider validation, cards, local PNG
bytes, retry/dedup and bot suppression. The local PNG was visually inspected.
No live Slack layout or installation, real market provider, deployment or
purchase was tested. The chart is not a trading chart. No portfolio, alerts,
exchange resolution or live price promise in v1.
