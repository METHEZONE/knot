import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.serviceName, "knot-web3");
  assert.equal(config.solanaCluster, "devnet");
  assert.equal(config.signingMode, "simulated");
  assert.equal(config.solanaRpcUrl, "https://api.devnet.solana.com");
  assert.equal(config.autoMintOnLock, false);
  assert.equal(config.autoSolTopupOnLock, false);
});

test("loadConfig enables live signing explicitly for devnet", () => {
  const config = loadConfig({
    KNOT_WEB3_SIGNING_MODE: "devnet",
    KNOT_BRAND_KEYPAIR_PATH: "/secrets/brand.json",
    SOLANA_RPC_URL: "http://127.0.0.1:8899"
  });
  assert.equal(config.signingMode, "live");
  assert.equal(config.brandKeypairPath, "/secrets/brand.json");
  assert.equal(config.solanaRpcUrl, "http://127.0.0.1:8899");
});

test("loadConfig keeps auto mint localnet-only by default", () => {
  const local = loadConfig({ SOLANA_CLUSTER: "localnet" });
  const devnet = loadConfig({ SOLANA_CLUSTER: "devnet" });
  assert.equal(local.autoMintOnLock, true);
  assert.equal(devnet.autoMintOnLock, false);
  assert.equal(local.autoSolTopupOnLock, true);
  assert.equal(devnet.autoSolTopupOnLock, false);
});
