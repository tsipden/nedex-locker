# V2 ideas — auto-renew “mayhem mode” (NOT IN SCOPE FOR THIS AUDIT)

> **This file is a product sketch only.** There is **no implementation** in this
> repository. Auditors should **ignore** this document for the current review of
> `nedex-timelock` and `nedex-locker-v0`.

## Idea

A future locker mode where a user picks a lock length and may opt into
**auto-renewal** up to **230** times, earning a small reward from a public
**50M NEDeX rewards reserve** on each successful renewal. Tone similar to a
playful “mayhem mode” (inspired by pump.fun’s naming, not their code).

## Candidate lengths

| Length | Timing base | Notes |
|--------|-------------|--------|
| 230 **seconds** | Stacks blocks | Too short for Bitcoin burn blocks (~10 min); would need Stacks-block (or wall-clock via oracle) timing |
| 230 **minutes** | ~23 Bitcoin blocks *or* Stacks blocks | Borderline for burn-height granularity |
| 230 **hours** | Bitcoin burn (~1,380 blocks) | Fits current timelock model |
| 230 **days** | Bitcoin burn | Fits current model |
| 230 **months** | Bitcoin burn | Fits current model; near max-duration |

## Design notes (unresolved)

1. Short modes need **Stacks block** (or other) clocks; do not overload `burn-block-height`.
2. Reward per renewal must be capped so 50M / max renewals / expected users does not drain instantly.
3. Auto-renew should be **opt-in**, with a hard max of 230 renewals and a clear claim path if the reserve is empty.
4. Separate contract deploy from v1 timelock; do not bolt this onto the audited immutable locker without a new review.

## Status

Brainstorming only. Not scheduled for this audit package.
