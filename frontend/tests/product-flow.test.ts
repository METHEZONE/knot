import assert from "node:assert/strict";
import test from "node:test";
import { accountRoutes, appRoutes, brandWorkspaceRoutes, creatorWorkspaceRoutes, roleHome, roleNegotiation, roleResult } from "../src/product/flow";
import { createKnotDataSource, resolveDataMode } from "../src/product/dataSource";
import type { ApiPromotion } from "../src/product/apiClient";

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
    "/creator/agreements/[agreementId]",
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
    "/creator/result",
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

test("data source defaults to API mode unless mock mode is explicitly requested", () => {
  const previous = process.env.NEXT_PUBLIC_KNOT_DATA_MODE;
  delete process.env.NEXT_PUBLIC_KNOT_DATA_MODE;
  delete process.env.KNOT_DATA_MODE;
  try {
    assert.equal(resolveDataMode(), "api");
    process.env.NEXT_PUBLIC_KNOT_DATA_MODE = "mock";
    assert.equal(resolveDataMode(), "mock");
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_KNOT_DATA_MODE;
    } else {
      process.env.NEXT_PUBLIC_KNOT_DATA_MODE = previous;
    }
  }
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
  const mockDataSource = createKnotDataSource("mock");
  const brand = await mockDataSource.getNegotiation("brand");
  const creator = await mockDataSource.getNegotiation("creator");

  assert.equal(brand.taskId, creator.taskId);
  assert.ok(brand.publicSummary.some((line) => line.includes("최소 단가")));
  assert.ok(creator.publicSummary.some((line) => line.includes("hard maximum")));
  assert.equal(brand.termsHash, creator.termsHash);
});

test("mock data source exposes DB-ready creator deal and criteria collections", async () => {
  const mockDataSource = createKnotDataSource("mock");
  const criteria = await mockDataSource.getCreatorCriteria();
  const deals = await mockDataSource.getCreatorDeals();
  const agreedDeal = await mockDataSource.getCreatorDeal("agreement-demo-glow");

  assert.ok(criteria.blockedDomains.includes("담배"));
  assert.ok(deals.some((deal) => deal.status === "AGREED"));
  assert.equal(agreedDeal?.settlement.escrowStatus, "PARTIALLY_RELEASED");
});

test("API data source reads a pending negotiation without creating agent resources", async () => {
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  const promotion: ApiPromotion = {
    promotionId: "promotion-api-pending",
    brandId: "brand-api",
    brandAgentId: "brand-agent-api",
    title: "API pending Promotion",
    objective: "awareness",
    category: "beauty",
    targetAudience: ["20s"],
    budget: { totalUsdc: 1200, maxPerCreatorUsdc: 600 },
    deliverables: [{ format: "reel", count: 1 }],
    postingWindow: { start: "2026-08-01", end: "2026-08-10" },
    usageRights: "paidBoost30d",
    constraints: { requiredDisclosures: ["ad"], prohibitedClaims: [] },
    autonomy: { maxNegotiationRounds: 5, autoEscrow: false, autoRelease: false },
    status: "DRAFT",
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    if (url.endsWith("/api/v1/promotions/promotion-api-pending")) {
      return Response.json({ data: { promotion } });
    }
    if (url.endsWith("/api/v1/promotions/promotion-api-pending/timeline")) {
      return Response.json({ data: { events: [] } });
    }
    return Response.json({ detail: { title: "Unexpected request", code: "TEST_ERROR" } }, { status: 500 });
  }) as typeof fetch;

  try {
    const apiDataSource = createKnotDataSource("api");
    const view = await apiDataSource.getNegotiation("brand", {
      promotionId: "promotion-api-pending",
    });
    assert.equal(view.agreementId, null);
    assert.equal(view.negotiationId, null);
    assert.deepEqual(calls.map((call) => call.method), ["GET", "GET"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
