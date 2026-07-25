import assert from "node:assert/strict";
import test from "node:test";
import { accountRoutes, appRoutes, brandWorkspaceRoutes, creatorWorkspaceRoutes, roleHome, roleNegotiation, roleResult } from "../src/product/flow";
import { knotDataSource } from "../src/product/dataSource";

test("product route surface exposes separated MVP role pages", () => {
  assert.deepEqual(appRoutes, [
    "/",
    "/login",
    "/signup",
    "/signup/brand",
    "/signup/creator",
    "/brand/onboarding",
    "/brand/products/new",
    "/brand/negotiate",
    "/brand/result",
    "/brand/settlement",
    "/brand/me",
    "/brand/settings",
    "/creator/onboarding",
    "/creator/criteria",
    "/creator/result",
    "/creator/brands/glow-bar",
    "/creator/me",
    "/creator/settings",
    "/dev/admin",
  ]);
});

test("workspace nav is menu-like and role-specific", () => {
  assert.deepEqual(brandWorkspaceRoutes.map((route) => route.href), [
    "/brand/onboarding",
    "/brand/products/new",
    "/brand/negotiate",
    "/brand/settlement",
  ]);
  assert.deepEqual(creatorWorkspaceRoutes.map((route) => route.href), [
    "/creator/onboarding",
    "/creator/criteria",
    "/creator/result",
    "/creator/brands/glow-bar",
  ]);
});

test("account routes are kept out of role workspace menus", () => {
  assert.deepEqual(accountRoutes.map((route) => route.href), [
    "/brand/me",
    "/brand/settings",
    "/creator/me",
    "/creator/settings",
  ]);
});

test("role route helpers point to current MVP entry points", () => {
  assert.equal(roleHome("brand"), "/brand/onboarding");
  assert.equal(roleNegotiation("brand"), "/brand/negotiate");
  assert.equal(roleResult("brand"), "/brand/result");
  assert.equal(roleHome("creator"), "/creator/onboarding");
  assert.equal(roleNegotiation("creator"), "/creator/result");
  assert.equal(roleResult("creator"), "/creator/result");
});

test("mock data source exposes sanitized negotiation views for both roles", async () => {
  const brand = await knotDataSource.getNegotiation("brand");
  const creator = await knotDataSource.getNegotiation("creator");

  assert.equal(brand.taskId, creator.taskId);
  assert.ok(brand.publicSummary.some((line) => line.includes("최소 단가")));
  assert.ok(creator.publicSummary.some((line) => line.includes("hard maximum")));
  assert.equal(brand.termsHash, creator.termsHash);
});

test("mock data source exposes DB-ready creator deal and criteria collections", async () => {
  const criteria = await knotDataSource.getCreatorCriteria();
  const deals = await knotDataSource.getCreatorDeals();
  const agreedDeal = await knotDataSource.getCreatorDeal("glow-bar");

  assert.ok(criteria.blockedDomains.includes("담배"));
  assert.ok(deals.some((deal) => deal.status === "AGREED"));
  assert.equal(agreedDeal?.settlement.escrowStatus, "PARTIALLY_RELEASED");
});
