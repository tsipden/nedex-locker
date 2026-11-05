# Audit / funding request drafts — DO NOT SEND until the repo is public and you approve

Intended repo: **https://github.com/tsipden/nedex-locker**

Tone: factual. No “first bot ever” or other hype claims.

---

## 1) Clarity Alliance — audit inquiry

**To:** (Clarity Alliance contact / intake email — confirm current address before sending)  
**Subject:** Clarity audit inquiry — NEDeX SIP-010 time-lock (Stacks)

Hello,

I'm requesting a quote and timeline for a Clarity smart-contract audit of a small SIP-010 time-lock intended for Stacks mainnet.

**Project:** NEDeX locker  
**Repo:** https://github.com/tsipden/nedex-locker  
**Language:** Clarity 2 / epoch 2.5  
**Status:** Not deployed. Unit tests included (`npm test`, 11 passing in our environment). Self-review notes are in the repo.

**In scope**
- `nedex-timelock.clar` — create-lock / claim by Bitcoin burn height; no admin withdraw
- `nedex-locker-v0.clar` — multi-lock registry with optional permanent burn (please advise if you recommend auditing this in the same engagement or separately)

**Out of scope for this engagement**
- Unimplemented v2 auto-renew ideas (`docs/V2_IDEAS.md`)
- Token bonding-curve / DEX contracts on stx.city
- Off-chain tip or airdrop tooling

**Planned use:** lock 20M NEDeX (of 1B fixed supply) across five burn-height schedules from bondai.btc after a clean review.

Please share availability, estimated effort/cost, and any intake checklist you need (threat model, freeze commit, etc.).

Thank you,  
Tscipden  
bondai.btc / https://nedex.vet

---

## 2) CoinFabrik — audit inquiry

**To:** (CoinFabrik Stacks / Clarity intake — confirm current address before sending)  
**Subject:** Stacks Clarity audit quote — NEDeX time-lock

Hello CoinFabrik team,

I'd like a quote for auditing a Clarity SIP-010 time-lock on Stacks.

- **Repository:** https://github.com/tsipden/nedex-locker  
- **Contracts:** `nedex-timelock.clar` (primary), optionally `nedex-locker-v0.clar`  
- **Not deployed** to mainnet; Clarinet/vitest suite included  
- **No upgrade/admin path** by design — review should assume immutability after deploy  

Please let me know scope options, timeline, and pricing. Happy to jump on a short call if useful.

Best regards,  
Tscipden  
bondai.btc · https://nedex.vet · https://github.com/tsipden/nedex-locker

---

## 3) Stacks Endowment — funding inquiry (audit support)

**To:** (Stacks Endowment / Foundation grants intake — confirm current program and address before sending)  
**Subject:** Inquiry: audit funding support for NEDeX SIP-010 time-lock (Clarity)

Hello,

I'm inquiring whether the Stacks Endowment (or related grant programs) can help fund an independent Clarity audit of a small, open-source SIP-010 time-lock.

**Repo:** https://github.com/tsipden/nedex-locker  
**What it does:** Escrows SIP-010 tokens until a Bitcoin burn height; only the beneficiary can claim afterward; no admin early withdraw.  
**Why it matters:** Intended to lock a portion of NEDeX creator supply on-chain in a publicly verifiable way. The token already exists on stx.city (bondai.btc deployer); the locker is **not** deployed yet.  
**Ask:** Guidance on whether audit co-funding or an audit voucher is available for small Clarity projects, and what materials you need for an application.

I am not claiming this is novel infrastructure for the whole ecosystem — only that a careful review before locking creator supply is the responsible path, and cost is a real constraint for a small project.

Thank you for any pointers to the right form or program officer.

Tscipden  
bondai.btc · https://nedex.vet · https://github.com/tsipden/nedex-locker
