# Roadmap

- v1: fixture-only provider boundary, local PNG, explicit source/time labels,
  opt-in Slack adapter with allowlisted channels. No live service deployment.
- Decide data source, usage/display rights, audience and freshness model before
  current-price operation. Around50calls/day is the planning target, not a quota
  this prototype promises.
- Owner asked for "It's over" and "We're back" and clarified this is an Odd Lots
  thing. Exact trigger behavior is not defined. Possible ticker mood labels on
  sharp drops/rebounds with configurable thresholds is an assistant hypothesis,
  NOT an approved specification. No automatic thresholds or alerts in v1.
- Add live Slack UI verification, exchange/timezone-aware stale rules, delivery
  retry state and persistence before claiming production readiness.
