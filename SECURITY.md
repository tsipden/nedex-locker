# Security policy

## Status

**Unaudited.** Do not deposit mainnet funds into these contracts until an
independent Clarity review is complete and findings are addressed.

This repository is a public audit package for community and firm review.

## In scope (this package)

- `contracts/nedex-timelock.clar` — primary SIP-010 Bitcoin-burn-height time-lock
- `contracts/nedex-locker-v0.clar` — general locker v0 (optional permanent burn path)
- Supporting SIP-010 trait and mock FTs used only by unit tests
- Unit tests under `tests/`
- Lock plan and self-review under `docs/`

## Out of scope

- `docs/V2_IDEAS.md` (auto-renew “mayhem mode” sketch — not implemented)
- Any mainnet deploy, tip wave, or token economics outside the locker code
- The NEDeX bonding-curve / DEX contracts on stx.city (separate deployers)

## Reporting a vulnerability

Please email the maintainer privately before public disclosure:

- Preferred: open a **private** security advisory on this GitHub repository once it is live, or email the address listed on https://nedex.vet when published.
- Include: affected function, reproduction steps on Clarinet/simnet if possible, and impact.

We will acknowledge within a few business days when reachable.

## Known residual risks (from self-review)

See `docs/CONTRACT_SELF_REVIEW.md`. Highlights:

1. Claim marks `claimed` before the FT transfer (double-claim safety vs stuck-funds tradeoff).
2. Trust in the SIP-010 trait implementation passed by the caller.
3. No pause / upgrade path (immutable by design).
4. Unlock heights use **Bitcoin burn blocks**, not Stacks block height.
5. Depositor lock-id list capped at 50; not pruned after claim.

## Keys

This repository must never contain private keys, mnemonics, or `.env` secrets.
bondai.btc signing stays with the human owner in Leather / Xverse.
