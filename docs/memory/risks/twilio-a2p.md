# Risks — Twilio A2P 10DLC

## Open

### A2P 10DLC brand + campaign registration
**Risk:** US carriers require Application-to-Person (A2P) messaging to register a brand and per-use-case campaign. Registration takes ~2 weeks external (brand review + campaign review). Unregistered numbers get heavily throttled or blocked outright.
**Owner:** Me + Twilio review process.
**Trigger:** Brand approved → campaign approved → number linked.
**Blocks:** M8 SMS features.
**Opened:** 2026-04-21.
**Status:** Open. Must kick off at the start of M8 day 0 to hit launch.

### Consent + opt-out (TCPA)
**Risk:** US SMS marketing rules: explicit consent, STOP keyword handling, required consent language in signup UI. Violations are per-message statutory damages ($500–$1500 per recipient).
**Owner:** Me + legal.
**Trigger:** First SMS sent in production.
**Blocks:** M8 launch.
**Mitigations:**
1. SMS signup UI shows "By subscribing, you agree to receive auction alerts from <house>. Reply STOP to unsubscribe. Msg rates may apply."
2. Twilio inbound webhook → mark subscriber opted-out on STOP.
3. Never send SMS to a user who isn't a subscriber OR a buyer who opted in at checkout.
**Status:** Open. Ship with copy + STOP handler in M8.

### Double opt-in?
**Risk:** Single opt-in (one checkbox) is legal in the US but some states / carriers prefer confirmed opt-in. Double opt-in reduces spam complaint risk.
**Owner:** Me.
**Trigger:** TBD; not blocking.
**Blocks:** Nothing.
**Status:** Deferred. Ship single opt-in for v1.

---

## Archive

_(none)_
