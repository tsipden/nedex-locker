# NEDeX creator lock plan v3 — original ladder + height tweaks (NOT executed)

**Same-time signing:** create all five locks in one session, in the order below.  
**Ref burn height:** 974688 (2026-11-05 11:32 AM America/Chicago, Hiro live tip)  
**Beneficiary / sender:** `SP1KNRNZET8ZC5Q9P6F1FFW8YQH45CKMNY132B36S`  
**Token:** `…ned2gsk-bonding-curve`  
**Supersedes:** v2 reversed ladder — **rejected**. Amounts are the original ladder.

Before signing non-landmark locks: `unlock = live_burn_height + delta`.  
Landmark locks (1,000,000 / 2,000,000) stay absolute.

## Schedule (signing order = activation order)

| ID | Amount | Duration | Delta | Unlock block | Est. date (America/Chicago) | Weekday |
|----|--------|----------|-------|--------------|-----------------------------|----------|
| L1 | **10,000,000** | 230 months | 1,025,312 | **2,000,000** ★ | 2046-05-04 ~4:52 PM | **Friday** |
| L2 | **4,000,000** | 2 years | 105,192 | **1079880** | 2028-11-04 ~11:32 PM | **Saturday** |
| L3 | **3,000,000** | 1 year | 52,596 | **1027284** | 2027-11-05 ~5:32 PM | **Friday** |
| L4 | **2,000,000** | 230 days | 25,312 | **1,000,000** ★ | 2027-04-30 ~6:12 AM | **Friday** |
| L5 | **1,000,000** | 230 hours | 1,380 | **976068** | 2026-11-15 ~1:32 AM | **Sunday** |
| **Sum** | **20,000,000** | | | | | |

★ = approved publicity height tweak (absolute Bitcoin burn height).

## Applied tweaks

| Lock | Tweak | vs natural duration |
|------|-------|---------------------|
| L4 230d | Unlock at burn **1,000,000** | ~54 days **earlier** than +33,120 |
| L1 230mo | Unlock at burn **2,000,000** | ~4 months **later** than +1,008,090 |

## Coincidences

| Pattern | Detail |
|---------|--------|
| Anniversaries | L3 = exact **1-year** from ref; L2 ≈ exact **2-year** from ref (Sat 2028-11-04) |
| Shared weekday | L1, L3 & L4 all **Friday** |
| Round blocks | L4 = **1,000,000**; L1 = **2,000,000** |
| BTC halving #5 | At burn **1,050,000** (~2028); L2 is **+29,880 blocks after** (~207.5 days later) |
| PoX (~2100-block cycles) | None exact |

## Unlock chronology (by date, not sign order)

1. L5 1M @ 976068 — 2026-11-15  
2. L4 2M @ 1,000,000 — 2027-04-30  
3. L3 3M @ 1027284 — 2027-11-05  
4. L2 4M @ 1079880 — 2028-11-04  
5. L1 10M @ 2,000,000 — 2046-05-04  

Machine copy + create-lock args: `LOCK_PLAN.json`.
