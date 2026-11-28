# Stonksbot

Slack stock-ticker cards. Offline DEMO fixtures remain the default. Explicit
Alpha Vantage mode fetches **daily unadjusted closes**, not live prices. No
provider account is needed for the offline demo.

## Try without Slack

Node 22 or newer:

```
npm ci
npm test
npm run demo
```

The demo writes `demo-output/card.json` and `demo-output/AAPL.png` locally.
The card labels the data DEMO and includes source, timestamp, history dates and
close range. The PNG has a DEMO title, close/currency axis and tick values, date ticks,
and last/high/low markers. Observations are equally spaced, not a time-scale
financial chart. Fixtures include AAPL,
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
also set. All posted cards remain labelled DEMO. Select Alpha Vantage explicitly as described below; no automatic fallback.

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


## Install for a private Slack channel (Alpha Vantage daily closes)

This PR does not deploy or connect anything. On your existing VPS, use Node22+
under an unprivileged service account. No public HTTP endpoint is needed with
Socket Mode. Keep the repo public but **never put real keys/tokens in it**.

1. In Slack's app dashboard, create an app for your workspace, enable Socket
   Mode, and generate an app-level token with `connections:write`. Under OAuth
   permissions add bot scopes `chat:write`, `files:write` and `groups:history`
   for your private channel (`channels:history` only for public channels).
   Under Event Subscriptions subscribe to `message.groups` for private
   channels (`message.channels` for public ones). Install/reinstall to the
   workspace, then invite the bot to your intended channel.
2. Get your own Alpha Vantage API key. Free service currently offers25requests
   per day; compact `TIME_SERIES_DAILY` is supported for free, intraday is
   premium. These are personal-use data, not permission to redistribute to a
   public channel. Confirm your channel/account use meets provider terms.
3. Clone the repo, run `npm ci`, `npm test`, and `npm run demo`. Create a private
   persistent state directory writable only by the service account. Set the
   environment below through your service manager's private environment file
   (mode0600, outside the repo). Node does not load `.env` automatically.

   ```sh
   STONKSBOT_PROVIDER=alpha-vantage
   SLACK_BOT_TOKEN=<your-bot-token>
   SLACK_APP_TOKEN=<your-socket-mode-app-token>
   SLACK_CHANNEL_IDS=<your-private-channel-id>
   ALPHAVANTAGE_API_KEY=<your-key>
   ALPHAVANTAGE_SYMBOL_CURRENCIES={"AAPL":"USD","SPY":"USD"}
   ALPHAVANTAGE_DAILY_LIMIT=25
   STONKSBOT_STATE_DIR=/var/lib/stonksbot
   ```

   This is an environment-file example, not commands to paste into a shell.
   For a direct shell export, quote the JSON value. Add supported symbols
   deliberately and verify their currency; the daily endpoint supplies no
   currency metadata. No suffix-based or silent USD guessing. Finnish ticker
   support is not verified. Only configured symbols consume requests.
4. Start one process with `npm start` under the configured environment. Send
   `$AAPL` in the allowed channel. Expect a threaded daily-close card and PNG,
   with provider source and trading date, **not a real-time price**. Check the
   channel ID and app event/scopes/invitation if nothing happens. Stop via your
   service manager or Ctrl-C. Keep tokens out of screenshots and logs.

One API call provides the latest100daily closes and latest close. Results are
cached6hours per symbol, persisted across restarts. A local rolling24-hour
budget counts requests before sending, including errors/timeouts. Notices pause
new requests24hours. No automatic retry, paid signup, or increased-quota bypass.
Sharing this key with another app can still hit the provider's own limit. Do not
run separate state directories for the same key. A crashed process may leave
`provider.lock`: stop all instances and inspect before manually removing it;
never delete `state.json` to reset a quota. State is not a secret-key store.

Daily-close date uses midnight UTC only as a date marker, not an exchange close
timestamp. Weekends/holidays naturally show the last trading day. Cards flag
history older than4days. Raw/as-traded prices are not split/dividend adjusted.
Data errors/unknown symbols do not generate fake cards or fixture fallbacks;
logs intentionally omit raw provider errors to avoid leaking URL API keys.

Provider tests use invented responses, fake key strings and injected fetch.
No real key, live provider request, Slack connection or VPS deployment has been
verified in this PR. Existing duplicate-post-on-upload-failure caveat remains.
Mood reactions are still out of scope.

Official references checked for this implementation:
- https://www.alphavantage.co/documentation/ (daily compact availability)
- https://www.alphavantage.co/support/ (free quota)
- https://docs.slack.dev/apis/events-api/using-socket-mode/
