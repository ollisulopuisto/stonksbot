# Roadmap

- v1: fixture-only provider boundary, local PNG, explicit source/time labels,
  opt-in Slack adapter with allowlisted channels. No live service deployment.
- Decide data source, usage/display rights, audience and freshness model before
  current-price operation. Around50calls/day is the planning target, not a quota
  this prototype promises.
- Mood follow-up: on-demand card labels compare same-provider session return
  with mean absolute daily returns over 7 preceding trading sessions, default 3x,
  configurable 5..7 sessions / 2..3x, fixed 5% fallback for short/flat history.
  No background alerts or message emoji reactions. PR awaiting owner merge go.
- Add live Slack UI verification, exchange/timezone-aware stale rules, delivery
  retry state and persistence before claiming production readiness.

- Future idea from owner: express a mood answer as a Slack emoji reaction.
  Roadmap only, no implementation or reactions:write scope added.

- EODHD Helsinki .HE provider in PR: personal-only, free20calls/day, synthetic
  validation only; actual entitlement/account and exchange-calendar verification
  remain deployment work, no signup/paid plan or live requests performed.
