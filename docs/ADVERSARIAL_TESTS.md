# Adversarial Clarinet tests

`tests/adversarial.test.ts` plus the helper contracts under `contracts/test-*.clar`.
`npm test` runs these together with the original 11 timelock and locker-v0 tests.
All **45** tests pass after the fixes below.

The "Pre-fix" column is what the first run showed against the unpatched contracts.
"Pass" means the safe behavior already held. "Fail" means the assertion of safe behavior failed and the patch in this change set makes it pass.

| # | Class | Tests | Pre-fix | After fix | Bug |
|---|--------|--------|---------|-----------|-----|
| 1 | Permission leftover that undoes a lock (CityCoins `fund-from-treasury` undid a recall) | extension `fund-from-treasury` / `fund-from-locker` / `recall-claim`; public ABI is only `create-lock`+`claim` and `lock-tokens`+`claim`+`burn-lock` | Pass | Pass | None. Nothing in either contract moves escrow except `claim` after unlock. |
| 2 | No recovery / stuck funds | token `(err u777)` on claim rolls back; self-beneficiary rejected; depositor has no early exit | Fail on self-beneficiary | Pass | **Low.** Naming the locker as beneficiary made the timelock unclaimable forever (no burn, no admin). Rejected with `u114` / `u210`. An `(err)` from `transfer` does **not** stick `claimed`; that self-review note was wrong. |
| 3 | `tx-sender` vs `contract-caller`, including a malicious intermediary | `test-malicious-caller` pull / burn / force-claim; vault plain call and `as-contract`; five locks from `test-batch-lock` | Fail | Pass | **High.** See bugs 1–3 below. |
| 4 | Re-init, double create, claim replay | second create keeps lock 1; no `initialize`; second claim and second burn fail | Pass | Pass | None. Ids only move forward. |
| 5 | Burn-height boundaries at 1,000,000 and 2,000,000 | closed at current height; open at the exact Clarity height; inclusive max duration `+2_000_000` | Pass (contract) | Pass | None. Comparison is `>=` on `burn-block-height`. Closed at `H-1`, claimable at `H`, including `H = 1_000_000` and `H = 2_000_000`. `+2_000_000` is accepted and `+2_000_001` is `u108`. |
| 6 | Wrong or fake SIP-010 trait | wrong trait principal; no-op; short (`amount-1`); redirect on claim; lying delta | Fail on no-op, short, redirect | Pass | **Medium.** Bug 4 below. A token that lies in `get-balance` by exactly `amount` is still trusted (low residual, not patched). |
| 7 | Zero, dust, griefing | zero does not consume an id; amount `1` round-trips; 51st timelock is `u110` and does not take the token | Pass | Pass | None. |
| 8 | Beneficiary / principal edges | depositor and stranger cannot claim; fresh principal can receive; beneficiary tuple is unchanged by a later lock | Pass, except self-beneficiary (class 2) | Pass | Self-beneficiary is bug 5. |
| 9 | Partial claims and rounding | locks of `7` and `3`; claim pays exactly one lock | Pass | Pass | No division. No partial-claim argument. No cross-lock remainder. |
| 10 | Five-lock registry | one transaction creates five timelock locks; five locker-v0 locks; burn of the middle lock | Fail on who was charged | Pass | The batch charged `tx-sender` instead of the batcher contract (bug 1). After the fix each lock unlocks on its own height and balances match the sum. |
| 11 | Permanent burn | role matrix before and after unlock; second burn; extension cannot pull burned tokens | Pass for direct calls | Pass | Direct burn rules were already right. Intermediary and callback burn were bug 2. Burned tokens stay in the contract. |
| 12 | Unchecked responses and `as-contract` | token `(err)` on create leaves no lock; claim credits only the beneficiary; callback burn; same-function reentry | Fail on callback burn | Pass | `try!` already propagated token errors. `as-contract` on claim already paid the beneficiary from the contract. Callback burn was bug 2. Same-function reentry into `create-lock` aborts with `CircularReference` and rolls back. |

## Bugs fixed

### 1. High — intermediary can escrow the signer's tokens

`create-lock` and `lock-tokens` called `transfer` from `tx-sender` and recorded `tx-sender` as depositor. A contract the signer calls can set the beneficiary to the attacker and the unlock height out to the max duration (~2,000,000 burn blocks on the timelock). The pre-fix batch test moved the signer's full balance and left the batcher's balance untouched.

Fix: both entry points require `tx-sender == contract-caller` (`u115` / `u211`) before any transfer. A contract that holds the tokens must call through `as-contract`, which makes it the signer. `test-batch-lock` does that. The five locks then belong to the batcher, and the EOA balance does not move.

### 2. High — `burn-lock` authorized `tx-sender`

Two paths, both permanent (`status = u2`, no withdraw):

- **Intermediary.** The signer calls an attacker contract that calls `burn-lock`. No SIP-010 post-condition fires, because burn does not transfer. Pre-fix the call returned `(ok true)`.
- **Cross-function callback.** `create-lock`'s token transfer is not inside `as-contract`, so `tx-sender` inside the token is still the signer. A hostile SIP-010 can call `burn-lock` on another lock that signer is allowed to burn. The pre-fix trace returned `(ok true)` and printed `nedex-locker-burn` with `by` equal to the signer. Same-function reentry into `create-lock` does **not** have this hole: the VM aborts with `CircularReference` and rolls the transaction back, including any burn attempted earlier in the same call.

Fix: `burn-lock` and `claim` authorize `contract-caller`. The token and the intermediary are not the depositor or the beneficiary, so both paths return `u200` / `u107` / `u207`.

### 3. Medium — `claim` authorized `tx-sender`

A contract the beneficiary invoked could force the claim. A contract beneficiary could not claim with an ordinary call, only by wrapping the call in `as-contract`. Authorizing `contract-caller` blocks the intermediary and lets a vault claim with a plain call. The vault's `as-contract` path still works.

### 4. Medium — SIP-010 balance was not checked

`transfer` returning `(ok true)` was enough to record a lock or to mark it claimed.

- No-op transfer: lock recorded, contract balance unchanged.
- Short transfer (`amount - 1` delivered): the registry is under-collateralized. A later claim of the recorded amount can take another depositor's tokens of the same FT.
- Redirect on claim: tokens sent to an attacker, `(ok amount)` returned, lock marked claimed.

Fix: create requires the contract balance to increase by exactly `amount`. Claim requires the beneficiary balance to increase by exactly `amount` (`u113` / `u209`). The failure rolls back, so `claimed` does not stick and the redirected transfer does not keep the attacker's credit. The same check rejects a transfer that delivers `amount` twice.

Residual, not patched: a token whose `get-balance` lies by exactly that delta (mode `u7` in `test-misbehaving-ft`) still passes. It cannot move a different token's escrow, because claim is bound to `contract-of` the trait used at create. Closing this means an allowlist, which these generic lockers do not have.

### 5. Low — beneficiary equal to the locker

Timelock has no burn. If `beneficiary` is the timelock principal, no external call has `contract-caller` equal to that principal, so the tokens cannot move. Create now rejects that beneficiary (`u114` on the timelock, `u210` on locker-v0).

## Accepted residuals

- **Lying SIP-010** (bug 4 residual). Test: "still trusts a token that lies about balances by exactly the claimed delta". `get-total-supply` stays `u0` while create and claim both return `(ok ...)`.
- **`nedex-locker-v0` has no max-duration cap.** A height the timelock rejects (`burn + 2_000_001`) is stored. Called out in `SPEC.md`. The timelock cap is unchanged.
- **No early exit by design.** The depositor cannot take tokens back before unlock. That is the lock. The CityCoins class would be an extra public function that undoes it; there isn't one.

## Error codes added

| Contract | Code | Meaning |
|----------|------|---------|
| `nedex-timelock` | `u113` | SIP-010 balance did not change by `amount` |
| `nedex-timelock` | `u114` | beneficiary is the timelock contract |
| `nedex-timelock` | `u115` | `tx-sender` is not `contract-caller` |
| `nedex-locker-v0` | `u209` | SIP-010 balance did not change by `amount` |
| `nedex-locker-v0` | `u210` | beneficiary is the locker-v0 contract |
| `nedex-locker-v0` | `u211` | `tx-sender` is not `contract-caller` |
