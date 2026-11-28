# Stonksbot

Slack stock-ticker cards. Offline DEMO fixtures remain the default. Explicit
Finnhub mode fetches on-demand **real-time US quotes**, with a 15-second cache.
Optional Alpha Vantage mode remains available for daily closes. No
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
Fixture-mode `npm start` requires STONKSBOT_ALLOW_FIXTURE_POSTING=yes. Those
cards remain labelled DEMO. Select a live provider explicitly below; no fallback.

The bot reacts to `$AAPL`, not bare AAPL, to avoid ordinary-word false positives.
It ignores bots, message edits, URLs and code, handles at most three distinct
symbols per message, and replies in a thread with a card. Fixtures and Alpha Vantage add a local history PNG; Finnhub free
quotes have no history of their own; optional Alpha Vantage daily history adds
a separately labeled chart, never fabricated points. Active work is capped at four messages. Overload is dropped, not queued.
Event and symbol deduplication lasts ten minutes, in memory, so it resets on
restart. Multi-instance deduplication is not implemented. If a Slack card posts
but its PNG upload fails, retry can duplicate the card. No delivery guarantee.

## Provider boundary and data rights

Implement `lookup(symbol)` returning null or `{symbol, name, price, currency,
asOf, source, fixture, history: [{date, close}]}`. Prices must be finite and
nonnegative, currency a three-letter code, history sorted with unique dates.
A non-fixture current quote older than 15 minutes is labelled stale; future
timestamps are labelled invalid. Alpha daily closes use a separate date-only label. This is a conservative display rule, not an
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


## Install for personal-only Slack use (Finnhub US quotes)

No deploy or account connection is performed by this PR. Use Node 22+ under an
unprivileged service account. Socket Mode needs no public HTTP endpoint.

**Data rights first:** Finnhub's personal plans prohibit sharing data or derived
results with anyone/third parties without written approval. They also prohibit
business use, even internally, business-name registration and expensing the plan
without approval. A private team channel is not automatically permitted. Confirm
this is personal-only use and the channel is visible only to you before setting
FINNHUB_PERSONAL_USE_CONFIRMED=yes. This flag records your decision, not a license.
This bot is personal-use-only: a private channel visible only to you, no sharing,
and no Peliteoria Oy or other business use. If others will see the cards, get
Finnhub's written approval or another license.
Delete stored data if your data subscription ends, as Finnhub's terms require.

1. Create a Slack app, enable Socket Mode, generate an app token with
   `connections:write`. Bot scopes: `chat:write` and `groups:history` for a private
   channel, plus `files:write` for the Alpha Vantage chart uploads configured below.
   Subscribe to `message.groups`, install/reinstall, invite bot to the channel.
   Public channels use `channels:history` / `message.channels` instead, but do not
   enable shared Finnhub posting without written approval.
2. Get your own Finnhub free API key. Official pricing lists 60 API calls/minute;
   docs add a 30 calls/second cap. `/quote` supports real-time US stocks. This bot
   requests only on cashtags, never continuous polling. No paid signup included.
3. Clone, `npm ci`, `npm test`, `npm run demo`. Create a private persistent state
   directory writable only by the service account. Put this environment in the
   service manager's private environment file (mode 0600, outside the repo):

   ```text
   STONKSBOT_PROVIDER=finnhub
   FINNHUB_PERSONAL_USE_CONFIRMED=yes
   SLACK_BOT_TOKEN=<your-bot-token>
   SLACK_APP_TOKEN=<your-socket-mode-app-token>
   SLACK_CHANNEL_IDS=<your-personal-private-channel-id>
   FINNHUB_API_KEY=<your-key>
   FINNHUB_US_SYMBOL_CURRENCIES={"AAPL":"USD","SPY":"USD"}
   FINNHUB_MINUTE_LIMIT=60
   STONKSBOT_HISTORY_PROVIDER=alpha-vantage
   ALPHAVANTAGE_API_KEY=<your-history-key>
   ALPHAVANTAGE_DAILY_LIMIT=25
   STONKSBOT_STATE_DIR=/var/lib/stonksbot
   ```

   This is an environment-file example, not shell commands. Quote JSON in shell
   exports. Node does not load `.env` automatically. Verify every configured
   symbol is a US listing denominated in USD. The quote response has no currency
   or symbol metadata; the explicit map is your allowlist, not automatic exchange
   verification. Other currencies rejected. No Finnish/international support.
4. `npm start` under that environment, then `$AAPL` in the allowed channel.
   Expect a threaded card with Finnhub source/timestamp. Quotes cached 15 seconds;
   market closures can leave older timestamps, flagged stale after 15 minutes.
   Finnhub supplies no free historical candles. With the history configuration
   above, Alpha Vantage supplies up to 100 raw daily closes for a separate chart.
   Keep `files:write` scope for this chart. Card and upload title identify Alpha
   Vantage daily history, not live/intraday. Quote and history are never blended;
   no cross-feed price return is calculated. Mood compares a Finnhub-only session
   return with a separately attributed Alpha Vantage volatility baseline. History failure leaves an explicit
   unavailable/no-chart notice while preserving the valid Finnhub quote.
   Stop via service manager or Ctrl-C. Check channel ID, app invitation, scopes
   and events if no response. Never include real tokens in screenshots or logs.

One process and one persistent state directory per key. Requests count before
network including failures; rolling-minute and 30/second limits survive restart.
HTTP 429 pauses new calls one minute, no automatic retry. Shared use by other apps
can still hit Finnhub's limit. Cache does not hide stale quote timestamps. No raw
provider errors or token-bearing URLs logged; header authentication is used.
Potentially stale `provider.lock` is reported after 5 minutes, never auto-deleted.
Stop all instances and inspect before removing a crashed lock; never delete state
to bypass limits. The root automatically uses separate `finnhub/` and `alpha-vantage/` child
directories, and each state file validates its provider identity. Existing
pre-release state files without that identity are rejected; do not delete state
to reset quota. Stop the bot and migrate deliberately, retaining budget history.

## Optional Alpha Vantage daily closes

Retained as a separate explicit mode. Its own personal-use terms apply. Set
STONKSBOT_PROVIDER=alpha-vantage, ALPHAVANTAGE_API_KEY,
ALPHAVANTAGE_SYMBOL_CURRENCIES (JSON symbol/currency map),
ALPHAVANTAGE_DAILY_LIMIT=25 and a separate STONKSBOT_STATE_DIR. It supplies daily
unadjusted closes and chart history, not live prices. One compact
TIME_SERIES_DAILY request supplies latest 100 closes. Six-hour cache, rolling
24-hour request budget including failures, limit notices pause 24 hours.
Daily midnight UTC is a trading-date marker, not exchange-close time. History
older than 4 days is flagged old. Requires Slack files:write for chart upload.

Provider tests use invented responses, fake keys and injected fetch. No actual
provider request/key, Slack install/layout or VPS deployment verified. Existing
upload retry/dedup caveats apply. Mood is a card label, not an automatic Slack emoji reaction or background alert.

Official references checked:
- https://finnhub.io/docs/api/quote (US real-time quotes, auth, rate limits)
- https://finnhub.io/pricing (free 60/minute, personal use)
- https://finnhub.io/terms-of-service (sharing and business limits)
- https://www.alphavantage.co/documentation/ (daily compact availability)
- https://www.alphavantage.co/support/ (free quota)
- https://docs.slack.dev/apis/events-api/using-socket-mode/

Mixed-source basis: this use is personal, not business. Alpha Vantage terms grant
personal, non-commercial use and treat acting for a corporation as commercial:
https://www.alphavantage.co/terms%5Fof%5Fservice/ . Combining two clearly attributed
series for the same personal viewer does not waive either provider's conditions.
No shared Slack channel or Peliteoria use. US symbols only; Nasdaq Helsinki
coverage is not verified and US ADRs must not be treated as Helsinki listings.

## Mood labels

On-demand cards say "We're back" for a large positive session move and "It's over"
for a large negative one. Otherwise they say "No mood trigger". Defaults:

```text
STONKSBOT_MOOD_WINDOW=7
STONKSBOT_MOOD_MULTIPLIER=3
STONKSBOT_MOOD_FALLBACK_PERCENT=5
```

Window accepts 5, 6 or 7 trading-session returns. Multiplier accepts numbers from
2 to 3, including 2.5. Fallback accepts >0 through 100 percent. Invalid settings
stop Slack startup, not silently revert. No extra API requests or Slack scopes.

The typical move is the arithmetic mean of the **absolute percentage**
close-to-close moves over the preceding window, excluding the session being
judged. Seven returns require eight preceding closes. It is not a signed mean,
standard deviation, options-implied volatility or VIX. At or above 3x that mean,
the sign chooses the label. A near-zero/flat baseline or fewer than the required
returns uses the explicit 5% fixed fallback, in either direction. Every card shows
the move, threshold and basis, even when no label triggers.

Finnhub session return uses only Finnhub current price and its own `pc` previous
close: `(price / previousClose - 1) * 100`. Alpha Vantage supplies only the baseline
of daily returns, attributed separately with its last included date. No Finnhub
price is appended to that chart or divided by an Alpha close. With no history
configured or history unavailable, the fixed fallback can still work. Missing or
invalid Finnhub previous close means "Mood unavailable", never a guessed return.
Existing cached quotes without previous close gain it on normal cache expiry.

Alpha-only mode evaluates the latest daily-close move, not an intraday move, and
excludes that target return from its baseline. Stale/future quotes, malformed,
future or more-than-four-day-old history suppress mood. US session identity uses
America/New_York, not UTC midnight; Alpha-only uses its labeled trading date.
The baseline uses provider observations, does not backfill missing exchange
sessions, and does not promise a holiday calendar. Both daily data and previous
close are unadjusted: splits and other corporate actions may create false mood
labels. Not investment advice, a trading signal or a VIX implementation.

Labels appear inside the card and fallback/notification text, not as emoji on
someone else's message. DEMO fixtures do not trigger real-market moods. No
background monitoring, deployment, real provider requests or Slack installation
has been performed for this feature. Local card preview is synthetic, not a
verified Slack-client layout.
