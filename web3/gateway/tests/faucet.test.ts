import assert from "node:assert/strict";
import test from "node:test";
import { airdrop, isLoopbackRpc } from "../src/faucet.js";
import { loadConfig } from "../src/config.js";

const localConfig = loadConfig({ SOLANA_RPC_URL: "http://127.0.0.1:8899" });
const testnetConfig = loadConfig({ SOLANA_RPC_URL: "https://api.testnet.solana.com" });

test("loopback detection accepts local validators only", () => {
  assert.equal(isLoopbackRpc("http://127.0.0.1:8899"), true);
  assert.equal(isLoopbackRpc("http://localhost:8899"), true);
  assert.equal(isLoopbackRpc("https://api.testnet.solana.com"), false);
  assert.equal(isLoopbackRpc("https://api.mainnet-beta.solana.com"), false);
  assert.equal(isLoopbackRpc("not a url"), false);
});

test("faucet refuses to run against a non-local cluster", async () => {
  const result = await airdrop(testnetConfig, { address: "11111111111111111111111111111111" });
  assert.equal(result.statusCode, 403);
  assert.equal(result.body.code, "FAUCET_DISABLED");
});

test("faucet validates the request body before touching the chain", async () => {
  const missing = await airdrop(localConfig, {});
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body.code, "VALIDATION_ERROR");

  const badAddress = await airdrop(localConfig, { address: "definitely-not-a-solana-address" });
  assert.equal(badAddress.statusCode, 400);
  assert.equal(badAddress.body.code, "VALIDATION_ERROR");
});
