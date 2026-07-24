import assert from "node:assert/strict";
import test from "node:test";
import { EscrowLockService } from "../src/escrow.js";
import { loadConfig } from "../src/config.js";

function lockPayload(overrides: Record<string, unknown> = {}) {
  return {
    agreementId: "agreement-001",
    escrowId: "escrow-001",
    termsHash: "sha256:1234567890abcdef",
    expectedAmountBaseUnits: "650000000",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    programId: "Hv74c9a4rKMHpsy7hgCj7a11tDRaAZG49Ss7bLscs5hu",
    network: "solanaDevnet",
    brandAuthority: "brand-wallet",
    creatorDestination: "creator-wallet",
    ...overrides
  };
}

test("lock service validates and returns simulated receipt", () => {
  const service = new EscrowLockService();
  const result = service.lock(loadConfig({}), "lock:agreement-001", lockPayload());

  assert.equal(result.statusCode, 202);
  assert.equal(result.body.data.status, "SIMULATED");
  assert.equal(result.body.data.lockedAmountBaseUnits, "650000000");
  assert.equal(result.body.data.signature, null);
});

test("lock service requires idempotency key", () => {
  const service = new EscrowLockService();
  const result = service.lock(loadConfig({}), undefined, lockPayload());

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, "VALIDATION_ERROR");
});

test("lock service rejects disallowed mint", () => {
  const service = new EscrowLockService();
  const result = service.lock(
    loadConfig({ KNOT_USDC_MINT: "allowed-mint" }),
    "lock:agreement-002",
    lockPayload({ mint: "wrong-mint" })
  );

  assert.equal(result.statusCode, 409);
  assert.equal(result.body.code, "POLICY_VIOLATION");
});

test("lock service replays duplicate idempotency key", () => {
  const service = new EscrowLockService();
  const first = service.lock(
    loadConfig({}),
    "lock:agreement-003",
    lockPayload({ agreementId: "agreement-003", escrowId: "escrow-003" })
  );
  const second = service.lock(
    loadConfig({}),
    "lock:agreement-003",
    lockPayload({ agreementId: "agreement-003", escrowId: "escrow-003" })
  );

  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotentReplay, true);
  assert.deepEqual(second.body.data, first.body.data);
});
