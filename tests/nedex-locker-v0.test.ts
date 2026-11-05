import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const FT = "sip010-ft";
const LOCKER = "nedex-locker-v0";

describe("nedex-locker-v0 sketch", () => {
  it("locks, rejects early claim, claims after unlock", () => {
    simnet.callPublicFn(FT, "mint", [Cl.uint(1_000_000), Cl.principal(wallet1)], deployer);
    const unlock = simnet.burnBlockHeight + 4;
    const label = Cl.bufferFromAscii("lp-velar-demo");
    const { result: lockRes } = simnet.callPublicFn(
      LOCKER,
      "lock-tokens",
      [
        Cl.contractPrincipal(deployer, FT),
        Cl.uint(400_000),
        Cl.uint(unlock),
        Cl.principal(wallet2),
        label,
      ],
      wallet1
    );
    expect(lockRes).toBeOk(Cl.uint(1));

    const { result: early } = simnet.callPublicFn(
      LOCKER,
      "claim",
      [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
      wallet2
    );
    expect(early).toBeErr(Cl.uint(205));

    simnet.mineEmptyBurnBlocks(5);
    const { result: claim } = simnet.callPublicFn(
      LOCKER,
      "claim",
      [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
      wallet2
    );
    expect(claim).toBeOk(Cl.uint(400_000));
  });

  it("allows depositor permanent burn before unlock", () => {
    simnet.callPublicFn(FT, "mint", [Cl.uint(500_000), Cl.principal(wallet1)], deployer);
    const unlock = simnet.burnBlockHeight + 20;
    const { result: lockRes } = simnet.callPublicFn(
      LOCKER,
      "lock-tokens",
      [
        Cl.contractPrincipal(deployer, FT),
        Cl.uint(100_000),
        Cl.uint(unlock),
        Cl.principal(wallet2),
        Cl.bufferFromAscii("burn-me"),
      ],
      wallet1
    );
    expect(lockRes).toBeOk(Cl.uint(1));

    const { result: burn } = simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet1);
    expect(burn).toBeOk(Cl.bool(true));

    simnet.mineEmptyBurnBlocks(25);
    const { result: claim } = simnet.callPublicFn(
      LOCKER,
      "claim",
      [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
      wallet2
    );
    expect(claim).toBeErr(Cl.uint(204)); // ERR-ALREADY-CLOSED
  });
});
