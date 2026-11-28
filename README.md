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
Join only intended channels. At startup the bot attempts conversations.join for
configured C-prefixed channel IDs, using the channels:join bot scope. It does not
discover or join other channels. Private channels still require an invitation.

Both public and private channels are supported. Set SLACK_BOT_TOKEN,
SLACK_APP_TOKEN and an explicit comma-separated
SLACK_CHANNEL_IDS allowlist in your process environment. Do not commit tokens.
Fixture-mode `npm start` requires STONKSBOT_ALLOW_FIXTURE_POSTING=yes. Those
cards remain labelled DEMO. Select a live provider explicitly below; no fallback.

The bot reacts to `$AAPL`, not bare AAPL, to avoid ordinary-word false positives.
It ignores bots, message edits, URLs and code, handles at most three distinct
symbols per message, and replies in the channel with a card by default. Fixtures and Alpha Vantage add a local history PNG; Finnhub free
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
This bot is personal-use-only: a workspace/channel visible only to you, no sharing,
and no Peliteoria Oy or other business use. If others will see the cards, get
Finnhub's written approval or another license.
Delete stored data if your data subscription ends, as Finnhub's terms require.

1. Create a Slack app, enable Socket Mode, generate an app token with
   `connections:write`. Bot scopes: `chat:write` and `groups:history` for a private
   channel, plus `files:write` for the Alpha Vantage chart uploads configured below.
   Subscribe to `message.groups`, install/reinstall, invite bot to the channel.
   Public channels are supported too: add `channels:join`, use
   `channels:history` / `message.channels`, reinstall the app after scope changes,
   and set their IDs in SLACK_CHANNEL_IDS. Startup joins those public channels
   automatically; an existing membership is harmless. Join failure logs only
   the channel ID and setup guidance, continues other joins and event handling,
   and does not retry. You can invite the bot manually instead. Do not
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
   FINNHUB_MINUTE_LIMIT=60
   STONKSBOT_HISTORY_PROVIDER=alpha-vantage
   ALPHAVANTAGE_API_KEY=<your-history-key>
   ALPHAVANTAGE_DAILY_LIMIT=25
   STONKSBOT_STATE_DIR=/var/lib/stonksbot
   ```

   This is an environment-file example, not shell commands. Quote JSON in shell
   exports. Node does not load `.env` automatically. By default there is no ticker
   allowlist: US-style symbols are accepted within the US/USD market scope.
   To restrict tickers, set FINNHUB_US_SYMBOL_CURRENCIES={"AAPL":"USD","SPY":"USD"}.
   It restricts both Finnhub and its optional Alpha history to those exact symbols.
   Unset means allow all supported US-style tickers; empty/malformed JSON is an
   error, not allow-all. Bare symbols and .A/.B or -A/-B share classes are accepted;
   exchange suffixes such as .HE are not inferred as USD. Finnhub quote responses
   contain no currency/exchange metadata, so this is a market-scope assumption,
   not automatic exchange verification. Use US USD listings only. Finnhub does not verify
   Finnish/international coverage; optional EODHD Helsinki mode is described below. Channel restrictions stay mandatory: set
   SLACK_CHANNEL_IDS even when the ticker list is unset.
4. `npm start` under that environment, then `$AAPL` in the allowed channel.
   Expect a channel-level card with Finnhub source/timestamp. Quotes cached 15 seconds;
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
optional ALPHAVANTAGE_SYMBOL_CURRENCIES (JSON symbol/currency restriction;
unset defaults to all supported US-style tickers in USD),
ALPHAVANTAGE_DAILY_LIMIT=25 and a separate STONKSBOT_STATE_DIR. It supplies daily
unadjusted closes and chart history, not live prices. One compact
TIME_SERIES_DAILY request supplies latest 100 closes. Six-hour cache, rolling
24-hour request budget including failures, limit notices pause 24 hours.
Daily midnight UTC is a trading-date marker, not exchange-close time. History
older than 5 calendar dates is flagged old. Requires Slack files:write for chart upload.

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
A public channel is supported if the workspace/channel remains visible only
to you. Public versus private is a Slack setting, not permission to share data.
Keep channels:history and message.channels enabled for public channel messages,
groups:history and message.groups for private ones, and configure each public channel ID in SLACK_CHANNEL_IDS. Add channels:join
and reinstall for automatic startup join, or invite manually. Private channels
still need a manual invitation. There is no private-only filter in code. No channel
shared with other people and no Peliteoria use. Finnhub US symbols only; its Nasdaq Helsinki
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
future or more-than-five-calendar-day-old history suppress mood. US session identity uses
America/New_York, not UTC midnight; Alpha-only uses its labeled trading date.
The five-day grace compares calendar dates (not midnight-to-current-hour age)
so a holiday weekend can remain usable through the fifth day. Fresh Finnhub
quotes still have the separate 15-minute freshness limit. The baseline uses
provider observations, does not backfill missing exchange
sessions, and does not promise a holiday calendar. Both daily data and previous
close are unadjusted: splits and other corporate actions may create false mood
labels. Not investment advice, a trading signal or a VIX implementation.

Labels appear inside the card and fallback/notification text, not as emoji on
someone else's message. DEMO fixtures do not trigger real-market moods. No
background monitoring, deployment, real provider requests or Slack installation
has been performed for this feature. Local card preview is synthetic, not a
verified Slack-client layout.


## Ask for the mood directly

Ask `is $NVDA over or back?` for a direct mood answer at the top of the same
price/source/history card. It uses exactly the normal mood settings, not a new
predictor or extra API call. It answers the actual result, regardless of whether
you asked about being back or over: "We're back", "It's over", "No mood trigger"
or "Mood unavailable". The detailed formula/source text still follows. Finnish
questions currently receive the same English meme labels, not a translated
investment claim. "Pohjalla" is treated as a mood question, not a price-bottom
forecast.

Accepted whole-question patterns (case-insensitive; `$X` means any supported
cashtag, including share classes):

- English state: `[is] $X [is] [still|already] STATE [TIME]`.
  STATE is `over or back`, `back or over`, `back`, `over`, or `done`.
  TIME is `yet`, `now`, `already`, `today`, `again`, or `right now`.
  Examples: `is $NVDA over now?`, `$NVDA over or back?`, `$NVDA is back again?`.
- English mood: `what's the mood on $X`, `what is the mood for $X`
  (`on` and `for` work with either opening); `how is $X` or `how's $X`.
  Optional final `doing`, `looking`, `today`, or `now` applies to these forms.
- Finnish state: `[onko|joko] $X [on] [jo|vielä|nyt|taas] STATE [TIME]`.
  An alternative order is `$X [onko|joko] [jo|vielä|nyt|taas] STATE [TIME]`.
  STATE is `over vai back`, `back vai over`, `over`, `back`, `takaisin`,
  `palannut`, `pohjalla`, `ohi`, `nousussa`, `laskussa`, or `[vielä] pelissä`.
  TIME is `jo`, `vielä`, `nyt`, `taas`, or `tänään`.
  Examples: `onko $NVDA vielä pelissä?`, `joko $NVDA on takaisin?`,
  `$NVDA onko nyt nousussa?`.
- Finnish mood: `miltä $X näyttää [nyt|tänään]`,
  `miten $X menee [nyt|tänään]`, `miten $X voi [nyt|tänään]`,
  `mikä [on] $X[:n] fiilis [nyt|tänään]`,
  `mikä [on] $X[:n] tilanne [nyt|tänään]`.
  Examples: `miltä $NVDA näyttää?`, `mikä on $NVDA:n tilanne nyt?`.

Square brackets above are optional slots, `|` means one alternative, not literal
input. One optional greeting/filler `hey`, `please`, `hei`, `no` or `noh` can
precede the question, and final `please` or `kiitos` can follow, separated by a
space or comma. The recognized phrase must then end the question, with optional
punctuation/whitespace. `?`, `!`, semicolon, newline and a period followed by
whitespace/end separate questions; periods inside `BRK.B` are preserved.

Price or other continuations do not match: `is $NVDA over 100?`,
`is $AAPL back at 200 yet?`, `is $TSLA done reporting?`,
`onko $NVDA ohi 100 dollarin?`, `is $NVDA back to normal?`,
`is $NVDA over-valued?`. They keep normal cards. Each question is checked as a
whole so unrelated prose cannot make a partial phrase trigger.

These are deterministic patterns, not general language understanding or LLM
calls. Bare ticker names without `$` are not commands. Code blocks, inline code,
links and URLs are ignored as before. Other cashtags still get the regular card,
even in an unrecognized question. No extra provider requests.
Up to three symbols per message, the same channel/ticker restrictions, source
rights, provider quotas, freshness rules, threading and retry caveats apply.
Unsupported/provider-rejected tickers still produce no card; there is no guessed
market mood. DEMO cards answer unavailable, never a real-market mood. No live
Slack installation or provider test was performed for this command.


Public-channel startup join uses Slack conversations.join:
https://docs.slack.dev/reference/methods/conversations.join/ . It requires the
channels:join bot scope. Public channel IDs normally start with C; some private
channels do too, so an automatic join may fail and they still need invitation.
The configured channel gate remains mandatory. Responding means posting the
existing ticker/mood card, not emoji reactions, and Finnhub visibility must
remain limited to the owner. No live Slack join or scope installation verified.


## Optional EODHD Helsinki quotes (personal-only, not deployed)

EODHD was selected for Helsinki; no account, key, paid plan or live request was
used to verify this implementation. Current pricing and delayed endpoint docs
include Free, but older plan summaries differ. Verify actual free Helsinki
entitlement before relying on it. Data may be indicative market-maker prices,
not exchange execution prices. No real-time or primary-exchange-price promise.

The free tier has **20 API calls/day**, not unlimited updates for20symbols.
This bot caps ALL EODHD endpoints together at20calls per rolling24hours and
20requests per minute, persistently, including failures. Limits can only be
lowered, not raised by configuration. This is more conservative than a UTC quota
reset. No polling or retries. One process/key/state root, no other applications
using that key if you rely on this local budget. Never delete state to reset it.

Use a channel/workspace accessible ONLY to you, no sharing or business use.
A public Slack channel with one current member can still be joinable/viewable
by other workspace members. EODHD's personal bot FAQ warns about public channels;
this flag does not grant a license. Resolve wider audience rights first.

Environment-file settings (not shell commands):

```text
# Keep Finnhub US mode, add explicit Helsinki routing:
STONKSBOT_PROVIDER=finnhub
EODHD_ENABLED=yes
EODHD_PERSONAL_USE_CONFIRMED=yes
EODHD_API_KEY=<your-key-in-private-env-file-only>
EODHD_DAILY_LIMIT=20
EODHD_MINUTE_LIMIT=20
```

Keep existing Finnhub credentials, personal-use confirmation, persistent state
root and SLACK_CHANNEL_IDS. Alternatively STONKSBOT_PROVIDER=eodhd selects
Helsinki only, with no Finnhub key. Do not set EODHD_ENABLED for fixture or
Alpha-only mode. EODHD uses its own eodhd/ child directory and key via environment
only; never put real keys in the repository. Requests require the vendor's query
authentication, use no redirects and never expose raw errors or URLs in logs.
A stale lock is reported but never removed automatically.

Only .HE symbols are routed, e.g. $NOKIA.HE or $KNEBV.HE. Before quoting, the
provider checks the HE exchange catalog has OperatingMIC XHEL and EUR, then checks
the exact symbol's HE/EUR listing. It does not substitute US ADRs, guess currency
or infer quote availability from a suffix. Missing catalog symbols return no
card; failed validation fails closed. Metadata refreshes every24hours and costs
2calls (exchange list + whole HE symbol list). Initial symbol quote+history costs
another2calls. Metadata access itself can fail if the free account lacks rights.

Quotes normally15-20minutes delayed are cached up to60minutes to conserve20calls/day;
unchanged timestamps are always shown, NEVER called real-time. After65minutes
source age during regular hours they are labelled stale if no fresh data is available. During regular Helsinki weekday hours (10:00-18:30 local), source age65minutes
triggers on-demand refresh even before60minutes fetch age. Outside that window,
existing quote/catalog/history caches are retained without network calls and
labelled outside regular hours, not STALE merely due to closure. The original
source timestamp stays visible. No full holiday/half-day calendar: weekday hours
are not proof the exchange is open, and holidays can still spend budget. Mood
requires regular hours and the same Helsinki local date. Daily history
refreshes on the next Helsinki date or after24hours,1call/symbol. Synthetic tests
cover catalog validation and all quota accounting, not actual key entitlement.

EODHD's own previousClose supplies the session denominator. Its raw close series
supplies the separately labelled daily chart and prior-session mood baseline,
never Alpha/Finnhub data. Split/dividend adjustment-ratio changes or a previous
close/history mismatch disable mood; raw charts remain labelled raw daily closes.
This is a conservative corporate-action guard, not a full action processor.
History/quota failures preserve a valid delayed quote with an explicit no-chart/
no-mood notice. History dates, timestamps and future/old data guards still apply.
Slack files:write is needed for charts. Existing channel gates/dedup/retry limits
stay unchanged. Finnhub US provider and optional Alpha history are unchanged.

Official references:
- https://eodhd.com/pricing
- https://eodhd.com/financial-apis/api-limits
- https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours
- https://eodhd.com/financial-apis/live-realtime-stocks-api
- https://eodhd.com/financial-apis/api-for-historical-data-and-volumes
- https://eodhd.com/help/ai-tools
- https://eodhd.com/financial-apis/terms-conditions

Closed-market cached quotes older than3elapsed days carry OLD DATA even outside
regular hours. Existing cache costs no calls after hours, but an uncached symbol
can still require4initial calls (catalogs2 + quote1 + history1). No holiday feed.
allation verified.


## Reply placement

Cards and daily chart uploads now post at channel level by default, including
when the ticker request arrived inside a thread. This is intentional: leaving
STONKSBOT_REPLY_MODE unset selects channel. To retain the old threaded behavior,
set STONKSBOT_REPLY_MODE=thread. It replies under the incoming thread root when
present, otherwise under the ticker message. Explicit channel is also accepted;
any other value (including empty) fails startup. Restart with the new environment.
This changes reply placement only, not selected channels, data rights, provider
requests, deduplication or Slack scopes. Only configured SLACK_CHANNEL_IDS apply.
Card then chart are separate channel posts in channel mode; existing partial
upload/retry caveat remains. No thread_broadcast or extra notifications API.
No live Slack client verification, scope change or deployment performed.

## Compact replies and instrument names

Cards now show Name ($TICKER), price/currency, relative quote age and the chart,
with only a short STALE/DEMO/daily-close marker when relevant. Unavailable mood
is silent. Triggered over/back labels can remain; no formula/source/timestamp/
range/disclaimer paragraph in each reply. Provider identity/raw close labels
remain on the chart and in configuration/docs; metadata retains actual timestamps.
No new permission to share data is implied. Current Finnhub, Alpha Vantage and
EODHD general personal-use terms were checked: no explicit requirement to print
a provider source/disclaimer on every private bot message was found. Custom
exchange agreements could differ; this is not a redistribution license.
https://finnhub.io/terms-of-service
https://www.alphavantage.co/terms_of_service/
https://eodhd.com/financial-apis/terms-conditions

Instrument names use exact-symbol metadata lookup with ticker fallback if none
is safely available. See Stock and ETF name lookup update below for endpoints,
cache and quota costs. EODHD uses its already-fetched catalog; no extra name call.
Relative daily age describes the date marker, not exact close execution time.
No API keys or live provider/Slack tests used.


## Independent mood emoji reactions

Any accepted $TICKER message (not just a mood question) receives :back: for a
triggered positive mood or :over: for a triggered negative mood. No reaction for
unavailable/no-trigger/demo/stale results. These are CUSTOM workspace emoji names,
not built-in defaults: create/upload the intended over/back emoji yourself, or set
STONKSBOT_REACTION_OVER and STONKSBOT_REACTION_BACK to existing emoji names without
colons. The app does not create emoji. Add bot OAuth scope reactions:write and
reinstall the app. Existing message.channels/channel history and message.groups/
group history subscriptions/scopes still determine visibility, only configured
SLACK_CHANNEL_IDS. No reaction_added subscription or reactions:read required.

Reaction targets the ORIGINAL ticker message, not its thread root or the bot's
reply. Card posting and reactions fail independently. Both reuse the same quote
and mood evaluation, no extra provider call. Messages with multiple distinct tickers receive no reaction because a message-level
emoji cannot identify which instrument it describes; all cards still post. Slack
already_reacted counts as success. Missing/custom emoji or scope failure emits
only safe setup guidance, card still posts, no automatic retry. Reaction success
survives card retry in memory10min, not restart; Slack prevents duplicate bot
reactions. No message edits/bot messages, bare-word ticker scanning or background
monitor. Posting can fail while reaction succeeds. Existing delivery caveats
remain. No live Slack, emoji creation, installation or scope changes performed.
https://docs.slack.dev/reference/methods/reactions.add/

### Stock and ETF name lookup update

Configured Finnhub now uses /search?q=SYMBOL&exchange=US instead of company-only
profile2. One EXACT symbol match supplies description, including US ETF names
when indexed. No fuzzy/foreign listing match. Same one extra metered name request
per24h/symbol as before, persisted including misses and sharing60/min +30/sec
quote budget. Existing name-cache entries from profile2 are versioned out on next
quote refresh, so an ETF ticker fallback does not hide the new resolver for24h.
FINNHUB_RESOLVE_NAMES=no still explicitly disables search. Profile2 isn't also
called, and no paid ETF-profile endpoint is used.

Alpha-only configured daily mode now also searches SYMBOL_SEARCH, exact symbol
AND currency, for full stock/ETF name. One additional request per24h/symbol,
including misses, counted against the SAME25/day rolling budget as daily history.
Use ALPHAVANTAGE_RESOLVE_NAMES=no to opt out. Mixed Finnhub+Alpha history does NOT
run Alpha name search, avoiding duplicate metadata calls. Existing cached daily
quotes can retain ticker fallback until the normal6h quote cache expires; new
names appear on next quote refresh. No quota bypass or cache deletion needed. Name-only Note/Information responses
cache a24h ticker fallback without blocking quotes; HTTP429still pauses the
shared provider budget24h.

Name lookup is best effort: absent/ambiguous exact match, no name field, quota,
network errors, missing endpoint rights or explicit opt-out still retain ticker
fallback rather than invent an instrument name or discard a valid price. Old
name data is not refreshed more than24h. Full-name availability is NOT guaranteed
for every security. Only synthetic responses tested, no key or live API request.
https://finnhub.io/docs/api/symbol-search
https://github.com/Finnhub-Stock-API/finnhub-go/blob/master/api/openapi.yaml
https://www.alphavantage.co/documentation/ (Search Endpoint)

## Bare Helsinki tickers

With Helsinki enabled, $mekko now resolves locally to Marimekko Oyj ($MEKKO.HE).
The app bundles174name/symbol/.HE routes from a CC0 Finland list, source date
**September20,2025**, retrieved November28,2026. This is a dated convenience map,
not a current complete exchange directory. Quote-time HE/XHEL/EUR validation
remains unchanged, so stale/missing provider listings fail closed. No stock quote,
metadata API or EODHD quota is spent RESOLVING the bare ticker. Actual quote/history
and existing identity-validation calls still cost the documented EODHD budget.

Routing rule: table hit selects Helsinki, except collision SBI is ambiguous and
posts a short choice notice with no quote/reaction. Collisions were checked against
the official Nasdaq US directory snapshot November27,2026 21:34. NOKIA is Helsinki,
NOK is the US ticker. Explicit $SBI.HE / $SBI.US selects a venue; .US strips that
routing suffix before passing to Finnhub. Explicit .HE always works as before.
Symbols absent from the table keep the US path, so ordinary US tickers do not
change venue. Future US listings can create new collisions: refresh and review
before relying on bare symbols, or use explicit suffixes. No exhaustive OTC check.

Table resolution is a startup-loaded Map, including table misses, no lookup API
or repeated symbol search. Clean unsupported/null US results are negatively cached
24h in private persistent bare-symbol-misses.json, so repeat unknown requests/restarts do not burn quota. Thrown network/quota errors
are cooled down only15minutes, then retried on demand. Corrupt/future cache data
is discarded/reset, never blocks all bare lookups. This is separate from provider
quota state, which is never reset. A transient failure suppresses a bare symbol
for at most15minutes; explicit .US bypasses this negative cache. Never
change/delete provider quota state. One bot process per persistent state root.

Optional STONKSBOT_HELSINKI_SYMBOLS_FILE=/private/path/helsinki-overrides.json:

```json
{
  "SBI": {"name": "Your chosen US instrument", "route": "SBI.US"},
  "CUSTOM": {"name": "KONE Oyj", "route": "KNEBV.HE"},
  "MEKKO": null
}
```

Overrides deliberately select .HE/.US and can add aliases or replace routes;
null removes a bundled bare mapping, restoring US behavior. Explicit .HE is
unaffected. Invalid file/schema fails startup. Restart after edits, no hot reload.
In EODHD-only mode table Helsinki hits work; absent/explicit US routes return no
card because there is no US provider. A source name labels the canonical returned
instrument. Unknown table entries never synthesize a quote or mood.

Source/license and refresh:
https://huggingface.co/datasets/kjhq/Finland-Stock-Symbols-and-Metadata
CC0-1.0, pinned revision152b96ae7c67a2b30c56b30e2e4ae6b3f94f3a63.
https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt
Download/review the source CSV and US directory yourself, then run offline:

```text
python3 scripts/refresh-helsinki.py --finland-csv /path/finland.csv --us-directory /path/nasdaqtraded.txt --revision <source-commit> --source-date YYYY-MM-DD --retrieved YYYY-MM-DD
npm test
```

Review diff/new/delisted symbols and overlap list, verify special suffixes with
provider metadata, submit PR. Source NDA_FI normalizes to NDA-FI; full names are
as supplied by the dataset, not typed from memory. No automatic network refresh.

## Offline company-name lookup

`how is $apple doing` resolves to Apple ($AAPL); `@stonksbot apple` also works
when Slack delivers a real app_mention event. Ordinary untagged company names
never trigger replies. The literal typed string @stonksbot isn't authenticated
as a mention, Slack must send `<@BOT_ID>`. Existing channel allowlist, bot/edit
suppression and10min message dedup apply, including duplicate message/app_mention
events. Reactions only for one resolved instrument and no unresolved suggestions.

US names are bundled from official Nasdaq nasdaqtraded.txt directory snapshot
November27,2026 21:34, retrieved November28:12762non-test listings with supported
US-style symbols. Helsinki uses the174entry CC0 September20,2025table and local
overrides above. Index loaded at startup, no name API calls/quota for matching.
Actual quote/name/history provider requests still use existing budgets. Names
shown are source full names, e.g. Apple Inc. - Common Stock ($AAPL), not invented
short labels. Exact ticker identities win before name search. Explicit .HE/.US
routes bypass fuzzy matching; US-only providers accept the explicit .US route.

Matching: normalize case/diacritics/punctuation and company suffixes for ranking,
but display full source name. Exact ticker identity wins first. Reviewed brand
aliases google/alphabet -> GOOGL Class A, facebook -> META are hand-curated, not
provider data; use GOOG explicitly for Alphabet Class C. Exact core-name score1.2,
prefix score0.75+0.2*(query/name length), otherwise Levenshtein similarity.
Noncommon/ETF/warrant/preferred approximate matches lose0.12; exact names retain
identity. Require score>=0.79 (4+chars) or0.95 (3chars), runner-up gap>=0.12. Close
cashtag candidates show up to3suggestions; no plausible match passes original
provider path (BRK-B -> BRK.B). $google cannot become an unrelated prefix ETF.
Appl remains a suggestion because AppLovin/Applied are close. Marimeko typo can
resolve Marimekko. Mention low confidence or ordinary help/test/thanks/status/
hello/ping stays silent, no chatter. Mood-question flag follows mapped route.
Name index misses don't prove a ticker absent, OTC/new-listing paths preserved.
Single multiword company supported for mentions; multiword multi-name out of scope.

Slack setup: add bot OAuth scope app_mentions:read and subscribe bot event
app_mention, reinstall app after scopes change. Existing message.channels/groups
subscriptions still handle cashtags, reactions:write for over/back, no new
reaction subscription. App must see the allowed channel; no channel discovery.

Refresh US index offline after reviewing a new official directory download:
https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt

```text
python3 scripts/refresh-us-names.py --input /path/nasdaqtraded.txt --source-date YYYY-MM-DD --retrieved YYYY-MM-DD
npm test
```

Review diff/date/count, rebuild Helsinki collision snapshot if relevant, submit
PR. US data bundled as factual instrument identifiers/names, not price data.
No real API keys, live provider quote, Slack app event/install or deploy tested.

The Nasdaq snapshot's redistribution terms have not been verified. It is a factual
identifier/name list, not price data, but that alone does not settle licensing;
review those terms before distributing the bundled snapshot more widely.

Fuzzy safety update: mentions accept only reviewed aliases/exact core names or a
unique edit-distance1typo of6+characters. Cashtags also allow4+character typos or
a unique first-whole-word prefix of5+characters, always clear lead>=0.12. No ETF,
warrant or preferred approximate autoquotes. A bundled10kEnglish word guard from
https://www.mit.edu/~ecprice/wordlist.10000 (retrieved2026-11-28, redistribution
terms unverified) plus the reviewed297word probe blocks ordinary words, except
explicit reviewed brands. Short brand aliases (Google, Meta, Amazon, Coinbase,
Ford, Visa, Nordea) are hand-curated and source-directory verified. APLE is a real
ticker, not an Apple typo: exact cashtags retain priority, as do HELP/TEST/etc.
Mention ordinary words never inherit ticker priority. Dictionary/name policy is
conservative: some real names such as news/invesco require explicit ticker.

## Chart ranges

30d is the default. Add7d,3m or1y as a separate token, e.g. `$AAPL 7d`,
`$MEKKO 3m`, `$REMEDY.HE 1y` or bot mention company name followed by range.
One range applies to every instrument in the message; first recognized token
wins. No1d/intraday support. d=calendar days;3m=three calendar months (clamped
month-end);1y=365days. Chart includes available daily closes in that window,
weekends/holidays omitted, equally spaced observations. Range appears on chart
axis/upload title; quote age still refers to price, not last history fetch.

| Source |7d /30d |3m |1y |
|---|---|---|---|
| Finnhub without history |no chart, explicit note |no chart |refused |
| Finnhub + Alpha / Alpha-only |yes, slice compact daily |yes if returned100trading dates cover requested period |refused, free compact100trading dates insufficient |
| EODHD Helsinki |yes |yes if full returned coverage |documented free pastyear, requires actual account entitlement, not live tested |

Short/new-listing/incomplete history never gets a longer-range label: explicit
coverage note and no PNG. For3m/1y require source begins within7calendar days of
requested start (holiday grace), at least2points. Existing daily freshness rules
still apply. US1y refusal is explicit in the price card, no mislabeled100-day
chart. EOD request failures/quota also show a plain no-chart note.

Provider quotas unchanged: Alpha compact100daily closes is one request shared
25/day, same6h superset raw cache used for7d/30d/3m views with coverage checked
before render, never called1y. EODHD range-keyed persistent history caches, one
call/history/symbol/range, all calls under20/day. Changing range may cost another
call; quotes/catalogs shared.7d still fetches40calendar days for the separate
7session mood baseline.3m/1y fetch requested span; chart slicing does not alter
mood input. Corporate-action guard examines recent8raw/adjusted ratios so an old
split outside mood window doesn't change verdict when chart range changes.
No state reset, paid plan, key or live requests.

Sources: https://www.alphavantage.co/documentation/ (compact100/free vs full premium),
https://www.alphavantage.co/support/ (25/day),
https://eodhd.com/financial-apis/api-for-historical-data-and-volumes (pastyear1call),
https://eodhd.com/pricing (free20/day).

### Midnight chart renderer

Sketch1style: midnight blue, cyan linear line/area gradient, large last close,
period high/low, currency, source/daily-close/range labels and actual start/end.
Local3xsupersampling with box downsampling, no added npm/runtime dependency.
Offline DejaVuSans ASCII glyph atlas is bundled compressed with its license;
maintainers can regenerate using `python scripts/build-font.py` with Pillow and
DejaVu installed. Names outside ASCII are transliterated or replaced with `?`.
Long labels are clipped by glyph width, not wrapped; no external chart service.
PNG Description metadata retains all previous labels including5scale ticks;
the visible minimalist card uses3ticks. Fixed640x320logical artboard rescales
for optional custom dimensions, which may be too small to read comfortably.

### Price-detail axis update

The period high is the exact ceiling, period low sets the floor with a5%range
bottom gutter. Flat/zero data gets a small symmetric finite span instead.
Round1/2/5helper ticks are placed inside those bounds, never used to expand
the ceiling/floor. Linear prices retain all extremes, including splits/outliers;
no clipping/log transform. A non-zero baseline is visible in tick labels.
Gridlines run across the plot to the right-hand value labels at stronger contrast.
Line only, no area fill. Only last point is marked/labelled, with nearby tick
labels suppressed. Exact high/low stay in the header; source/range appears once
in the footer. Normal values use2decimals, sub-cent values retain useful digits.
The renderer keeps a fixed640x320logical artboard, so custom tiny output can be
unreadable. Tick count targets four intervals (typically3-6labels).

Calendar axis: xpositions use actual UTC dates (Friday-to-Monday has a3daygap),
not trading-session index.30dticks are Mondays,7dticks weekdays,3m/1yticks month
starts, year beneath January. Stronger horizontal and slightly lighter vertical
guides are behind the line. Footer states actual coverage, including partial data.
No invented weekend points, straight connections only. Date-axis loop bounded
at1001calendar days, input dates must increase. Custom tiny output remains caveat.
### Xetra cashtags

Case-insensitive `$eunl`, `$EUNL`, `$eunl.de`, `$EUNL.DE`, `$bmw.de`, `$BMW.DE`
are supported when EODHD is enabled. `.DE` maps explicitly to EODHD `.XETRA`,
and only bare EUNL has a curated Xetra default. Canonical returned symbols are
EUNL.XETRA/BMW.XETRA. ETFs are allowed by exact cashtag, not fuzzy company names.
HE/XETRA only: no arbitrary EODHD suffix guessing, US fallback or currency guess.
Exchange catalogue must confirm XETR/EUR and symbol catalogue must confirm each
listing. Name comes from catalogue. Shared EODHD quota/lock; per-exchange metadata,
per-canonical-symbol quote/history cache,7d/30dshared, wider ranges separately.
Existing flat HE metadata schema is read without dropping quota/history state.

Xetra uses Europe/Berlin09:00-17:30weekday session for fresh mood eligibility,
not a holiday/open-status feed. Same-feed history/previous-close/split guards and
stale safeguards unchanged. No fresh mood outside regular hours or bad identity.
Free pricing currently advertises20calls/day and1yrglobal stocks/ETF history;
live endpoint includes free plan with15-20min delayed snapshots. Actual key
entitlement not tested. No real API key, registration or live provider calls used.
EUNL/BMWare not in demo-key whitelist. No paid upgrade or added dependency.

Sources checked2026-11-28:
- https://eodhd.com/financial-summary/EUNL.XETRA
- https://eodhd.com/financial-summary/BMW.XETRA
- https://eodhd.com/financial-apis/exchanges-api-list-of-tickers-and-trading-hours
- https://eodhd.com/pricing
- https://eodhd.com/financial-apis/live-realtime-stocks-api
- https://www.eurexgroup.com/xetra-en/trading/trading-calendar-and-trading-hours

### Bare-symbol European fallback

After confirmed US absence, match the exact bare code in Xetra and Helsinki
catalogs, ETFs included. A valid US quote wins. Multiple EU listings, or a known
US identity whose quote is missing, return explicit .US/.DE/.HE choices instead
of guessing. Explicit suffixes and existing Helsinki overrides remain unchanged.
Finnhub all-zero quotes alone do not establish absence: a separately metered US
search must return a well-formed empty result. Timeouts, auth/quota failures and
malformed responses never redirect. US-only absence is cached24h, transient
failures15min. Cache schema2 discards the previous conflated miss entries.

Validated symbol catalogs persist in eodhd/state.json for7days, fetched on demand
only, with failed-refresh backoff24h. Both markets share the exchange-list cache,
lock and20/day budget. Warm catalogs cost0calls across restarts; cold discovery
of both markets costs3metadata calls (1exchange list+2symbol lists), plus quote
and history if a match is selected. Cold Finnhub zero-quote confirmation costs
one extra Finnhub search. No background refresh. Exact European codes precede
fuzzy names. Name-disambiguation may need catalog discovery before a name route
is chosen; if catalog validation fails, it does not guess the company instead.
Cards show the canonical instrument and exchange; chart titles use that same
resolved identity. Provider prices, history and mood are never mixed across venues.

Limit: no bundled top500Xetra seed is included yet. The official instrument
CSV has identifiers but no ranking; available monthly equity-segment turnover
workbooks do not establish a combined500equity/ETF ranking or explicit open
redistribution grant. See official instrument/turnover/disclaimer sources:
https://www.eurexgroup.com/xetra-en/instruments/instruments
https://www.cashmarket.deutsche-boerse.com/cash-en/Data-Tech/statistics/Turnover-Statistics/monthly-turnover-statistics
https://www.eurexgroup.com/xetra-en/disclaimer
A bundled unverified seed would still require live catalog validation before
quoting. No real keys or live quote endpoints were used during development.
