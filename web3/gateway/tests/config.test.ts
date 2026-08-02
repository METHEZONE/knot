import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.serviceName, "knot-web3");
  assert.equal(config.solanaCluster, "devnet");
  assert.equal(config.signingMode, "simulated");
  assert.equal(config.solanaRpcUrl, "https://api.devnet.solana.com");
});

test("loadConfig leaves gas sponsorship off unless a relayer key is configured", () => {
  const config = loadConfig({});
  assert.equal(config.relayerKeypairJson, undefined);
  assert.equal(config.relayerKeypairPath, undefined);
});

test("loadConfig reads the gas relayer keypair", () => {
  const config = loadConfig({ KNOT_RELAYER_KEYPAIR_PATH: "/secrets/relayer.json" });
  assert.equal(config.relayerKeypairPath, "/secrets/relayer.json");
});

test("loadConfig enables devnet signing explicitly", () => {
  const config = loadConfig({
    KNOT_WEB3_SIGNING_MODE: "devnet",
    KNOT_BRAND_KEYPAIR_PATH: "/secrets/brand.json",
    SOLANA_RPC_URL: "http://127.0.0.1:8899"
  });
  assert.equal(config.signingMode, "devnet");
  assert.equal(config.brandKeypairPath, "/secrets/brand.json");
  assert.equal(config.solanaRpcUrl, "http://127.0.0.1:8899");
});
