import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { EscrowLockService } from "../src/escrow.js";
import { loadConfig } from "../src/config.js";

function lockPayload(overrides: Record<string, unknown> = {}) {
  return {
    agreementId: "agreement-001",
    escrowId: "escrow-001",
    termsHash: "sha256:1234567890abcdef",
    expectedAmountBaseUnits: "650000000",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    programId: "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj",
    network: "solanaDevnet",
    brandAuthority: "brand-wallet",
    creatorDestination: "creator-wallet",
    ...overrides
  };
}

function releasePayload(overrides: Record<string, unknown> = {}) {
  return {
    agreementId: "agreement-001",
    escrowId: "escrow-001",
    milestoneId: "content",
    termsHash: "sha256:1234567890abcdef",
    expectedAmountBaseUnits: "455000000",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    programId: "Aj63B5hLtvJdNQiAi61rMrgfW3pt8Lak3GQB59B6jysj",
    network: "solanaDevnet",
    creatorDestination: "creator-wallet",
    ...overrides
  };
}

test("lock service validates and returns simulated receipt", async () => {
  const service = new EscrowLockService();
  const result = await service.lock(loadConfig({}), "lock:agreement-001", lockPayload());

  assert.equal(result.statusCode, 202);
  assert.equal(result.body.data.status, "SIMULATED");
  assert.equal(result.body.data.lockedAmountBaseUnits, "650000000");
  assert.equal(result.body.data.signature, null);
});

test("lock service requires idempotency key", async () => {
  const service = new EscrowLockService();
  const result = await service.lock(loadConfig({}), undefined, lockPayload());

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, "VALIDATION_ERROR");
});

test("lock service rejects disallowed mint", async () => {
  const service = new EscrowLockService();
  const result = await service.lock(
    loadConfig({ KNOT_USDC_MINT: "allowed-mint" }),
    "lock:agreement-002",
    lockPayload({ mint: "wrong-mint" })
  );

  assert.equal(result.statusCode, 409);
  assert.equal(result.body.code, "POLICY_VIOLATION");
});

test("lock service replays duplicate idempotency key", async () => {
  const service = new EscrowLockService();
  const first = await service.lock(
    loadConfig({}),
    "lock:agreement-003",
    lockPayload({ agreementId: "agreement-003", escrowId: "escrow-003" })
  );
  const second = await service.lock(
    loadConfig({}),
    "lock:agreement-003",
    lockPayload({ agreementId: "agreement-003", escrowId: "escrow-003" })
  );

  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotentReplay, true);
  assert.deepEqual(second.body.data, first.body.data);
});

test("release service validates and returns simulated milestone receipt", async () => {
  const service = new EscrowLockService();
  const result = await service.release(
    loadConfig({}),
    "release:escrow-001:content",
    "escrow-001",
    "content",
    releasePayload()
  );

  assert.equal(result.statusCode, 202);
  assert.equal(result.body.data.status, "SIMULATED");
  assert.equal(result.body.data.milestoneId, "content");
  assert.equal(result.body.data.releasedAmountBaseUnits, "455000000");
  assert.equal(result.body.data.signature, null);
});

test("release service rejects route and body mismatch", async () => {
  const service = new EscrowLockService();
  const result = await service.release(
    loadConfig({}),
    "release:mismatch",
    "escrow-001",
    "content",
    releasePayload({ milestoneId: "wrong-milestone" })
  );

  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, "VALIDATION_ERROR");
});

test("app registers AIP-136 custom method suffix routes", () => {
  assert.doesNotThrow(() => createApp(loadConfig({})));
});
