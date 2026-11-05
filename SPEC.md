# SPEC — NEDeX locker (audit scope)

## Goals

1. Let a depositor escrow any SIP-010 FT until a chosen **Bitcoin burn height**.
2. Only the named **beneficiary** may claim after that height.
3. No contract owner, no pause, no admin rescue, no upgrade path.
4. Emit print events so indexers can track creates and claims.

## Contracts

### `nedex-timelock` (primary)

**Public**

| Function | Behavior |
|----------|----------|
| `create-lock(token, amount, unlock-burn-height, beneficiary)` | Transfers `amount` of `token` from `tx-sender` into the contract. Records lock. Returns `lock-id`. |
| `claim(lock-id, token)` | Beneficiary-only. After `burn-block-height >= unlock-burn-height`, marks claimed then transfers FT to beneficiary. |

**Read-only**

| Function | Behavior |
|----------|----------|
| `get-lock(lock-id)` | Optional lock record |
| `get-next-lock-id()` | Next id (starts at 1) |
| `get-max-lock-duration-blocks()` | `u2000000` |
| `is-unlocked(lock-id)` | True if exists, unclaimed, and burn height reached |
| `get-locks-for-depositor(who)` | Up to 50 lock ids |
| `get-locks-slice(start-id, count)` | Up to 20 consecutive lock records |

**Errors (uint):** 101 unlock not future · 102 zero amount · 103 unknown · 104 already claimed · 105 too early · 106 wrong token · 107 not beneficiary · 108 height too far · 109 overflow · 110 too many locks · 111 bad range

### `nedex-locker-v0` (secondary)

Same escrow model with `lock-tokens` / `claim`, plus `burn-lock` (permanent; status burned; tokens stay in contract). Status: `0` active, `1` claimed, `2` burned. Optional `label` buff(34). **No max-duration cap** in v0 (audit item).

## Invariants (intended)

1. **No early claim:** `claim` fails while `burn-block-height < unlock-burn-height`.
2. **Beneficiary only:** `tx-sender` must equal stored beneficiary.
3. **Token match:** claim token principal must equal stored token.
4. **Single claim:** claimed/closed locks cannot be claimed again.
5. **Future unlock on create:** unlock height must be strictly greater than current burn height.
6. **Duration bound (timelock only):** unlock ≤ burn-height + 2_000_000.
7. **Positive amount:** amount > 0.
8. **Conservation (happy path):** escrowed amount equals claimed amount; no minting in the locker.
9. **No admin path:** no privileged principal can move funds early.

## Threat model

| Threat | Mitigation / residual |
|--------|------------------------|
| Creator rugs via early unlock | No admin withdraw; only height + beneficiary |
| Double claim | Mark claimed before transfer (residual: failed transfer after mark can stick funds) |
| Wrong token claim | Principal equality check |
| Malicious SIP-010 reentrancy / lying balances | Clarity limits; still trust trait impl — prefer allowlisting NEDeX principal in a later version |
| Unlock height far in past/future abuse | Future check + max duration on timelock |
| Indexer confusion (Stacks vs Bitcoin height) | Docs + burn-block-height only |
| Depositor spam | Max 50 locks tracked per depositor on timelock |
| Permanent burn misuse (v0) | Only depositor pre-unlock or beneficiary post-unlock |

## Non-goals

- Yield, staking rewards, auto-renew (see `docs/V2_IDEAS.md`, out of scope)
- LP-adapter logic for Velar/ALEX/Bitflow
- Governance or upgradeability

## Test coverage (current)

Unit tests under `tests/` cover early reject, post-unlock claim, wrong beneficiary/token, already-claimed, schedule deltas for the planned ladder, locker-v0 lock/claim/burn. Target: **11/11 pass** via `npm test`.
