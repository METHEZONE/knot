import assert from "node:assert/strict";
import test from "node:test";
import { brandFlow, creatorFlow, minimumMvpRoutes } from "../src/simple/flow";

test("creator flow is the requested five-step MVP path", () => {
  assert.deepEqual(
    creatorFlow.map(([label]) => label),
    ["온보딩", "제안받기", "협상하기", "결과", "마일스톤"],
  );
});

test("brand flow is the requested five-step MVP path", () => {
  assert.deepEqual(
    brandFlow.map(([label]) => label),
    ["온보딩", "매칭", "협상하기", "결과", "정산"],
  );
});

test("minimum route list contains only root plus the two MVP flows", () => {
  assert.equal(minimumMvpRoutes.length, 11);
  assert.ok(minimumMvpRoutes.includes("/"));
  assert.ok(minimumMvpRoutes.includes("/creator/milestones"));
  assert.ok(minimumMvpRoutes.includes("/brand/settlement"));
});
