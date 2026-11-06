import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

/**
 * Adversarial coverage for bug classes seen in other Clarity audits.
 * Expectations are the safe behavior. A failure means the locker still
 * allows that class of mistake.
 */

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const FT = "sip010-ft";
const FT_B = "sip010-ft-b";
const LOCK = "nedex-timelock";
const LOCKER = "nedex-locker-v0";
const BAD = "test-misbehaving-ft";
const EVIL = "test-malicious-caller";
const EXT = "test-undo-extension";
const VAULT = "test-beneficiary-vault";
const BATCH = "test-batch-lock";

const ERR_NOT_FUTURE = 101;
const ERR_ZERO = 102;
const ERR_UNKNOWN = 103;
const ERR_CLAIMED = 104;
const ERR_TOO_EARLY = 105;
const ERR_WRONG_TOKEN = 106;
const ERR_NOT_BENEFICIARY = 107;
const ERR_TOO_FAR = 108;
const ERR_TOO_MANY = 110;
const ERR_BAD_TRANSFER = 113;
const ERR_BAD_BENEFICIARY = 114;
const ERR_NOT_DIRECT = 115;

const L_ERR_UNAUTHORIZED = 200;
const L_ERR_ZERO = 202;
const L_ERR_CLOSED = 204;
const L_ERR_TOO_EARLY = 205;
const L_ERR_WRONG_TOKEN = 206;
const L_ERR_NOT_BENEFICIARY = 207;
const L_ERR_BAD_TRANSFER = 209;
const L_ERR_BAD_BENEFICIARY = 210;
const L_ERR_NOT_DIRECT = 211;

const FT_ERR_UNAUTHORIZED = 401;

const MODE_HONEST = 0;
const MODE_NOOP = 1;
const MODE_SHORT = 2;
const MODE_ERR = 3;
const MODE_REDIRECT = 4;
const MODE_REENTER = 5;
const MODE_LIE = 7;
const MODE_CIRCULAR = 8;

function contractId(name: string) {
  return `${deployer}.${name}`;
}

function principal(who: string) {
  return who.includes(".")
    ? Cl.contractPrincipal(who.slice(0, who.indexOf(".")), who.slice(who.indexOf(".") + 1))
    : Cl.principal(who);
}

function mint(token: string, amount: number | bigint, to: string) {
  const { result } = simnet.callPublicFn(token, "mint", [Cl.uint(amount), principal(to)], deployer);
  expect(result).toBeOk(Cl.bool(true));
}

function balance(token: string, who: string) {
  const { result } = simnet.callReadOnlyFn(token, "get-balance", [principal(who)], deployer);
  return result;
}

function expectBalance(token: string, who: string, amount: number | bigint) {
  expect(balance(token, who)).toBeOk(Cl.uint(amount));
}

function createLock(
  amount: number | bigint,
  unlock: number,
  beneficiary: string,
  sender: string,
  token = FT
) {
  return simnet.callPublicFn(
    LOCK,
    "create-lock",
    [Cl.contractPrincipal(deployer, token), Cl.uint(amount), Cl.uint(unlock), principal(beneficiary)],
    sender
  );
}

function claimLock(lockId: number, sender: string, token = FT, contract = LOCK) {
  return simnet.callPublicFn(
    contract,
    "claim",
    [Cl.uint(lockId), Cl.contractPrincipal(deployer, token)],
    sender
  );
}

function lockV0(
  amount: number | bigint,
  unlock: number,
  beneficiary: string,
  sender: string,
  label = "v0",
  token = FT
) {
  return simnet.callPublicFn(
    LOCKER,
    "lock-tokens",
    [
      Cl.contractPrincipal(deployer, token),
      Cl.uint(amount),
      Cl.uint(unlock),
      principal(beneficiary),
      Cl.bufferFromAscii(label),
    ],
    sender
  );
}

/** Height Clarity contracts observe. `simnet.burnBlockHeight` runs one ahead. */
function clarityHeight(): number {
  const value = simnet.execute("burn-block-height").result.value;
  return Number(value);
}

function mineTo(height: number) {
  let spins = 0;
  while (clarityHeight() < height) {
    const gap = height - clarityHeight();
    simnet.mineEmptyBurnBlocks(gap);
    spins += 1;
    if (spins > 4) {
      throw new Error(
        `burn height stuck at clarity=${clarityHeight()} sdk=${simnet.burnBlockHeight}, target=${height}`
      );
    }
  }
  expect(clarityHeight()).toBe(height);
}

function publicNames(contract: string): string[] {
  const map = simnet.getContractsInterfaces();
  const iface = map.get(contract) ?? map.get(contractId(contract));
  expect(iface, `missing ABI for ${contract}`).toBeTruthy();
  return iface!.functions
    .filter((fn) => fn.access === "public")
    .map((fn) => fn.name)
    .sort();
}

describe("1 permission leftovers cannot undo a lock", () => {
  it("rejects a permissionless fund-from-treasury that would undo escrow", () => {
    mint(FT, 1_000, wallet1);
    const unlock = simnet.burnBlockHeight + 30;
    expect(createLock(400, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expectBalance(FT, contractId(LOCK), 400);
    expectBalance(FT, wallet1, 600);

    const pulled = simnet.callPublicFn(
      EXT,
      "fund-from-treasury",
      [Cl.uint(400), principal(wallet3)],
      wallet3
    );
    expect(pulled.result).toBeErr(Cl.uint(FT_ERR_UNAUTHORIZED));
    expectBalance(FT, contractId(LOCK), 400);
    expectBalance(FT, wallet3, 0);
    expectBalance(FT, wallet1, 600);

    // Height is checked before the beneficiary, so this is "too early"
    // until the unlock block, then "not beneficiary".
    const recall = simnet.callPublicFn(
      EXT,
      "recall-claim",
      [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
      wallet1
    );
    expect(recall.result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    mineTo(unlock);
    const recallLate = simnet.callPublicFn(
      EXT,
      "recall-claim",
      [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
      wallet1
    );
    expect(recallLate.result).toBeErr(Cl.uint(ERR_NOT_BENEFICIARY));
    expectBalance(FT, contractId(LOCK), 400);

    mint(FT, 50, wallet1);
    const v0Unlock = simnet.burnBlockHeight + 30;
    expect(lockV0(50, v0Unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    const pulledV0 = simnet.callPublicFn(
      EXT,
      "fund-from-locker",
      [Cl.uint(50), principal(wallet3)],
      wallet3
    );
    expect(pulledV0.result).toBeErr(Cl.uint(FT_ERR_UNAUTHORIZED));
    expectBalance(FT, contractId(LOCKER), 50);
  });

  it("exposes no admin, cancel, or treasury withdraw on either locker", () => {
    expect(publicNames(LOCK)).toEqual(["claim", "create-lock"]);
    expect(publicNames(LOCKER)).toEqual(["burn-lock", "claim", "lock-tokens"]);
  });
});

describe("2 no recovery path and stuck funds", () => {
  it("rolls a failed claim back so the escrow stays claimable", () => {
    mint(BAD, 80, wallet1);
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_HONEST), principal(wallet2)], wallet1);
    const unlock = simnet.burnBlockHeight + 2;
    expect(createLock(80, unlock, wallet1, wallet1, BAD).result).toBeOk(Cl.uint(1));
    mineTo(unlock);

    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_ERR), principal(wallet2)], wallet1);
    expect(claimLock(1, wallet1, BAD).result).toBeErr(Cl.uint(777));
    const still = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1);
    expect(still.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet1),
        token: Cl.contractPrincipal(deployer, BAD),
        amount: Cl.uint(80),
        "unlock-burn-height": Cl.uint(unlock),
        claimed: Cl.bool(false),
      })
    );
    expectBalance(BAD, contractId(LOCK), 80);
    expectBalance(BAD, wallet1, 0);

    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_HONEST), principal(wallet2)], wallet1);
    expect(claimLock(1, wallet1, BAD).result).toBeOk(Cl.uint(80));
    expectBalance(BAD, wallet1, 80);
    expectBalance(BAD, contractId(LOCK), 0);
  });

  it("rejects a beneficiary that is the locker itself", () => {
    mint(FT, 10, wallet1);
    const unlock = simnet.burnBlockHeight + 5;
    expect(createLock(10, unlock, contractId(LOCK), wallet1).result).toBeErr(
      Cl.uint(ERR_BAD_BENEFICIARY)
    );
    expect(lockV0(10, unlock, contractId(LOCKER), wallet1).result).toBeErr(
      Cl.uint(L_ERR_BAD_BENEFICIARY)
    );
    expectBalance(FT, wallet1, 10);
    expect(
      simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result
    ).toBeUint(1);
    expect(
      simnet.callReadOnlyFn(LOCKER, "get-next-lock-id", [], wallet1).result
    ).toBeUint(1);
  });

  it("gives the depositor no early exit on either contract", () => {
    mint(FT, 30, wallet1);
    const unlock = simnet.burnBlockHeight + 8;
    expect(createLock(12, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(claimLock(1, wallet1).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    expect(lockV0(18, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(claimLock(1, wallet1, FT, LOCKER).result).toBeErr(Cl.uint(L_ERR_TOO_EARLY));
    expectBalance(FT, contractId(LOCK), 12);
    expectBalance(FT, contractId(LOCKER), 18);
    expectBalance(FT, wallet1, 0);
  });
});

describe("3 tx-sender versus contract-caller", () => {
  it("stops a malicious intermediary from locking the signer's tokens", () => {
    mint(FT, 1_000, wallet1);
    mint(FT, 1_000, contractId(EVIL));
    const unlock = simnet.burnBlockHeight + 15;
    const attacked = simnet.callPublicFn(
      EVIL,
      "pull-timelock",
      [Cl.contractPrincipal(deployer, FT), Cl.uint(250), Cl.uint(unlock), principal(wallet3)],
      wallet1
    );
    expect(attacked.result).toBeErr(Cl.uint(ERR_NOT_DIRECT));
    expectBalance(FT, wallet1, 1_000);
    expectBalance(FT, contractId(LOCK), 0);
    expect(simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1).result).toBeNone();
    expect(
      simnet.callReadOnlyFn(LOCK, "get-locks-for-depositor", [principal(wallet1)], wallet1).result
    ).toBeList([]);

    const attackedV0 = simnet.callPublicFn(
      EVIL,
      "pull-locker",
      [
        Cl.contractPrincipal(deployer, FT),
        Cl.uint(250),
        Cl.uint(unlock),
        principal(wallet3),
        Cl.bufferFromAscii("phish"),
      ],
      wallet1
    );
    expect(attackedV0.result).toBeErr(Cl.uint(L_ERR_NOT_DIRECT));
    expectBalance(FT, wallet1, 1_000);
    expect(simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(1)], wallet1).result).toBeNone();
  });

  it("stops a malicious intermediary from permanently burning a lock", () => {
    mint(FT, 90, wallet1);
    const unlock = simnet.burnBlockHeight + 20;
    expect(lockV0(90, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    const burned = simnet.callPublicFn(EVIL, "force-burn", [Cl.uint(1)], wallet1);
    expect(burned.result).toBeErr(Cl.uint(L_ERR_UNAUTHORIZED));
    const lock = simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(1)], wallet1);
    expect(lock.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(90),
        "unlock-burn-height": Cl.uint(unlock),
        status: Cl.uint(0),
        label: Cl.bufferFromAscii("v0"),
      })
    );
    expectBalance(FT, contractId(LOCKER), 90);
  });

  it("stops a malicious intermediary from forcing a claim", () => {
    mint(FT, 70, wallet1);
    const unlock = simnet.burnBlockHeight + 15;
    expect(createLock(40, unlock, wallet1, wallet1).result).toBeOk(Cl.uint(1));
    expect(lockV0(30, unlock, wallet1, wallet1, "c").result).toBeOk(Cl.uint(1));
    mineTo(unlock);

    expect(
      simnet.callPublicFn(
        EVIL,
        "force-claim-timelock",
        [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
        wallet1
      ).result
    ).toBeErr(Cl.uint(ERR_NOT_BENEFICIARY));
    expect(
      simnet.callPublicFn(
        EVIL,
        "force-claim-locker",
        [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
        wallet1
      ).result
    ).toBeErr(Cl.uint(L_ERR_NOT_BENEFICIARY));
    expectBalance(FT, wallet1, 0);
    expectBalance(FT, contractId(LOCK), 40);
    expectBalance(FT, contractId(LOCKER), 30);

    expect(claimLock(1, wallet1).result).toBeOk(Cl.uint(40));
    expect(claimLock(1, wallet1, FT, LOCKER).result).toBeOk(Cl.uint(30));
    expectBalance(FT, wallet1, 70);
  });

  it("lets a contract beneficiary claim directly and via as-contract", () => {
    mint(FT, 25, wallet1);
    const unlock = simnet.burnBlockHeight + 15;
    const vault = contractId(VAULT);
    expect(createLock(11, unlock, vault, wallet1).result).toBeOk(Cl.uint(1));
    expect(createLock(14, unlock, vault, wallet1).result).toBeOk(Cl.uint(2));
    mineTo(unlock);

    expect(
      simnet.callPublicFn(
        VAULT,
        "claim-timelock",
        [Cl.uint(1), Cl.contractPrincipal(deployer, FT)],
        wallet3
      ).result
    ).toBeOk(Cl.uint(11));
    expect(
      simnet.callPublicFn(
        VAULT,
        "claim-timelock-as-contract",
        [Cl.uint(2), Cl.contractPrincipal(deployer, FT)],
        wallet3
      ).result
    ).toBeOk(Cl.uint(14));
    expectBalance(FT, vault, 25);
    expectBalance(FT, wallet3, 0);
    expectBalance(FT, wallet1, 0);
    expectBalance(FT, contractId(LOCK), 0);
  });
});

describe("4 re-initialization, double create, and claim replay", () => {
  it("does not overwrite lock 1 or reset the id counter", () => {
    mint(FT, 30, wallet1);
    const unlock = simnet.burnBlockHeight + 4;
    expect(createLock(10, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(createLock(20, unlock + 1, wallet3, wallet1).result).toBeOk(Cl.uint(2));
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(3);
    const first = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1);
    expect(first.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(10),
        "unlock-burn-height": Cl.uint(unlock),
        claimed: Cl.bool(false),
      })
    );
    expect(publicNames(LOCK)).not.toContain("initialize");
    expect(publicNames(LOCKER)).not.toContain("initialize");
    expect(claimLock(99, wallet1).result).toBeErr(Cl.uint(ERR_UNKNOWN));
  });

  it("rejects a second claim and a second burn", () => {
    mint(FT, 15, wallet1);
    const unlock = simnet.burnBlockHeight + 15;
    expect(createLock(6, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(lockV0(9, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    mineTo(unlock);
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(6));
    expect(claimLock(1, wallet2).result).toBeErr(Cl.uint(ERR_CLAIMED));
    expect(claimLock(1, wallet2, FT, LOCKER).result).toBeOk(Cl.uint(9));
    expect(claimLock(1, wallet2, FT, LOCKER).result).toBeErr(Cl.uint(L_ERR_CLOSED));
    expectBalance(FT, wallet2, 15);

    mint(FT, 4, wallet1);
    const later = simnet.burnBlockHeight + 5;
    expect(lockV0(4, later, wallet2, wallet1, "once").result).toBeOk(Cl.uint(2));
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(2)], wallet1).result).toBeOk(
      Cl.bool(true)
    );
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(2)], wallet1).result).toBeErr(
      Cl.uint(L_ERR_CLOSED)
    );
  });
});

describe("5 burn-block-height boundaries", () => {
  it("treats the current height as closed and the next open block as the first claim", () => {
    mint(FT, 5, wallet1);
    // Each public call advances burn height afterwards. Read height at the call.
    expect(createLock(1, simnet.burnBlockHeight, wallet1, wallet1).result).toBeErr(
      Cl.uint(ERR_NOT_FUTURE)
    );
    expect(createLock(1, 0, wallet1, wallet1).result).toBeErr(Cl.uint(ERR_NOT_FUTURE));
    const target = clarityHeight() + 6;
    expect(createLock(2, target, wallet1, wallet1).result).toBeOk(Cl.uint(1));
    // A public call is mined into the next burn block, so the last closed
    // read-only height is unlock-2 and that claim still executes at unlock-1.
    mineTo(target - 2);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    expect(claimLock(1, wallet1).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    expect(clarityHeight()).toBeLessThan(target);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    mineTo(target);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      true
    );
    expect(claimLock(1, wallet1).result).toBeOk(Cl.uint(2));
    expectBalance(FT, wallet1, 5);
  });

  it("accepts a duration of exactly 2_000_000 blocks and rejects one more", () => {
    mint(FT, 4, wallet1);
    const now = simnet.burnBlockHeight;
    expect(createLock(1, now + 2_000_000, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    const later = simnet.burnBlockHeight;
    expect(createLock(1, later + 2_000_000 + 1, wallet2, wallet1).result).toBeErr(
      Cl.uint(ERR_TOO_FAR)
    );
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    expectBalance(FT, wallet1, 3);
  });

  it("opens absolute height 1_000_000 on that block and not one block earlier", () => {
    expect(simnet.burnBlockHeight).toBeLessThan(1_000_000);
    mint(FT, 10, wallet1);
    expect(createLock(10, 1_000_000, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    mineTo(999_998);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    expect(claimLock(1, wallet2).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    expect(clarityHeight()).toBeLessThan(1_000_000);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    expectBalance(FT, contractId(LOCK), 10);
    mineTo(1_000_000);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      true
    );
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(10));
    expectBalance(FT, wallet2, 10);
    expectBalance(FT, contractId(LOCK), 0);
  }, 180_000);

  it("opens absolute height 2_000_000 on that block and not one block earlier", () => {
    expect(simnet.burnBlockHeight).toBeLessThan(1_000_000);
    mint(FT, 21, wallet1);
    expect(createLock(21, 2_000_000, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    mineTo(1_999_998);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    expect(claimLock(1, wallet2).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    expect(clarityHeight()).toBeLessThan(2_000_000);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      false
    );
    mineTo(2_000_000);
    expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(1)], wallet1).result).toBeBool(
      true
    );
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(21));
    expectBalance(FT, wallet2, 21);
    expectBalance(FT, contractId(LOCK), 0);
  }, 180_000);
});

describe("6 wrong or fake SIP-010 trait", () => {
  it("rejects a claim that passes a different token trait", () => {
    mint(FT, 8, wallet1);
    const unlock = simnet.burnBlockHeight + 1;
    expect(lockV0(8, unlock, wallet1, wallet1).result).toBeOk(Cl.uint(1));
    mineTo(unlock);
    expect(claimLock(1, wallet1, FT_B, LOCKER).result).toBeErr(Cl.uint(L_ERR_WRONG_TOKEN));
    expectBalance(FT, contractId(LOCKER), 8);
    expect(claimLock(1, wallet1, FT, LOCKER).result).toBeOk(Cl.uint(8));
  });

  it("rejects a no-op transfer and a short transfer before recording a lock", () => {
    mint(BAD, 100, wallet1);
    const unlock = simnet.burnBlockHeight + 30;

    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_NOOP), principal(wallet2)], wallet1);
    expect(createLock(40, unlock, wallet1, wallet1, BAD).result).toBeErr(Cl.uint(ERR_BAD_TRANSFER));
    expect(lockV0(40, unlock, wallet1, wallet1, "noop", BAD).result).toBeErr(
      Cl.uint(L_ERR_BAD_TRANSFER)
    );
    expectBalance(BAD, wallet1, 100);
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(1);

    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_SHORT), principal(wallet2)], wallet1);
    expect(createLock(40, unlock, wallet1, wallet1, BAD).result).toBeErr(Cl.uint(ERR_BAD_TRANSFER));
    expect(lockV0(40, unlock, wallet1, wallet1, "short", BAD).result).toBeErr(
      Cl.uint(L_ERR_BAD_TRANSFER)
    );
    expectBalance(BAD, wallet1, 100);
    expectBalance(BAD, contractId(LOCK), 0);
    expectBalance(BAD, contractId(LOCKER), 0);

    simnet.callPublicFn(BAD, "configure", [Cl.uint(6), principal(wallet2)], wallet1);
    expect(createLock(40, unlock, wallet1, wallet1, BAD).result).toBeErr(Cl.uint(ERR_BAD_TRANSFER));
    expectBalance(BAD, wallet1, 100);
  });

  it("rejects a claim whose token pays the attacker instead of the beneficiary", () => {
    mint(BAD, 60, wallet1);
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_HONEST), principal(wallet3)], wallet1);
    const unlock = simnet.burnBlockHeight + 15;
    expect(createLock(60, unlock, wallet2, wallet1, BAD).result).toBeOk(Cl.uint(1));
    mineTo(unlock);
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_REDIRECT), principal(wallet3)], wallet1);
    expect(claimLock(1, wallet2, BAD).result).toBeErr(Cl.uint(ERR_BAD_TRANSFER));
    expectBalance(BAD, contractId(LOCK), 60);
    expectBalance(BAD, wallet2, 0);
    expectBalance(BAD, wallet3, 0);
    const open = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1);
    expect(open.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, BAD),
        amount: Cl.uint(60),
        "unlock-burn-height": Cl.uint(unlock),
        claimed: Cl.bool(false),
      })
    );
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_HONEST), principal(wallet3)], wallet1);
    expect(claimLock(1, wallet2, BAD).result).toBeOk(Cl.uint(60));
    expectBalance(BAD, wallet2, 60);
  });

  it("still trusts a token that lies about balances by exactly the claimed delta", () => {
    // Known residual: both transfer and get-balance are the attacker's code.
    // An allowlist is a product decision, not applied to this generic locker.
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_LIE), principal(wallet2)], wallet1);
    const unlock = simnet.burnBlockHeight + 10;
    expect(createLock(33, unlock, wallet2, wallet1, BAD).result).toBeOk(Cl.uint(1));
    expect(
      simnet.callReadOnlyFn(BAD, "get-total-supply", [], wallet1).result
    ).toBeOk(Cl.uint(0));
    mineTo(unlock);
    expect(claimLock(1, wallet2, BAD).result).toBeOk(Cl.uint(33));
    expect(
      simnet.callReadOnlyFn(BAD, "get-total-supply", [], wallet1).result
    ).toBeOk(Cl.uint(0));
  });
});

describe("7 zero, dust, and griefing", () => {
  it("rejects zero without consuming an id or moving tokens", () => {
    mint(FT, 5, wallet1);
    const unlock = simnet.burnBlockHeight + 3;
    expect(createLock(0, unlock, wallet1, wallet1).result).toBeErr(Cl.uint(ERR_ZERO));
    expect(lockV0(0, unlock, wallet1, wallet1).result).toBeErr(Cl.uint(L_ERR_ZERO));
    expectBalance(FT, wallet1, 5);
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(1);
    expect(simnet.callReadOnlyFn(LOCKER, "get-next-lock-id", [], wallet1).result).toBeUint(1);
  });

  it("escrows and returns a 1-unit dust lock exactly", () => {
    mint(FT, 1, wallet1);
    const unlock = simnet.burnBlockHeight + 1;
    expect(createLock(1, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expectBalance(FT, wallet1, 0);
    expectBalance(FT, contractId(LOCK), 1);
    mineTo(unlock);
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(1));
    expectBalance(FT, wallet2, 1);
    expectBalance(FT, contractId(LOCK), 0);
  });

  it("rejects the 51st timelock for one depositor without taking the extra token", () => {
    mint(FT, 51, wallet1);
    const unlock = simnet.burnBlockHeight + 80;
    for (let id = 1; id <= 50; id++) {
      expect(createLock(1, unlock, wallet1, wallet1).result).toBeOk(Cl.uint(id));
    }
    expect(createLock(1, unlock, wallet1, wallet1).result).toBeErr(Cl.uint(ERR_TOO_MANY));
    expectBalance(FT, wallet1, 1);
    expectBalance(FT, contractId(LOCK), 50);
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(51);
  });
});

describe("8 beneficiary and principal edges", () => {
  it("keeps depositor, beneficiary, and stranger distinct and immutable", () => {
    mint(FT, 16, wallet1);
    const unlock = simnet.burnBlockHeight + 20;
    expect(createLock(16, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(claimLock(1, wallet1).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    expect(claimLock(1, wallet3).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    mineTo(unlock);
    expect(claimLock(1, wallet1).result).toBeErr(Cl.uint(ERR_NOT_BENEFICIARY));
    expect(claimLock(1, wallet3).result).toBeErr(Cl.uint(ERR_NOT_BENEFICIARY));
    expectBalance(FT, wallet3, 0);
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(16));
    expectBalance(FT, wallet2, 16);
    expectBalance(FT, wallet1, 0);

    // A principal that has not appeared before can still be paid.
    mint(FT, 3, wallet1);
    const wallet4 = accounts.get("wallet_4")!;
    const later = simnet.burnBlockHeight + 5;
    expect(createLock(3, later, wallet4, wallet1).result).toBeOk(Cl.uint(2));
    mineTo(later);
    expect(claimLock(2, wallet4).result).toBeOk(Cl.uint(3));
    expectBalance(FT, wallet4, 3);
  });

  it("does not let the depositor claim when they are not the beneficiary, including after other locks", () => {
    mint(FT, 9, wallet1);
    const unlock = simnet.burnBlockHeight + 15;
    expect(createLock(4, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(createLock(5, unlock + 3, wallet3, wallet1).result).toBeOk(Cl.uint(2));
    const first = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1);
    expect(first.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(4),
        "unlock-burn-height": Cl.uint(unlock),
        claimed: Cl.bool(false),
      })
    );
  });
});

describe("9 partial claims and rounding", () => {
  it("pays each lock in full and does not round odd amounts into another lock", () => {
    mint(FT, 10, wallet1);
    const h1 = simnet.burnBlockHeight + 10;
    const h2 = h1 + 8;
    expect(createLock(7, h1, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expect(createLock(3, h2, wallet2, wallet1).result).toBeOk(Cl.uint(2));
    mineTo(h1);
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(7));
    expect(claimLock(2, wallet2).result).toBeErr(Cl.uint(ERR_TOO_EARLY));
    expectBalance(FT, wallet2, 7);
    expectBalance(FT, contractId(LOCK), 3);
    const second = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(2)], wallet1);
    expect(second.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(3),
        "unlock-burn-height": Cl.uint(h2),
        claimed: Cl.bool(false),
      })
    );
    mineTo(h2);
    expect(claimLock(2, wallet2).result).toBeOk(Cl.uint(3));
    expectBalance(FT, wallet2, 10);
    expectBalance(FT, contractId(LOCK), 0);
    expect(claimLock(1, wallet2).result).toBeErr(Cl.uint(ERR_CLAIMED));
    expect(claimLock(2, wallet2).result).toBeErr(Cl.uint(ERR_CLAIMED));
  });
});

describe("10 five-lock registry without cross-lock leakage", () => {
  it("creates five timelock locks in one transaction and unlocks each on its own height", () => {
    const amounts = [11, 23, 37, 41, 53];
    const sum = amounts.reduce((a, b) => a + b, 0);
    const batch = contractId(BATCH);
    mint(FT, sum, wallet1);
    mint(FT, sum, batch);
    const base = clarityHeight() + 12;
    const heights = [0, 1, 2, 3, 4].map((i) => base + i * 4);
    const locked = simnet.callPublicFn(
      BATCH,
      "lock-five",
      [
        Cl.contractPrincipal(deployer, FT),
        Cl.uint(amounts[0]),
        Cl.uint(heights[0]),
        Cl.uint(amounts[1]),
        Cl.uint(heights[1]),
        Cl.uint(amounts[2]),
        Cl.uint(heights[2]),
        Cl.uint(amounts[3]),
        Cl.uint(heights[3]),
        Cl.uint(amounts[4]),
        Cl.uint(heights[4]),
        principal(wallet2),
      ],
      wallet1
    );
    expect(locked.result).toBeOk(Cl.bool(true));
    // The signer is not the depositor and is not charged.
    expectBalance(FT, wallet1, sum);
    expectBalance(FT, batch, 0);
    expectBalance(FT, contractId(LOCK), sum);
    const ids = simnet.callReadOnlyFn(LOCK, "get-locks-for-depositor", [principal(batch)], wallet1);
    expect(ids.result).toBeList([Cl.uint(1), Cl.uint(2), Cl.uint(3), Cl.uint(4), Cl.uint(5)]);
    expect(
      simnet.callReadOnlyFn(LOCK, "get-locks-for-depositor", [principal(wallet1)], wallet1).result
    ).toBeList([]);

    let paid = 0;
    for (let i = 0; i < 5; i++) {
      mineTo(heights[i] - 1);
      expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(i + 1)], wallet1).result).toBeBool(
        false
      );
      mineTo(heights[i]);
      expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(i + 1)], wallet1).result).toBeBool(
        true
      );
      if (i + 2 <= 5) {
        expect(simnet.callReadOnlyFn(LOCK, "is-unlocked", [Cl.uint(i + 2)], wallet1).result).toBeBool(
          false
        );
      }
      expect(claimLock(i + 1, wallet2).result).toBeOk(Cl.uint(amounts[i]));
      paid += amounts[i];
      expectBalance(FT, wallet2, paid);
      expectBalance(FT, contractId(LOCK), sum - paid);
      // A later lock is unchanged by this claim.
      if (i < 4) {
        const later = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(i + 2)], wallet1);
        expect(later.result).toBeSome(
          Cl.tuple({
            depositor: principal(batch),
            beneficiary: Cl.principal(wallet2),
            token: Cl.contractPrincipal(deployer, FT),
            amount: Cl.uint(amounts[i + 1]),
            "unlock-burn-height": Cl.uint(heights[i + 1]),
            claimed: Cl.bool(false),
          })
        );
      }
    }
    expectBalance(FT, contractId(LOCK), 0);
    expect(claimLock(3, wallet2).result).toBeErr(Cl.uint(ERR_CLAIMED));
  });

  it("keeps five locker-v0 locks independent, including a burn of the middle one", () => {
    const amounts = [10, 20, 30, 40, 50];
    const sum = amounts.reduce((a, b) => a + b, 0);
    mint(FT, sum, wallet1);
    const base = clarityHeight() + 20;
    const heights = [10, 20, 30, 40, 50].map((d) => base + d);
    for (let i = 0; i < 5; i++) {
      expect(lockV0(amounts[i], heights[i], wallet2, wallet1, `L${i + 1}`).result).toBeOk(
        Cl.uint(i + 1)
      );
    }
    expectBalance(FT, contractId(LOCKER), sum);

    // Burn lock 3 before its unlock. The other four stay active.
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(3)], wallet1).result).toBeOk(
      Cl.bool(true)
    );
    expectBalance(FT, contractId(LOCKER), sum);

    mineTo(heights[2]);
    expect(simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(4)], wallet1).result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(40),
        "unlock-burn-height": Cl.uint(heights[3]),
        status: Cl.uint(0),
        label: Cl.bufferFromAscii("L4"),
      })
    );
    expect(claimLock(3, wallet2, FT, LOCKER).result).toBeErr(Cl.uint(L_ERR_CLOSED));
    expect(claimLock(1, wallet2, FT, LOCKER).result).toBeOk(Cl.uint(10));
    expect(claimLock(2, wallet2, FT, LOCKER).result).toBeOk(Cl.uint(20));
    expect(claimLock(4, wallet2, FT, LOCKER).result).toBeErr(Cl.uint(L_ERR_TOO_EARLY));
    expectBalance(FT, wallet2, 30);
    expectBalance(FT, contractId(LOCKER), sum - 30);

    const burned = simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(3)], wallet1);
    expect(burned.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(30),
        "unlock-burn-height": Cl.uint(heights[2]),
        status: Cl.uint(2),
        label: Cl.bufferFromAscii("L3"),
      })
    );
    const fifth = simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(5)], wallet1);
    expect(fifth.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(50),
        "unlock-burn-height": Cl.uint(heights[4]),
        status: Cl.uint(0),
        label: Cl.bufferFromAscii("L5"),
      })
    );

    mineTo(heights[4]);
    expect(claimLock(4, wallet2, FT, LOCKER).result).toBeOk(Cl.uint(40));
    expect(claimLock(5, wallet2, FT, LOCKER).result).toBeOk(Cl.uint(50));
    // Burned 30 stays in the contract. Claimed 120 left.
    expectBalance(FT, contractId(LOCKER), 30);
    expectBalance(FT, wallet2, 120);
    expectBalance(FT, wallet1, 0);
  });
});

describe("11 permanent burn is irreversible", () => {
  it("lets only the depositor burn before unlock, and nobody can reverse it", () => {
    mint(FT, 100, wallet1);
    const unlock = simnet.burnBlockHeight + 6;
    expect(lockV0(100, unlock, wallet2, wallet1, "final").result).toBeOk(Cl.uint(1));
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet2).result).toBeErr(
      Cl.uint(L_ERR_UNAUTHORIZED)
    );
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet3).result).toBeErr(
      Cl.uint(L_ERR_UNAUTHORIZED)
    );
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet1).result).toBeOk(
      Cl.bool(true)
    );
    expectBalance(FT, contractId(LOCKER), 100);
    expectBalance(FT, wallet1, 0);
    mineTo(unlock);
    expect(claimLock(1, wallet2, FT, LOCKER).result).toBeErr(Cl.uint(L_ERR_CLOSED));
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet2).result).toBeErr(
      Cl.uint(L_ERR_CLOSED)
    );
    expect(
      simnet.callPublicFn(EXT, "fund-from-locker", [Cl.uint(100), principal(wallet1)], wallet1)
        .result
    ).toBeErr(Cl.uint(FT_ERR_UNAUTHORIZED));
    expectBalance(FT, contractId(LOCKER), 100);
    expectBalance(FT, wallet1, 0);
    expectBalance(FT, wallet2, 0);
  });

  it("lets only the beneficiary burn after unlock, and the tokens stay in the contract", () => {
    mint(FT, 45, wallet1);
    const unlock = simnet.burnBlockHeight + 1;
    expect(lockV0(45, unlock, wallet2, wallet1, "post").result).toBeOk(Cl.uint(1));
    mineTo(unlock);
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet1).result).toBeErr(
      Cl.uint(L_ERR_UNAUTHORIZED)
    );
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet3).result).toBeErr(
      Cl.uint(L_ERR_UNAUTHORIZED)
    );
    expect(simnet.callPublicFn(LOCKER, "burn-lock", [Cl.uint(1)], wallet2).result).toBeOk(
      Cl.bool(true)
    );
    expect(claimLock(1, wallet2, FT, LOCKER).result).toBeErr(Cl.uint(L_ERR_CLOSED));
    expectBalance(FT, contractId(LOCKER), 45);
    expectBalance(FT, wallet2, 0);
  });
});

describe("12 unchecked responses and as-contract", () => {
  it("propagates a token error on create and leaves no lock behind", () => {
    mint(BAD, 20, wallet1);
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_ERR), principal(wallet2)], wallet1);
    const unlock = simnet.burnBlockHeight + 4;
    expect(createLock(20, unlock, wallet2, wallet1, BAD).result).toBeErr(Cl.uint(777));
    expect(lockV0(20, unlock, wallet2, wallet1, "err", BAD).result).toBeErr(Cl.uint(777));
    expectBalance(BAD, wallet1, 20);
    expect(simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1).result).toBeNone();
    expect(simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(1)], wallet1).result).toBeNone();
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(1);
  });

  it("pays a direct claim from the contract balance to the beneficiary only", () => {
    mint(FT, 18, wallet1);
    const unlock = simnet.burnBlockHeight + 1;
    expect(createLock(18, unlock, wallet2, wallet1).result).toBeOk(Cl.uint(1));
    expectBalance(FT, contractId(LOCK), 18);
    expectBalance(FT, wallet1, 0);
    mineTo(unlock);
    expect(claimLock(1, wallet2).result).toBeOk(Cl.uint(18));
    expectBalance(FT, wallet2, 18);
    expectBalance(FT, wallet1, 0);
    expectBalance(FT, contractId(LOCK), 0);
  });

  it("blocks reentrant burn, honest-token theft, and a nested second lock", () => {
    mint(FT, 400, wallet1);
    const ftUnlock = simnet.burnBlockHeight + 40;
    expect(lockV0(100, ftUnlock, wallet2, wallet1, "honest").result).toBeOk(Cl.uint(1));
    expectBalance(FT, wallet1, 300);
    expectBalance(FT, contractId(LOCKER), 100);

    mint(BAD, 250, wallet1);
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_REENTER), principal(wallet3)], wallet1);
    const unlock = simnet.burnBlockHeight + 7;
    expect(createLock(100, unlock, wallet1, wallet1, BAD).result).toBeOk(Cl.uint(1));

    const probe = simnet.callReadOnlyFn(BAD, "get-probe", [], wallet1);
    expect(probe.result).toBeTuple({
      "burn-ok": Cl.bool(false),
      "burn-err": Cl.uint(L_ERR_UNAUTHORIZED),
    });

    // One hostile lock, exact custody. The pre-existing honest lock is untouched.
    expectBalance(BAD, wallet1, 150);
    expectBalance(BAD, contractId(LOCK), 100);
    expectBalance(BAD, wallet3, 0);
    expectBalance(FT, wallet1, 300);
    expectBalance(FT, contractId(LOCK), 0);
    expectBalance(FT, contractId(LOCKER), 100);
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(2);
    const honest = simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(1)], wallet1);
    expect(honest.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(100),
        "unlock-burn-height": Cl.uint(ftUnlock),
        status: Cl.uint(0),
        label: Cl.bufferFromAscii("honest"),
      })
    );
    const nested = simnet.callReadOnlyFn(LOCK, "get-lock", [Cl.uint(1)], wallet1);
    expect(nested.result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet1),
        token: Cl.contractPrincipal(deployer, BAD),
        amount: Cl.uint(100),
        "unlock-burn-height": Cl.uint(unlock),
        claimed: Cl.bool(false),
      })
    );
  });

  it("aborts same-function reentry and does not keep the callback's burn", () => {
    mint(FT, 80, wallet1);
    const ftUnlock = simnet.burnBlockHeight + 40;
    expect(lockV0(80, ftUnlock, wallet2, wallet1, "keep").result).toBeOk(Cl.uint(1));
    mint(BAD, 40, wallet1);
    simnet.callPublicFn(BAD, "configure", [Cl.uint(MODE_CIRCULAR), principal(wallet3)], wallet1);
    const unlock = simnet.burnBlockHeight + 15;
    expect(() => createLock(40, unlock, wallet1, wallet1, BAD)).toThrow(/CircularReference/);
    expectBalance(BAD, wallet1, 40);
    expectBalance(FT, contractId(LOCKER), 80);
    expectBalance(FT, contractId(LOCK), 0);
    expect(simnet.callReadOnlyFn(LOCK, "get-next-lock-id", [], wallet1).result).toBeUint(1);
    expect(simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(1)], wallet1).result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(80),
        "unlock-burn-height": Cl.uint(ftUnlock),
        status: Cl.uint(0),
        label: Cl.bufferFromAscii("keep"),
      })
    );
  });

  it("documents that locker-v0 has no max-duration cap", () => {
    mint(FT, 2, wallet1);
    const tooFarForTimelock = simnet.burnBlockHeight + 2_000_000 + 1;
    expect(createLock(1, tooFarForTimelock, wallet2, wallet1).result).toBeErr(Cl.uint(ERR_TOO_FAR));
    expect(lockV0(1, tooFarForTimelock, wallet2, wallet1, "far").result).toBeOk(Cl.uint(1));
    expectBalance(FT, contractId(LOCKER), 1);
    expect(simnet.callReadOnlyFn(LOCKER, "get-lock", [Cl.uint(1)], wallet1).result).toBeSome(
      Cl.tuple({
        depositor: Cl.principal(wallet1),
        beneficiary: Cl.principal(wallet2),
        token: Cl.contractPrincipal(deployer, FT),
        amount: Cl.uint(1),
        "unlock-burn-height": Cl.uint(tooFarForTimelock),
        status: Cl.uint(0),
        label: Cl.bufferFromAscii("far"),
      })
    );
  });
});
