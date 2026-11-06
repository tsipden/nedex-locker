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
| `create-lock(token, amount, unlock-burn-height, beneficiary)` | Direct call only (`tx-sender` == `contract-caller`). Transfers `amount` from that caller into the contract and requires the contract's SIP-010 balance to increase by exactly `amount`. Records lock. Returns `lock-id`. |
| `claim(lock-id, token)` | Direct caller must be the beneficiary (`contract-caller`). After `burn-block-height >= unlock-burn-height`, marks claimed, transfers the full amount, and requires the beneficiary balance to increase by exactly `amount`. |

**Read-only**

| Function | Behavior |
|----------|----------|
| `get-lock(lock-id)` | Optional lock record |
| `get-next-lock-id()` | Next id (starts at 1) |
| `get-max-lock-duration-blocks()` | `u2000000` |
| `is-unlocked(lock-id)` | True if exists, unclaimed, and burn height reached |
| `get-locks-for-depositor(who)` | Up to 50 lock ids |
| `get-locks-slice(start-id, count)` | Up to 20 consecutive lock records |

**Errors (uint):** 101 unlock not future · 102 zero amount · 103 unknown · 104 already claimed · 105 too early · 106 wrong token · 107 not beneficiary · 108 height too far · 109 overflow · 110 too many locks · 111 bad range · 113 balance delta mismatch · 114 beneficiary is this contract · 115 caller is not the direct signer

### `nedex-locker-v0` (secondary)

Same escrow model with `lock-tokens` / `claim`, plus `burn-lock` (permanent; status burned; tokens stay in contract). Status: `0` active, `1` claimed, `2` burned. Optional `label` buff(34). **No max-duration cap** in v0 (audit item). `lock-tokens` uses the same direct-call and exact-balance rules. Extra errors: 209 balance delta · 210 beneficiary is this contract · 211 not a direct call. `claim` authorizes `contract-caller`. `burn-lock` authorizes `contract-caller` (depositor before unlock, beneficiary after).

## Invariants (intended)

1. **No early claim:** `claim` fails while `burn-block-height < unlock-burn-height`.
2. **Beneficiary only:** `contract-caller` must equal the stored beneficiary. A direct wallet claim has `contract-caller == tx-sender`.
3. **Token match:** claim token principal must equal stored token.
4. **Single claim:** claimed/closed locks cannot be claimed again.
5. **Future unlock on create:** unlock height must be strictly greater than current burn height.
6. **Duration bound (timelock only):** unlock ≤ burn-height + 2_000_000.
7. **Positive amount:** amount > 0.
8. **Conservation (happy path):** escrowed amount equals claimed amount; no minting in the locker. The contract's token balance must rise by `amount` on create, and the beneficiary's balance must rise by `amount` on claim.
9. **No admin path:** no privileged principal can move funds early.
10. **Direct deposit:** `create-lock` / `lock-tokens` reject a call where `tx-sender` is not `contract-caller`, so an intermediary cannot escrow the signer's tokens.

## Threat model

| Threat | Mitigation / residual |
|--------|------------------------|
| Creator rugs via early unlock | No admin withdraw; only height + beneficiary |
| Double claim | Mark claimed before transfer. An `(err)` from the token rolls the mark back. A transfer that returns `(ok)` without paying the beneficiary is rejected by the balance check and rolled back. |
| Wrong token claim | Principal equality check |
| Intermediary pulls signer tokens | Deposit requires `tx-sender == contract-caller` |
| Callback burn of another lock | `burn-lock` / `claim` authorize `contract-caller`. Same-function reentry into `create-lock` aborts in the VM. |
| Malicious SIP-010 lying balances | A token that reports a matching `get-balance` delta without moving a real asset is still trusted. Allowlisting the NEDeX principal is a later version. |
| Unlock height far in past/future abuse | Future check + max duration on timelock |
| Indexer confusion (Stacks vs Bitcoin height) | Docs + burn-block-height only |
| Depositor spam | Max 50 locks tracked per depositor on timelock |
| Permanent burn misuse (v0) | Only depositor pre-unlock or beneficiary post-unlock |

## Non-goals

- Yield, staking rewards, auto-renew (see `docs/V2_IDEAS.md`, out of scope)
- LP-adapter logic for Velar/ALEX/Bitflow
- Governance or upgradeability

## Test coverage (current)

`npm test` runs the original timelock and locker-v0 cases plus `tests/adversarial.test.ts`. Class-by-class results: [`docs/ADVERSARIAL_TESTS.md`](docs/ADVERSARIAL_TESTS.md).
