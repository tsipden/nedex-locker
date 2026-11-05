# NEDeX — public info

**Updated:** 2026-11-05 ~11:36 AM America/Chicago  
**Machine-readable:** [nedex.json](./nedex.json) (planned `https://nedex.vet/i`)

## Contracts

| Item | Value |
|------|-------|
| Token | `SP1KNRNZET8ZC5Q9P6F1FFW8YQH45CKMNY132B36S.ned2gsk-bonding-curve` |
| Asset | `…::NEDeX` |
| Curve DEX | `…ned2gsk-dex` |
| Decimals | 6 |
| Deployer | `bondai.btc` |
| Total supply | **1,000,000,000** (fixed; no mint) |

## Trade

**Only** stx.city bonding curve today (~21% to graduation). No Bitflow/Velar/ALEX pool yet.

## No strings attached

Holders/agents may **hold, trade, send, tip, sell, or ignore**. No reimbursement. Not an investment / yield product.

## Tip pilot

Memo: `nedex.vet/i`. Distributor (planned): side `SP1B9AJ9MBK563WDYVBN06ZFSY4498FP4X5RKASPM`. Audit: `../data/audit/`. **No broadcast yet.**

## Creator locks (planned, same-time, original ladder + height tweaks)

Ref burn **974688**. Recompute non-landmark unlocks from live tip before signing. Beneficiary bondai.  
Signing order: 10M@230mo → 4M@2y → 3M@1y → 2M@230d → 1M@230h.

| Lock | Amount | Unlock block | Est. date (America/Chicago) | Weekday |
|------|--------|--------------|-----------------------------|---------|
| L1 230mo | **10M** | **2,000,000** ★ | 2046-05-04 | Friday |
| L2 2y | **4M** | 1079880 | 2028-11-04 | Saturday |
| L3 1y | **3M** | 1027284 | 2027-11-05 | Friday (1y anniversary) |
| L4 230d | **2M** | **1,000,000** ★ | 2027-04-30 | Friday |
| L5 230h | **1M** | 976068 | 2026-11-15 | Sunday |
| **Total** | **20M** | | | |

★ = absolute publicity heights (approved). L3 keeps the clean anniversary story. Full plan: `../docs/LOCK_PLAN.md`.

## Risks

Unaudited locker; thin curve; high creator concentration; can go to zero.

## Verify

Hiro FT metadata/holders; curve read-onlys; after deploy `get-lock` / `get-locks-for-depositor`; tip memos `nedex.vet/i`.
