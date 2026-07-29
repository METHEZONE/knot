import assert from "node:assert/strict";
import test from "node:test";
import {
  appRoutes,
  brandWorkspaceRoutes,
  creatorWorkspaceRoutes,
  roleEntry,
} from "../src/product/flow";
import { runDeal, verifyEvidence } from "../src/product/journey";
import { lookupInstagram, suggestedMinUsdc } from "../src/product/setupStore";
import type { BrandSetup, CreatorSetup } from "../src/product/setupStore";

const creator = (minUsdc: number): CreatorSetup => ({
  ...lookupInstagram("@demobeauty"),
  minUsdc,
  blocked: ["gambling"],
});

const brand = (maxPerDealUsdc: number): BrandSetup => ({
  productUrl: "https://demo-skincare.example.com/spf-daily",
  productName: "데일리 SPF 모이스처라이저",
  priceKrw: 28_000,
  summary: "",
  category: "beauty",
  moodTags: ["차분함", "설명형"],
  totalUsdc: 2_000,
  maxPerDealUsdc,
});

test("route surface includes v2 onboarding entries and UI reference routes", () => {
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
    "/creator/settings",
    "/onboarding/brand",
    "/brand/onboarding",
    "/brand/product",
    "/brand/mood",
    "/brand",
    "/brand/settings",
    "/dev/admin",
  ]);
});

test("each role's nav is just its own chat home", () => {
  assert.deepEqual(brandWorkspaceRoutes.map((r) => r.href), ["/brand", "/mypage"]);
  assert.deepEqual(creatorWorkspaceRoutes.map((r) => r.href), ["/creator", "/mypage"]);
  assert.equal(roleEntry("brand"), "/brand/onboarding");
  assert.equal(roleEntry("creator"), "/creator/onboarding");
});

test("instagram lookup is deterministic and carries a capture date", () => {
  const a = lookupInstagram("@demobeauty");
  const b = lookupInstagram("demobeauty");
  assert.deepEqual(a, b);
  assert.match(a.capturedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(suggestedMinUsdc(a.followers, a.engagementRate) >= 150);
});

test("deal agrees at the creator floor when it fits the brand's per-deal cap", () => {
  const out = runDeal(creator(650), brand(800));
  assert.equal(out.blocked, false);
  assert.equal(out.agreedUsdc, 650);
  // 내림 후 나머지는 마지막 마일스톤으로 (settlement.py와 동일).
  assert.deepEqual(out.milestones.map((m) => m.usdc), [195, 455]);
  assert.equal(out.milestones[0].usdc + out.milestones[1].usdc, 650);
  assert.ok(out.termsHash.startsWith("sha256:"));
});

test("policy blocks the deal when the floor exceeds the cap", () => {
  const out = runDeal(creator(1_200), brand(800));
  assert.equal(out.blocked, true);
  assert.equal(out.agreedUsdc, null);
  assert.ok(out.rounds.some((r) => r.speaker === "policy"));
  // 결렬이어도 후보 3명은 남는다 — 데모 하드 게이트.
  assert.equal(out.candidates.length, 3);
});

test("the selected candidate always ranks first", () => {
  const out = runDeal(creator(650), brand(800));
  const [top, ...rest] = out.candidates;
  assert.equal(top.selected, true);
  assert.ok(rest.every((c) => c.fit < top.fit));
});

test("both outcomes always surface three candidates and stay within five rounds", () => {
  for (const floor of [200, 650, 1_200]) {
    const out = runDeal(creator(floor), brand(800));
    assert.equal(out.candidates.length, 3);
    assert.ok(out.rounds.every((r) => r.round <= out.maxRounds));
  }
});

test("evidence verification is deterministic", () => {
  assert.equal(verifyEvidence("https://www.instagram.com/reel/abc").passed, true);
  assert.equal(verifyEvidence("not-a-url").passed, false);
});
