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
