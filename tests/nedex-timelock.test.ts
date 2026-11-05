import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const FT = "sip010-ft";
const FT_B = "sip010-ft-b";
const LOCK = "nedex-timelock";

/** Mainnet schedule deltas (Bitcoin blocks @ ~10min).
 * 230d / 230mo use approved absolute landmarks vs burn 974688:
 *   230d → unlock 1_000_000 (delta 25_312)
 *   230mo → unlock 2_000_000 (delta 1_025_312)
 */
const DELTA_230H = 1_380;
const DELTA_230D = 25_312;
const DELTA_1Y = 52_596;
const DELTA_2Y = 105_192;
const DELTA_230MO = 1_025_312;

const AMT_1M = 1_000_000_000_000n; // 1M * 1e6
const AMT_2M = 2_000_000_000_000n;
const AMT_3M = 3_000_000_000_000n;
const AMT_4M = 4_000_000_000_000n;
const AMT_10M = 10_000_000_000_000n;

function mintA(amount: number | bigint, to: string) {
  const { result } = simnet.callPublicFn(
    FT,
    "mint",
    [Cl.uint(amount), Cl.principal(to)],
    deployer
  );
  expect(result).toBeOk(Cl.bool(true));
}

function createLock(
  amount: number | bigint,
  unlock: number,
  beneficiary: string,
  sender: string
) {
  return simnet.callPublicFn(
    LOCK,
    "create-lock",
    [
      Cl.contractPrincipal(deployer, FT),
      Cl.uint(amount),
      Cl.uint(unlock),
      Cl.principal(beneficiary),
    ],
    sender
  );
}

describe("nedex-timelock core", () => {
  it("rejects early withdraw before unlock height", () => {
    mintA(1_000_000, wallet1);
    const unlock = simnet.burnBlockHeight + 10;
    expect(createLock(500_000, unlock, wallet1, wallet1).result).toBeOk(Cl.uint(1));
    const { result: early } = simnet.callPublicFn(
      LOCK,
      "claim",
      [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
      wallet1
    );
    expect(early).toBeErr(Cl.uint(105));
  });

  it("allows claim after unlock burn height", () => {
    mintA(2_000_000, wallet1);
    const unlock = simnet.burnBlockHeight + 5;
    expect(createLock(750_000, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    simnet.mineEmptyBurnBlocks(6);
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(1), Cl.contractPrincipal(deployer, FT)], wallet1)
        .result
    ).toBeErr(Cl.uint(107));
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(1), Cl.contractPrincipal(deployer, FT)], wallet2)
        .result
    ).toBeOk(Cl.uint(750_000));
  });

  it("supports multiple independent locks and depositor list", () => {
    mintA(5_000_000, wallet1);
    const u1 = simnet.burnBlockHeight + 3;
    const u2 = simnet.burnBlockHeight + 8;
    expect(createLock(100_000, u1, wallet1, wallet1).result).toBeOk(Cl.uint(1));
    expect(createLock(200_000, u2, wallet2, wallet1).result).toBeOk(Cl.uint(2));
    const ids = simnet.callReadOnlyFn(LOCK, "get-locks-for-depositor", [Cl.principal(wallet1)], wallet1);
    expect(ids.result).toBeList([Cl.uint(1), Cl.uint(2)]);
    const slice = simnet.callReadOnlyFn(LOCK, "get-locks-slice", [Cl.uint(1), Cl.uint(2)], wallet1);
    expect(slice.result).toBeOk(
      Cl.list([
        Cl.some(
          Cl.tuple({
            depositor: Cl.principal(wallet1),
            beneficiary: Cl.principal(wallet1),
            token: Cl.contractPrincipal(deployer, FT),
            amount: Cl.uint(100_000),
            "unlock-burn-height": Cl.uint(u1),
            claimed: Cl.bool(false),
          })
        ),
        Cl.some(
          Cl.tuple({
            depositor: Cl.principal(wallet1),
            beneficiary: Cl.principal(wallet2),
            token: Cl.contractPrincipal(deployer, FT),
            amount: Cl.uint(200_000),
            "unlock-burn-height": Cl.uint(u2),
            claimed: Cl.bool(false),
          })
        ),
      ])
    );
  });

  it("rejects claim with wrong token trait", () => {
    mintA(1_000_000, wallet1);
    const unlock = simnet.burnBlockHeight + 2;
    expect(createLock(50_000, unlock, wallet1, wallet1).result).toBeOk(Cl.uint(1));
    simnet.mineEmptyBurnBlocks(3);
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(1), Cl.contractPrincipal(deployer, FT_B)], wallet1)
        .result
    ).toBeErr(Cl.uint(106));
  });

  it("rejects lock with unlock height not in the future", () => {
    mintA(100_000, wallet1);
    expect(createLock(10_000, simnet.burnBlockHeight, wallet1, wallet1).result).toBeErr(
      Cl.uint(101)
    );
  });
});

describe("nedex-timelock harden", () => {
  it("rejects zero amount", () => {
    mintA(100_000, wallet1);
    expect(createLock(0, simnet.burnBlockHeight + 10, wallet1, wallet1).result).toBeErr(
      Cl.uint(102)
    );
  });

  it("rejects unlock height beyond max duration", () => {
    mintA(100_000, wallet1);
    const tooFar = simnet.burnBlockHeight + 2_000_000 + 1;
    expect(createLock(10_000, tooFar, wallet1, wallet1).result).toBeErr(Cl.uint(108));
  });

  it("rejects empty slice count and count>20", () => {
    expect(
      simnet.callReadOnlyFn(LOCK, "get-locks-slice", [Cl.uint(1), Cl.uint(0)], wallet1).result
    ).toBeErr(Cl.uint(111));
    expect(
      simnet.callReadOnlyFn(LOCK, "get-locks-slice", [Cl.uint(1), Cl.uint(21)], wallet1).result
    ).toBeErr(Cl.uint(111));
  });
});

describe("nedex-timelock creator ladder schedule", () => {
  it("locks full ladder incl. 230-month height; claims 230h; others stay locked", () => {
    // Mint full 20M NEDeX micro-units to depositor (bondai stand-in = wallet1)
    const total = AMT_1M + AMT_2M + AMT_3M + AMT_4M + AMT_10M;
    mintA(total, wallet1);

    const base = simnet.burnBlockHeight;
    const u230h = base + DELTA_230H;
    const u230d = base + DELTA_230D;
    const u1y = base + DELTA_1Y;
    const u2y = base + DELTA_2Y;
    const u230mo = base + DELTA_230MO;

    // Beneficiary = bondai stand-in wallet2 (tests use wallet2 as bondai)
    const bondai = wallet2;

    // Original ladder + height tweaks; signing order (same-time session):
    // 10M@230mo → 4M@2y → 3M@1y → 2M@230d → 1M@230h
    expect(createLock(AMT_10M, u230mo, bondai, wallet1).result).toBeOk(Cl.uint(1));
    expect(createLock(AMT_4M, u2y, bondai, wallet1).result).toBeOk(Cl.uint(2));
    expect(createLock(AMT_3M, u1y, bondai, wallet1).result).toBeOk(Cl.uint(3));
    expect(createLock(AMT_2M, u230d, bondai, wallet1).result).toBeOk(Cl.uint(4));
    expect(createLock(AMT_1M, u230h, bondai, wallet1).result).toBeOk(Cl.uint(5));

    // Very long height stored correctly (lock id 1 = first signed = 230mo)
    const longLock = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1);
    expect(longLock.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(bondai),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(AMT_10M),
        "unlock-burn-height": Cl.uint(u230mo),
        claimed: Cl.bool(false),
      })
    );
    expect(DELTA_230MO).toBeGreaterThan(1_000_000);
    expect(u230mo - base).toBe(DELTA_230MO);

    // Before any mining: none unlocked (id 5 = shortest)
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(5)], wallet1).result).toBeBool(
      false
    );

    // Mine just past 230 hours
    simnet.mineEmptyBurnBlocks(DELTA_230H + 1);

    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(5)], wallet1).result).toBeBool(
      true
    );
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(4)], wallet1).result).toBeBool(
      false
    );
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );

    // Claim short ladder rung (lock id 5 = 1M @ 230h)
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(5), Cl.contractPrincipal(deployer, FT)], bondai)
        .result
    ).toBeOk(Cl.uint(AMT_1M));

    // Longer rungs still too early
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(4), Cl.contractPrincipal(deployer, FT)], bondai)
        .result
    ).toBeErr(Cl.uint(105));
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(1), Cl.contractPrincipal(deployer, FT)], bondai)
        .result
    ).toBeErr(Cl.uint(105));

    // Double-claim rejected
    expect(
      simnet.callPublicFn(LOCK, "claim", [Cl.uint(5), Cl.contractPrincipal(deployer, FT)], bondai)
        .result
    ).toBeErr(Cl.uint(104));
  });
});
