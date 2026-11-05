# Stacks forum post draft — DO NOT POST until the repo is public

**Suggested venue:** forum.stacks.org → Developers / Smart Contracts (or the current Clarity audit / review category)  
**Suggested title:** Community review request: NEDeX SIP-010 time-lock (unaudited, not deployed)

---

Hello —

I'm looking for a **community review** of a small Clarity SIP-010 time-lock before any mainnet deploy.

## Context

**NEDeX** is a fixed-supply SIP-010 token (NED2GSK path on stx.city), launched from **bondai.btc**. It has not been rugged. The plan is to lock **20M** creator tokens across five Bitcoin-burn-height locks (same signing session), then keep the locker immutable (no admin early withdraw).

This package was assembled with help from an agent. I (the human owner) will be the one who deploys and signs from bondai if/when an audit path is clear. **Nothing is on mainnet yet.**

## Repo

https://github.com/tsipden/nedex-locker

## In scope

- `contracts/nedex-timelock.clar` (primary)
- `contracts/nedex-locker-v0.clar` (general locker + optional permanent burn)
- Unit tests (`npm test` → 11 passing in our environment)
- `SPEC.md`, `docs/CONTRACT_SELF_REVIEW.md`, lock plan docs

## Out of scope

- `docs/V2_IDEAS.md` (auto-renew “mayhem mode” sketch only — not implemented)
- Tip pilots, bridging, site hosting

## What I'd value from reviewers

1. Double-claim / failed-transfer tradeoff on `claim` (we mark claimed before transfer).
2. Trust assumptions on the SIP-010 trait passed by the caller.
3. Burn-height bounds and overflow checks.
4. Anything that would let funds move before unlock or to the wrong principal.
5. Whether `nedex-locker-v0` should stay in the first audit or be deferred.

## Honest limits

- Not a firm audit substitute.
- High creator concentration and thin bonding-curve liquidity remain separate risks.
- Dates on the lock schedule assume ~10 min/Bitcoin block and will drift.

Happy to answer questions in-thread. Thank you for any review time.

— Tscipden / bondai.btc
