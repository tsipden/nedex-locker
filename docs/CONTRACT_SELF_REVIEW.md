# nedex-timelock — self-review & audit checklist (UNAITED)

## Mitigations already in code

- No contract-owner / admin withdraw path
- Unlock height must be strictly future and ≤ burn-height + 2_000_000
- Zero-amount rejected
- Claim marks `claimed` before FT transfer (blocks simple double-claim). A token `(err)` rolls that mark back.
- Create and claim require an exact SIP-010 balance delta of `amount`
- Deposit is direct-call only (`tx-sender` == `contract-caller`)
- Claim and `burn-lock` authorize `contract-caller`, not `tx-sender`
- Beneficiary cannot be the locker contract itself
- Claim requires matching token principal + beneficiary
- Depositor lock-id list capped at 50
- Events printed for indexers

## Residual risks / audit items

1. **Not audited** — treat as research until independent Clarity review.
2. **Token trait trust** — malicious SIP-010 could reenter or lie; prefer known NEDeX principal allowlist in a v1.1.
3. **Claim transfer `(err)` after `claimed=true`** — not sticky. Clarinet tests show the whole transaction rolls back and the same lock can be claimed later. A transfer that returns `(ok)` but does not credit the beneficiary is rejected by the balance check and also rolls back.
4. **No pause / no upgrade** — immutable; bugs are permanent (desired for trust, costly if wrong).
5. **Burn-height vs Stacks height confusion** — docs must stress Bitcoin burn blocks.
6. **MAX-LOCK-DURATION** — 230 months fits; changing constant later needs new deploy.
7. **Depositor list not pruned on claim** — historical ids remain (ok for audit trail; UI must check `claimed`).
8. **Fee / post-conditions** — callers must set SIP-010 post-conditions on create-lock and claim.
9. **Graduation / LP** — this locker does not wrap Velar/ALEX LP adapters yet (v0 sketch separate).
10. **Integer model** — schedule uses 144 blocks/day and 365.25-day years; real BTC block times vary.

## Recommended before mainnet

- External Clarity audit
- Property tests: claim idempotency, height bounds, random schedules
- Mainnet dry-run on testnet with mock FT matching 6 decimals
- Public verification page binding lock-ids ↔ nedex.json
