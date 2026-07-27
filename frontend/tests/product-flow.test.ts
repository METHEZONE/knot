import assert from "node:assert/strict";
import test from "node:test";
import { firebaseAuthErrorMessage } from "../src/auth/firebaseClient";
import { getDashboardPath, headerMenuForAuth, postLoginPath, safeRedirectPath } from "../src/auth/authState";
import { accountRoutes, appRoutes, brandWorkspaceRoutes, creatorWorkspaceRoutes, roleHome, roleNegotiation, roleResult } from "../src/product/flow";
import { createKnotDataSource, resolveDataMode } from "../src/product/dataSource";
import { ProductApiClient, ProductApiError, type ApiPromotion } from "../src/product/apiClient";
import {
  calculateBrandEscrow,
  calculateCreatorSettlement,
  mapTaskStateToCreatorStatus,
  promotionProgress,
} from "../src/product/mvp";

test("product route surface exposes separated MVP role pages", () => {
  assert.deepEqual(appRoutes, [
    "/",
    "/login",
    "/signup",
    "/signup/brand",
    "/signup/creator",
    "/brand",
    "/brand/onboarding",
    "/brand/promotions",
    "/brand/promotions/new",
    "/brand/promotions/[promotionId]",
    "/brand/negotiations/[negotiationId]",
    "/brand/agreements/[agreementId]",
    "/brand/products/new",
    "/brand/negotiate",
    "/brand/result",
    "/brand/settlement",
    "/brand/me",
    "/brand/settings",
    "/creator",
    "/creator/onboarding",
    "/creator/offers",
    "/creator/offers/[negotiationId]",
    "/creator/criteria",
    "/creator/result",
    "/creator/agreements",
    "/creator/agreements/[agreementId]",
    "/creator/settlements",
    "/creator/me",
    "/creator/settings",
    "/dev/admin",
  ]);
});

test("workspace nav is menu-like and role-specific", () => {
  assert.deepEqual(brandWorkspaceRoutes.map((route) => route.href), [
    "/brand",
    "/brand/promotions",
    "/brand/promotions",
    "/brand/promotions",
  ]);
  assert.deepEqual(creatorWorkspaceRoutes.map((route) => route.href), [
    "/creator",
    "/creator/criteria",
    "/creator/offers",
    "/creator/agreements",
    "/creator/settlements",
  ]);
});

test("auth header menu follows loading unauthenticated and authenticated states", () => {
  assert.deepEqual(headerMenuForAuth("loading", null), ["loading"]);
  assert.deepEqual(headerMenuForAuth("unauthenticated", null), ["login", "signup"]);
  assert.deepEqual(headerMenuForAuth("authenticated", "BRAND"), ["dashboard", "mypage", "logout"]);
  assert.deepEqual(headerMenuForAuth("authenticated", "CREATOR"), ["dashboard", "mypage", "logout"]);
});

test("auth helpers preserve safe redirects and role dashboard paths", () => {
  assert.equal(getDashboardPath("BRAND"), "/brand");
  assert.equal(getDashboardPath("CREATOR"), "/creator");
  assert.equal(getDashboardPath(null), null);
  assert.equal(safeRedirectPath("/brand/promotions/promotion-1"), "/brand/promotions/promotion-1");
  assert.equal(safeRedirectPath("//evil.example"), null);
  assert.equal(safeRedirectPath("/api/v1/me"), null);
});

test("post-login redirect sends completed brands to dashboard instead of creation flow", () => {
  const brandAccount = {
    uid: "uid",
    userId: "uid",
    email: "brand@example.com",
    displayName: "Brand",
    photoUrl: null,
    role: "BRAND" as const,
    onboardingStatus: "COMPLETED" as const,
    status: "ACTIVE" as const,
    brandId: "brand-1",
    creatorId: null,
    agentId: "agent-brand-1",
    schemaVersion: 2,
  };

  assert.equal(postLoginPath(brandAccount, "/brand", "/brand/promotions/new"), "/brand");
  assert.equal(postLoginPath(brandAccount, "/brand", "/brand/products/new"), "/brand");
  assert.equal(postLoginPath(brandAccount, "/brand", "/brand/promotions/promotion-1"), "/brand/promotions/promotion-1");
  assert.equal(postLoginPath(brandAccount, "/brand", "/creator"), "/brand");
});

test("Firebase auth errors map to user-facing messages", () => {
  assert.equal(
    firebaseAuthErrorMessage({ code: "auth/unauthorized-domain" }),
    "현재 접속한 도메인이 Firebase 로그인 허용 목록에 등록되지 않았습니다.",
  );
  assert.equal(
    firebaseAuthErrorMessage({ code: "auth/popup-blocked" }),
    "브라우저가 로그인 팝업을 차단했습니다. 팝업을 허용해주세요.",
  );
  assert.equal(
    firebaseAuthErrorMessage({ code: "auth/weak-password" }),
    "비밀번호는 최소 6자 이상이어야 합니다.",
  );
  assert.equal(
    firebaseAuthErrorMessage({ code: "auth/operation-not-allowed" }),
    "Firebase Console에서 Email/Password 또는 Google 로그인 제공자를 활성화해야 합니다.",
  );
});

test("A2A task state maps to creator display status", () => {
  assert.equal(mapTaskStateToCreatorStatus("TASK_STATE_SUBMITTED", "OFFERED"), "제안 도착");
  assert.equal(mapTaskStateToCreatorStatus("TASK_STATE_WORKING", "WORKING"), "Agent 분석 중");
  assert.equal(mapTaskStateToCreatorStatus("TASK_STATE_AUTH_REQUIRED", "ESCALATED"), "내 승인 필요");
  assert.equal(mapTaskStateToCreatorStatus("TASK_STATE_COMPLETED", "AGREED"), "협상 성공");
  assert.equal(mapTaskStateToCreatorStatus("TASK_STATE_FAILED", "FAILED"), "협상 실패");
});

test("settlement and promotion selectors keep MVP concepts separated", () => {
  assert.deepEqual(
    calculateCreatorSettlement([
      { status: "RELEASED", amountUsdc: 300 },
      { status: "VERIFIED", amountUsdc: 200 },
      { status: "SUBMITTED", amountUsdc: 100 },
    ]),
    { paidAmount: 300, availableToClaimAmount: 200, pendingAmount: 100 },
  );
  assert.deepEqual(
    calculateBrandEscrow(
      {
        escrowId: "escrow-1",
        agreementId: "agreement-1",
        promotionId: "promotion-1",
        lockedAmountBaseUnits: "1000000000",
        releasedAmountBaseUnits: "300000000",
        status: "LOCKED",
        lockSignature: null,
        lockReceiptId: "receipt-1",
      },
      [{ settlementId: "settlement-1", escrowId: "escrow-1", agreementId: "agreement-1", milestoneId: "content", amountBaseUnits: "300000000", status: "CONFIRMED", signature: "sig" }],
    ),
    { lockedAmount: 700, releasableAmount: 0, releasedAmount: 300 },
  );
  assert.equal(
    promotionProgress({
      promotionId: "promotion-1",
      brandId: "brand-1",
      brandAgentId: "agent-1",
      title: "Promo",
      objective: "awareness",
      category: "beauty",
      targetAudience: ["20s"],
      budget: { totalUsdc: 1000, maxPerCreatorUsdc: 500 },
      deliverables: [],
      postingWindow: { start: "2026-08-01", end: "2026-08-10" },
      usageRights: "organicOnly",
      status: "NEGOTIATING",
    }),
    38,
  );
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
  assert.equal(roleHome("brand"), "/brand");
  assert.equal(roleNegotiation("brand"), "/brand/negotiate");
  assert.equal(roleResult("brand"), "/brand/result");
  assert.equal(roleHome("creator"), "/creator");
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
  const agreedDeal = await mockDataSource.getCreatorDeal("agreement-mock-alpha");

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

test("API client does not start negotiation when matching has no eligible creator", async () => {
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  const promotion: ApiPromotion = {
    promotionId: "promotion-no-candidate",
    brandId: "brand-api",
    brandAgentId: "brand-agent-api",
    title: "No candidate Promotion",
    objective: "awareness",
    category: "gambling",
    targetAudience: ["20s"],
    budget: { totalUsdc: 100, maxPerCreatorUsdc: 100 },
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
    if (url.endsWith("/api/v1/promotions/promotion-no-candidate")) {
      return Response.json({ data: { promotion } });
    }
    if (url.endsWith("/api/v1/promotions/promotion-no-candidate/matches:run")) {
      return Response.json(
        {
          data: {
            matchRun: {
              matchRunId: "match-no-candidate",
              promotionId: "promotion-no-candidate",
              brandAgentId: "brand-agent-api",
              status: "COMPLETED",
              selectedCreatorId: null,
              selectedCreatorAgentId: null,
            },
          },
        },
        { status: 201 },
      );
    }
    if (url.endsWith("/api/v1/match-runs/match-no-candidate/candidates")) {
      return Response.json({
        data: {
          candidates: [
            {
              creatorId: "creator-001",
              creatorAgentId: "creator-agent-001",
              eligible: false,
              hardFilterReasons: ["CATEGORY_MISMATCH", "RATE_EXCEEDS_MAX_PER_CREATOR"],
            },
          ],
        },
      });
    }
    return Response.json({ detail: { title: "Unexpected request", code: "TEST_ERROR" } }, { status: 500 });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => new ProductApiClient("").runAgentForPromotion("promotion-no-candidate"),
      (error) =>
        error instanceof ProductApiError &&
        error.code === "NO_ELIGIBLE_CREATOR" &&
        error.message.includes("CATEGORY_MISMATCH"),
    );
    assert.deepEqual(calls.map((call) => call.method), ["GET", "POST", "GET"]);
    assert.ok(!calls.some((call) => call.url.includes(":start-negotiation")));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("API client forwards Firebase bearer token when configured", async () => {
  const previousFetch = globalThis.fetch;
  let observedAuthorization: string | null = null;
  ProductApiClient.setAuthTokenProvider(async () => "firebase-test-token");

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    observedAuthorization = new Headers(init?.headers).get("Authorization");
    return Response.json({
      data: {
        account: {
          uid: "firebase-uid",
          userId: "firebase-uid",
          email: "tester@example.com",
          displayName: "Tester",
          photoUrl: null,
          role: null,
          onboardingStatus: "ROLE_REQUIRED",
          status: "ACTIVE",
          brandId: null,
          creatorId: null,
          agentId: null,
          schemaVersion: 2,
        },
        profileSummary: null,
        dashboardTarget: "/signup",
      },
    });
  }) as typeof fetch;

  try {
    const context = await new ProductApiClient("").getMe();
    assert.equal(context.account.uid, "firebase-uid");
    assert.equal(observedAuthorization, "Bearer firebase-test-token");
  } finally {
    ProductApiClient.setAuthTokenProvider(null);
    globalThis.fetch = previousFetch;
  }
});

test("API client reads authenticated role dashboards without mock fallback", async () => {
  const previousFetch = globalThis.fetch;
  const calls: string[] = [];
  ProductApiClient.setAuthTokenProvider(async () => "firebase-dashboard-token");

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer firebase-dashboard-token");
    if (String(input).endsWith("/api/v1/brand/dashboard")) {
      return Response.json({
        data: {
          dashboard: {
            brand: { brandId: "brand-owned", displayName: "Brand" },
            summary: {
              activePromotions: 0,
              negotiationsInProgress: 0,
              agreements: 0,
              lockedEscrowBaseUnits: "0",
            },
            activePromotions: [],
            recentAgentActivity: [],
            contractedCreators: [],
          },
        },
      });
    }
    if (String(input).endsWith("/api/v1/creator/dashboard")) {
      return Response.json({
        data: {
          dashboard: {
            creator: { creatorId: "creator-owned", displayName: "Creator" },
            summary: {
              newOffers: 0,
              agentNegotiations: 0,
              activeSponsorships: 0,
              pendingPayoutBaseUnits: "0",
            },
            offers: [],
            activeSponsorships: [],
            recentAgentActivity: [],
          },
        },
      });
    }
    return Response.json({ detail: { title: "Unexpected request", code: "TEST_ERROR" } }, { status: 500 });
  }) as typeof fetch;

  try {
    const api = new ProductApiClient("");
    assert.equal((await api.getBrandDashboard()).brand.brandId, "brand-owned");
    assert.equal((await api.getCreatorDashboard()).creator.creatorId, "creator-owned");
    assert.deepEqual(calls, ["/api/v1/brand/dashboard", "/api/v1/creator/dashboard"]);
  } finally {
    ProductApiClient.setAuthTokenProvider(null);
    globalThis.fetch = previousFetch;
  }
});

test("API client uses resource routes for promotions offers and agreements", async () => {
  const previousFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  ProductApiClient.setAuthTokenProvider(async () => "resource-token");

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer resource-token");
    if (url.endsWith("/api/v1/brand/promotions") && init?.method === "POST") {
      return Response.json({ data: { promotion: { promotionId: "promotion-resource" } } }, { status: 201 });
    }
    if (url.endsWith("/api/v1/brand/promotions/promotion-resource")) {
      return Response.json({
        data: {
          promotion: { promotionId: "promotion-resource", title: "Resource", status: "DRAFT" },
          agreement: null,
          activity: [],
        },
      });
    }
    if (url.endsWith("/api/v1/creator/offers/negotiation-resource")) {
      return Response.json({
        data: {
          offer: { negotiationId: "negotiation-resource", status: "OFFERED" },
          negotiation: { negotiationId: "negotiation-resource", currentTerms: {} },
        },
      });
    }
    if (url.endsWith("/api/v1/brand/agreements/agreement-resource")) {
      return Response.json({
        data: {
          agreement: { agreementId: "agreement-resource", status: "AGREED" },
          escrow: null,
        },
      });
    }
    return Response.json({ detail: { title: "Unexpected request", code: "TEST_ERROR" } }, { status: 500 });
  }) as typeof fetch;

  try {
    const api = new ProductApiClient("");
    await api.createBrandPromotion(
      {
        productName: "Product",
        title: "Resource",
        objective: "awareness",
        categories: ["beauty"],
        targetAudience: "skincare",
        totalBudget: 1000,
        initialOffer: 500,
        maximumPerCreator: 700,
        autoAcceptCeiling: 650,
        maximumRounds: 3,
        deliverables: [{ format: "reel", count: 1 }],
        usageRights: "organicOnly",
        deadline: "2026-08-10",
        prohibitedClaims: [],
      },
      "frontend-resource-test",
    );
    await api.getBrandPromotionDetail("promotion-resource");
    await api.getCreatorOfferDetail("negotiation-resource");
    await api.getBrandAgreementDetail("agreement-resource");
    assert.deepEqual(calls, [
      { url: "/api/v1/brand/promotions", method: "POST" },
      { url: "/api/v1/brand/promotions/promotion-resource", method: "GET" },
      { url: "/api/v1/creator/offers/negotiation-resource", method: "GET" },
      { url: "/api/v1/brand/agreements/agreement-resource", method: "GET" },
    ]);
  } finally {
    ProductApiClient.setAuthTokenProvider(null);
    globalThis.fetch = previousFetch;
  }
});
