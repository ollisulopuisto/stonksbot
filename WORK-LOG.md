# Work log

## 2026-11-24, v1

Owner requested GitHub reference search then first version. New public repo name
Stonksbot confirmed. PR only, no deployment or merge. Reference search checked
TNowalk/stock-slack-bot, dblock/slack-market, thorfour/stocktopus,
project-badass/slack-stock-js, maxathome/crypto-price-bot, obiter-dictum and
Tickerpal marketing source. None adopted wholesale, no copied code.

Implemented local-only fixture lookup, explicit validation, local PNG renderer,
price/source/date/range card and bounded/deduplicated cashtag handler. Separate
Bolt Socket Mode adapter refuses startup by default and needs explicit fixture
posting opt-in plus channel allowlist. No live data backend/default.

Self adversarial review traced provider result consumers, all posting fields,
chart allocation bounds, event/symbol dedup and partial failures. Added a
partial-batch failing-path test and dimension caps. Eight node tests pass,
npm audit reports0vulnerabilities, demo runs offline. Actual local PNG visually
inspected. Slack client layout, token connection, live provider and deployment
not tested. Remaining limitation: successful card then failed PNG can duplicate
card on retry, documented rather than hidden. Mood feature is a design note,
not invented thresholds.


## 2026-11-28, rolling mood follow-up

Recovered owner's voice definition from the authenticated conversation. Checked
main, branches and all recent PRs before work: provider PR2 already merged and
no overlapping mood PR. Seven-session / 3x defaults follow the requested plan;
5% fallback is explicit and reviewable, not presented as VIX. Branch from merged
main, no deployment or merge.

Added a pure mean-absolute-return evaluator, prior-session exclusion, configurable
5..7 / 2..3x / fixed threshold, same-feed Finnhub previous close, and card labels
through the real handler and Slack startup configuration. Daily-only mode judges
the final daily close. Chart, provider quota/cache, retry and Slack scope behavior
unchanged. Missing previous-close cache entries fail closed until cache expiry.

Own adversarial review traced Finnhub response and cache -> history composition
-> handler -> card summary/blocks -> Slack adapter, plus daily-only/fixture paths.
Checked target-session exclusion near UTC midnight, same-feed denominator,
absolute (not cancelling signed) average, flat/short/invalid baselines, zero and
non-finite values, inclusive thresholds, stale/future inputs, metadata identity,
config startup rejection, old cache compatibility and source labels. Fixed
history timestamp/last-date mismatch and non-finite return guards during review.

New tests first failed before implementation. Full npm test passes, npm audit
reports no vulnerabilities and offline demo succeeds. Local synthetic card
preview inspected separately, not a Slack-client verification. No real provider
key/request, live Slack, deployment or exchange corporate-action/calendar tests.
Unadjusted series may mislabel splits; provider observations are not independently
checked against exchange-session calendars. These limits are in README and PR.


### Owner follow-up: holiday grace, default ticker access and public channels

Owner clarified ticker allowlist, not channel allowlist. Omitted ticker maps now
allow supported US-style tickers in the existing USD scope, in both providers;
explicit maps still restrict exactly, malformed/empty maps fail closed. Cached
quote identity uses the same currency resolver. International suffixes remain
unsupported by default and are not silently assigned USD. Mandatory channel
allowlist and Finnhub personal-use acknowledgement unchanged.

Five-calendar-day trading-date grace replaces four-day elapsed-hour checks for
mood baseline and daily-data labels, so the fifth day remains usable through
market hours. Current Finnhub quote freshness remains fifteen minutes. Regression
covers Nov25 baseline during Nov30 session and sixth-day rejection, plus daily
mode. Both public/private channels already flowed through the same Slack event
path; extracted that gate for actual handler tests, kept explicit channel IDs,
and documented public scopes/events and bot invitation. Public channels are OK
only in a workspace/channel visible solely to the owner under data-source terms.

Own follow-up review traced configuration -> provider constructors -> lookup and
cached identity -> composed history/card, and Slack channel gate -> real handler.
New tests failed on old behavior first; full suite now passes. No deployment or
merge, real keys/provider requests, Slack installation or client-layout testing.


## 2026-11-28, direct mood questions

Owner asked for direct over/back questions and English/Finnish variants. Checked
latest main/branches/recent PRs; mood PR3 already merged, no overlap. Added bounded
question detection reusing sanitized cashtag extraction and existing mood/card
path, not a second provider request or handler. Direct questions put the actual
four-state answer first in card and notification text; the same source/price/
history/formula details follow. Ordinary cashtags retain their original card.
Finnish forms use the English meme labels and do not forecast a market bottom.

Own review traced sanitization -> ticker cap -> per-symbol question state ->
provider result -> evaluator -> summary/blocks -> Slack channel gate. Confirmed
mixed question/nonquestion symbols do not leak question state, absent/out-of-list
tickers never get invented cards, demos answer unavailable, and requested sign
cannot bias result. New tests failed before implementation; full suite passes.
Tests cover every documented phrasing, uppercase variants, ignored code/links,
word boundaries, all four actual outcomes, threading, excluded channel/ticker
and ordinary-card compatibility. No quota/scope/deploy change or merge. No live
Slack client/provider request verified; local synthetic pixels checked separately.


## 2026-11-28, broader whole-question recognition

Owner requested better phrase recognition; independent review identified prefix
matches such as over 100 and back at 200. Branch from merged PR4, no overlapping
open PR. Replaced prefix regex with explicit whole-question patterns, sharing
existing sanitizer/cashtag cap. Added English/Finnish word order, timing/filler,
mood and state questions, retaining deterministic matching and no extra calls.

Regression first failed on is $NVDA over 100. Tests now cover all documented
forms, all six reported false positives through actual handler, further price
continuations, BRK.B, multiple questions, original accepted variants and ticker
cap. Own review traced sentence boundaries, class-share dots, punctuation, regex
anchors/length, sanitizer, per-symbol matching and unchanged evaluator/provider/
channel/card paths. No formula/layout/dependency/scope changes. Full tests, audit,
demo and diff checks pass. No live market/Slack, deploy or merge performed.


### Public-channel startup join

Owner asked to join public channels and respond there. Added one startup join
attempt per configured C-prefixed channel via conversations.join; no discovery
or joining unlisted channels. channels:join scope and app reinstall are documented.
Already-member succeeds, join failure retains other channels/event handling and
logs only configured IDs plus guidance, never raw Slack data. Private channels
need invitation, including C-prefixed private channels in newer workspaces.
No emoji reactions or channel-allowlist change. Tests first failed before helper
existed, then exercise success/already-member, exception/ok:false, skipped private/
DM IDs, allowed public response and excluded-channel gate through actual handler.
Own review traced startup order, failure isolation, scope setup and source-data
visibility limits. No deployment or real Slack scope/join operation performed.


## 2026-11-28, EODHD Helsinki provider

Owner selected EODHD following European-provider research. Checked main, all
recent/open PRs and branches: no existing Helsinki implementation or overlap.
Added optional separate provider and .HE router, preserving Finnhub US defaults.
Exchange catalog XHEL/EUR plus exact HE/EUR symbol validation precedes quotes.
Metadata, quote and raw history calls share persistent rolling20/day and20/min
limits including failures, no retries,429/402day pause, cache and process lock.
No signup/key/live calls, purchase, merge or deployment. API key env-only.

Own adversarial review traced configuration -> router -> catalog -> request/
quota/cache/restart -> quote validation -> daily history -> mood -> card summary/
blocks -> chart pixel labels -> Slack title. Found and fixed hardcoded Alpha
chart branding, normal delayed data incorrectly using US15min freshness, and
cross-feed/session/corporate-action baseline risks. Both configured endpoints
and per-symbol caches remain source/identity checked. Adjusted/raw ratio changes
and previousClose disagreement suppress mood, never combine cross-feed prices.

New tests failed before module existed, then cover actual handler output,
metadata/currency/symbol rejection, cached restart, concurrency, quota exhaustion,
failed requests and daily/minute limits,429pause, malformed/future quotes,
history failure, Helsinki date rollover and independent-source rejection.
Known limits: no real entitlement verification, official calendar/hours or full
corporate-action engine. Hourly quote cache conserves the very small free budget;
source timestamps can be stale, clearly labelled, never changed. Free rights
for public/shared Slack are not assumed. No state deletion/quota bypass.

Final local gate:97tests pass, npm audit0vulnerabilities, offline demo and
whitespace checks pass. Inspected actual synthetic NOKIA.HE640x320PNG pixels:
EODHD DAILY title, EUR axis/range and dates are readable and not Alpha-branded.
Added standard Ubuntu Node22test workflow on public repo (no artifacts/paid
runners); exact PR head CI must be checked separately.

First remote CI exposed an existing test hardcoded to /downloads. Made its
chart scratch path use the test's temporary directory; no runtime behavior
change. Re-ran full local suite before updating PR head.

Independent review found hourly caching could retain a normally delayed quote
past the65min source-age threshold during market hours. Added failing-first
actual lookup test, then on-demand source-age refresh only in regular Helsinki
weekday10:00-18:30hours. Outside hours, existing metadata/history/quote cache
spends no calls, card says outside regular hours instead of spurious stale and
mood stays unavailable. Extracted timezone session helper, official Nasdaq hours
source recorded. No holiday/half-day calendar, explicitly documented.98tests pass.

Second review: indefinite closed-market cache could hide ancient data. Added
failing-first22day-old cache test and OLD DATA after3elapsed days, even outside
hours; no extra calls. Documented uncached after-hours initial4call cost.


## 2026-11-28, channel-level replies

Owner asked why responses are threaded. Verified main unconditionally set
thread_ts to incoming thread root/message and Slack forwarded it, no option.
Branched independently from main; no overlapping reply-placement PR (EODHD#6
only touches same handler's unrelated provider title). Added channel default and
opt-in thread mode, validated at startup and handler construction. Extracted
real Slack sender for card/upload payload tests, omitting thread_ts entirely in
channel mode. No channel gate/scopes/provider/quota/dedup change.

Tests first failed without helper, then cover incoming root/thread placement,
both explicit modes/default, malformed config, and actual postMessage/uploadV2
payloads. Updated old handler assertions to new default; thread mode separately
retains parent/root semantics. Own adversarial review traced config -> handler
-> sender -> card/upload API; preserved threading for both paths, no broadcast.
Existing history test hardcoded /downloads now uses its test temp directory
(same portability fix as provider PR). No live Slack/deployment/merge.

## 2026-11-28, compact cards and instrument names

Owner requested price/chart/relative age without highlighted boilerplate, silent
unavailable mood, then full Name ($TICKER). Checked main/open PRs for overlap:
separate from provider#6 and placement#7; both will need integration verification.
Replaced verbose card with one plain-text section and escaped fallback. Daily/demo
identity and short stale/future markers retained, chart source labels unchanged.
Name from provider, Finnhub configured profile2 lookup cached24h and metered using
same persistent minute counter; ticker fallback on absent/failure/quota. EODHD
already has names; Alpha-only intentionally no extra search calls. Current general
terms checked, no mandatory per-private-message attribution clause found.

New compact tests failed before implementation; existing expected display tests
updated while quote/history/evaluator tests retain original data assertions.
Own review traced config -> name cache/quota -> quote -> summary/plain blocks and
chart; names plain text, escaped fallback, profile mismatch fails to ticker. No
raw timestamps or unavailable mood in cards. No real APIs/keys/Slack/deploy.

Rebased onto merged provider#6 and channel-placement#7. Retained delayed65min
regular-hours stale, outside-hours indicator and OLD DATA after3days. Sanitized
provider names control/bidi/whitespace with regression coverage. Direct question
no-trigger gets a brief answer; unavailable stays silent per owner pending any
approved exception. Chart upload title now also identifies Finnhub quote source
alongside Alpha daily series. Combined107tests pass.

## 2026-11-28, independent mood reactions

Owner requested over/back on any cashtag message separate from posted reply.
Checked current main/recent PRs: provider/placement/compact cards are separate,
no existing reaction implementation. Added optional reaction callback to handler,
using same quote/evaluator, original message timestamp, triggered verdict only.
Slack wrapper calls reactions.add, treats already_reacted as success, no raw
error logging. Custom over/back names configurable/validated, no emoji creation.

Tests first failed without helper. Own review traced message/channel filters ->
one quote -> mood -> reaction name+original timestamp -> failure isolation ->
card posting and dedup. Success dedup retained separately so card retry cannot
re-add reaction, each name once/message across symbols. Scope reactions:write
and existing message events documented; no reaction event subscription needed.
No live account/key/provider/Slack, permissions changes, deployment or merge.

Independent review found multi-ticker opposite moods ambiguous at message level.
Failing-first opposite-outcome two-ticker test, then limited reactions to exactly
one distinct extracted ticker; cards still post for all accepted symbols.

## 2026-11-28, stock/ETF full-name resolution

Owner requested fixing ticker-only fallback for ETFs and Alpha-only. Checked
fresh main e61ead0, open PRs and branches for overlap, no competing name fix.
Company profile2 cannot reliably name ETFs, replaced it with Finnhub exact symbol
search, same1name call/24h. Added Alpha standalone exact symbol+currency search,
1extra call/day sharing25/day budget. Mixed history path stays no-name-search.
Existing provider quota/locks/cache/pause/error rules retained; misses cached.
Old profile2 name cache versioned, existing quote cache expires normally.

New synthetic QQQ tests failed before implementation, then cover both provider
name resolution, cache/restart/request accounting, foreign/ambiguous match
rejection and quote-priority last quota slot. Own adversarial review traced
cached provider state -> name identity/currency -> quota reservation -> metadata
request -> name cache -> card plain-text sanitation. Names never invented,
missing name/rights/network/quota still ticker fallback, explicitly documented.
No keys/live provider requests, signup, purchase or deployment.114tests pass,
audit/demo/diff checks pass; exact-head CI/reviewer gate required before merge.

Independent review: Alpha name-only Note/Information should not stop all daily
quotes. Failing-first test, then keep name miss cached24h without global pause;
HTTP429still blocks shared quota. Test refreshes quote7h later with no repeated
metadata call. No live traffic, existing quote-endpoint notices still pause.

## 2026-11-28, bare Helsinki ticker mapping

Owner rejected suffix requirement and asked for static app/config lookup table.
Discarded dynamic-resolution prototype before PR. Checked fresh main e5ed005/open
PRs/branches, no overlapping bare routing. Bundled174CC0 source entries, actual
source date2025-09-20, retrieved2026-11-28, pinned revision in JSON/README. Official
Nasdaq US directory snapshot2026-11-27 21:34overlap SBI only; NOKIA Helsinki, NOK US.
Source age accepted by owner via parent, quote-time metadata validation unchanged.

Static startup Map plus validated optional override file, no resolution API calls.
Table hits canonical .HE, collision notice no quote/reaction, misses original US
path with persistent24h negative-result/error cache to stop repeated probes.
Explicit .HE/.US supported. EODHD-only uses static table without US provider.
Unchanged provider quotas/identity/cache, no live quotes or key. Offline refresh
script consumes reviewed downloads, computes collisions and validates rows.

New tests failed before routing implementation. Own review traced extraction ->
startup file/table -> canonical provider route -> same-feed quote/history/mood ->
card/upload/react and notice paths. Tested collision/explicit venue, source count,
no resolution methods called, restart negative cache, add/replace/remove override
and malformed config. Source stale/new OTC collisions remain a disclosed risk.
No deploy/merge; this PR explicitly waits for owner's new yes despite older grant.

Reviewer follow-up: transient thrown US errors no longer cached24h. Failing-first
recovering-provider test, then15min cooldown for thrown failures vs24h clean null.
Corrupt/future/old-schema miss entries discarded and persisted clean on next
lookup, never touch provider quota state. Tests for corrupt/future JSON and
recovery after15min pass. No merge, owner yes still required.

## 2026-11-28, offline reverse company-name lookup

Owner requested fuzzy name -> ticker via cashtags and app mention. Checked current
main bde5b56/open PRs, no overlap. Official Nasdaq US directory snapshot2026-11-27
21:34contains12762supported non-test symbols/names, extracted programmatically.
Combined with dated174HE table/overrides, no runtime metadata calls for resolution.
Exact tickers win, conservative threshold/top-two gap avoids close-match guessing,
full matched name visible, suggestions have no quote/reaction. New tests failed
without module first, now cover Apple/Marimekko, generic/tie/typo confidence, actual
handler mention/cashtag, no unmentioned prose, bot messages and event dedup.

Own adversarial review traced source index/normalization -> exact-ticker priority
-> ranked candidates -> route/source name -> quote/card/mood/reaction. Explicit
.US accepted by direct Finnhub/Alpha paths as well as Helsinki router. Only real
app_mention event enables mention parsing, channel gate retained. No bare prose
trigger, no bot/edit loop, one instrument+no suggestions required for reaction.
No account/key/API quotes, Slack scope mutation/install or deployment.130tests,
audit0/demo/diff pass, exact-head CI/reviewer required; NO MERGE until new user yes.

Reviewer findings fixed with failing-first regression tests. Unknown/OTC/new
cashtags preserve provider lookup; BRK-B -> BRK.B. Runtime name matching now
requires whole normalized core equality, no prefix/fuzzy auto-quote. Mention
ordinary words silent, exact-name ambiguity asks. Cashtag exact-name $apple still
works; question flag follows mapped route. Snapshot redistribution terms explicitly
unverified in README. Multiword multi-name requests out of scope.132tests pass.

Owner requested fuzzy restored after strict-name review fix. Added failing-first
brand/typo tests then conservative prefix/edit-distance with source security-type
ranking, exact name boost, clear lead requirement and ordinary-word silence.
Hand-curated Google/Alphabet Class A and Facebook aliases separately flagged,
source links included. Google never DEPW, hello/ping never MOMO/PASW, OTC/new
cashtags pass when low match. Appl deliberately asks due close alternatives.

Third reviewer safety pass: failing-first common-word regression and full297word
probe retained. Dictionary guard sourced/date recorded, ordinary mentions silent.
Mentions alias/exact or6+edit1only; cashtag4+edit1or unique first-wholeword5+prefix,
clear lead. Real ticker APLE/HELP priority confirmed by owner via parent, no Apple
substitution. Reviewed must-quote brand set aliases added from bundled full names.
138tests pass including297word probe both name modes and actual handler silence.

## 2026-11-28, daily chart ranges

Owner selected30ddefault,7d/3m/1y, explicitly removed1d. Stacked on name-lookup#12
pending merge, separate from renderer redesign. Range parsing -> provider options
through mixed/static router -> range-keyed EOD history -> coverage-checked chart
slice, full raw mood baseline untouched. Alpha compact100raw cache is a shared
superset,3mcoverage validated, US1y refused plainly. No live entitlement claim.

New tests failed before range forwarding/coverage logic; now parser/calendar month
clamp, actual handler7d/1y note, long-range insufficient history and persistent
EOD range cache/network budget tested. Own review traced all wrapper forwarding,
metadata/quote sharing, response start vs requested range, same-feed mood and
chart labels. Recent8adjustment ratios only for mood guard, chart span cannot
introduce old-split verdict changes. No provider quota increase, paid full history,
real keys/live calls, Slack/deploy/merge.136tests/audit/demo/diff pass, reviewer
and new owner yes needed. No chart redesign bundled.

Reviewer follow-ups:7d/30dshare EODHD :30dcache and40day baseline fetch. Failing
regression verified extra7dcall and short3day series mislabeled before fix. New
listing/incomplete7d/30dactual first date>3days after requestedstart is marked
partial with actual coverage in PNG/title/card, without claiming new-listing
cause as fact. Long-range coverage refusal unchanged. Local144tests green.
Midnight renderer: checked main/open PR overlap (only name/ranges), stacked on#13.
Failing-first dark-background/palette test, then own supersampled local renderer,
licensed bundled glyph masks, no added runtime deps. Existing flat-scale pixel
assertion updated to new plot bounds/palette, same padded mapping invariant.
144tests pass; audit0; diff clean. Inspected actual PNGs for traced demo, flat and
two-point data, no collisions at640x320. Trace is approximate synthetic fixture,
not a live quote/provider validation. No dates/data/provider logic changed.
Own review: fixed surface memory~6MB/output<=4.8MB,1kpoints cap, finite/nonnegative
values and dimensions guards preserved, zero span padded, endpoint/extrema rings,
linear area matches line segments (no fabricated smooth price extrema). Font
license included, no runtime font/Python dependency. Custom tiny dimensions are
bounded but are not readability recommendations. No merge/deploy authorization.
