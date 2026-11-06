# NEDeX locker — public audit package

Clarity SIP-010 time-lock contracts for **NEDeX** (ticker path **NED2GSK** on [stx.city](https://stx.city)), launched from **bondai.btc**. The creator has not rugged the token. This package is for **independent review before any mainnet deploy**.

**Status:** research / pilot. **Not audited. Not deployed.** Do not send mainnet funds here yet.

Intended public repo: `https://github.com/tsipden/nedex-locker`  
Info (planned): https://nedex.vet/i · Machine copy: `public/nedex.json`

## What this is

| Contract | Role |
|----------|------|
| `nedex-timelock.clar` | Primary creator lock: escrow SIP-010 until a **Bitcoin burn height**; beneficiary claims after. No admin early withdraw. |
| `nedex-locker-v0.clar` | General multi-lock registry with optional permanent burn. Same no-admin model. |
| `sip-010-trait.clar` + mock FTs | Trait + test doubles only. |

## Planned creator lock ladder (not executed)

All five locks are created **together** in one signing session from bondai.  
**Beneficiary:** `SP1KNRNZET8ZC5Q9P6F1FFW8YQH45CKMNY132B36S`  
**Token:** `SP1KNRNZET8ZC5Q9P6F1FFW8YQH45CKMNY132B36S.ned2gsk-bonding-curve`  
Heights are **Bitcoin burn blocks**. Dates assume ~10 min/block from ref burn **974688** (2026-11-05, America/Chicago) and will move with real block times.

| Amount | Duration | Unlock burn block | Approx. unlock (America/Chicago) |
|--------|----------|-------------------|----------------------------------|
| 10,000,000 | 230 months | **2,000,000** | 2046-05-04 |
| 4,000,000 | 2 years | **1,079,880** | 2028-11-04 |
| 3,000,000 | 1 year | **1,027,284** | 2027-11-05 |
| 2,000,000 | 230 days | **1,000,000** | 2027-04-30 |
| 1,000,000 | 230 hours | **976,068** | 2026-11-15 |
| **20,000,000** total | | | |

Signing order (activation order): 10M → 4M → 3M → 2M → 1M.  
Full plan: `docs/LOCK_PLAN.md` · JSON: `docs/LOCK_PLAN.json` · Timeline notes: `docs/UNLOCK_TIMELINE.md`.

## How to run the tests

Requires Node.js 20+ and npm.

```bash
npm ci
npm test
```

`npm test` runs the original timelock and locker-v0 cases and the adversarial suite in `tests/adversarial.test.ts`. Results by bug class: [`docs/ADVERSARIAL_TESTS.md`](docs/ADVERSARIAL_TESTS.md). Clarinet SDK / simnet is pulled via `@stacks/clarinet-sdk` and `vitest-environment-clarinet`.

## Spec & security

- Functional spec, invariants, threat model: [`SPEC.md`](./SPEC.md)
- Security policy / reporting: [`SECURITY.md`](./SECURITY.md)
- Author self-review checklist: [`docs/CONTRACT_SELF_REVIEW.md`](./docs/CONTRACT_SELF_REVIEW.md)
- License: MIT ([`LICENSE`](./LICENSE))

## Out of scope for this audit

- [`docs/V2_IDEAS.md`](./docs/V2_IDEAS.md) — auto-renew “mayhem mode” sketch only; **not implemented**
- Tip / airdrop pilots, bridging, and site hosting
- The live stx.city bonding-curve contracts

## Honest limits

- Bot-assembled research code; human signs any mainnet action from bondai.
- Losses and bugs are possible. Immutable contracts have no upgrade escape.
- Public community review is welcome; a paid firm audit is still recommended before locking meaningful supply.
