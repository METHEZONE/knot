import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults", () => {
  const config = loadConfig({});
  assert.equal(config.serviceName, "knot-web3");
  assert.equal(config.solanaCluster, "devnet");
});
