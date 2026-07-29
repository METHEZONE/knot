import assert from "node:assert/strict";
import test from "node:test";
import {
  appRoutes,
  brandWorkspaceRoutes,
  creatorWorkspaceRoutes,
  roleEntry,
} from "../src/product/flow";
import { getDashboardPath, getMyPagePath, safeRedirectPath } from "../src/auth/authState";

test("route surface includes v2 product flow entries", () => {
  assert.deepEqual(appRoutes, [
    "/",
    "/login",
    "/signup",
    "/mypage",
    "/onboarding/creator",
    "/creator/onboarding",
    "/creator/connect",
    "/creator/rules",
    "/creator",
    "/creator/agent",
    "/creator/settings",
    "/onboarding/brand",
    "/brand/onboarding",
    "/brand/product",
    "/brand/mood",
    "/brand/promotions/new",
    "/brand",
    "/brand/agent",
    "/brand/settings",
    "/negotiations/[negotiationId]",
    "/dev/admin",
  ]);
});

test("workspace nav points to dashboard and unified mypage", () => {
  assert.deepEqual(brandWorkspaceRoutes.map((route) => route.href), ["/brand", "/brand/agent", "/mypage"]);
  assert.deepEqual(creatorWorkspaceRoutes.map((route) => route.href), ["/creator", "/creator/agent", "/mypage"]);
  assert.equal(roleEntry("brand"), "/brand/onboarding");
  assert.equal(roleEntry("creator"), "/creator/onboarding");
});

test("auth routing helpers keep users inside their role boundary", () => {
  assert.equal(getDashboardPath("BRAND"), "/brand");
  assert.equal(getDashboardPath("CREATOR"), "/creator");
  assert.equal(getDashboardPath(null), null);
  assert.equal(getMyPagePath("BRAND"), "/mypage");
  assert.equal(getMyPagePath("CREATOR"), "/mypage");
  assert.equal(getMyPagePath(null), "/signup");
});

test("safe redirect rejects external and api paths", () => {
  assert.equal(safeRedirectPath("/brand/promotions/new"), "/brand/promotions/new");
  assert.equal(safeRedirectPath("//evil.example"), null);
  assert.equal(safeRedirectPath("https://evil.example"), null);
  assert.equal(safeRedirectPath("/api/v1/me"), null);
});
