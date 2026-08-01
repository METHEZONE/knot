import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.serviceName, "knot-web3");
  assert.equal(config.solanaCluster, "testnet");
  assert.equal(config.signingMode, "simulated");
  assert.equal(config.solanaRpcUrl, "https://api.testnet.solana.com");
});

test("loadConfig enables live signing explicitly for testnet", () => {
  const config = loadConfig({
    KNOT_WEB3_SIGNING_MODE: "testnet",
    KNOT_BRAND_KEYPAIR_PATH: "/secrets/brand.json",
    SOLANA_RPC_URL: "http://127.0.0.1:8899"
  });
  assert.equal(config.signingMode, "live");
  assert.equal(config.brandKeypairPath, "/secrets/brand.json");
  assert.equal(config.solanaRpcUrl, "http://127.0.0.1:8899");
});
