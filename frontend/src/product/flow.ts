import type { Role } from "./types";

/** docs/24_UX_JOURNEY_v1.md §2 — 전체 7개. */
export const appRoutes = [
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
] as const;

/** 로그인 직후 각 역할이 시작하는 곳. */
export function roleEntry(role: Role) {
  return role === "brand" ? "/brand/onboarding" : "/creator/onboarding";
}

/** 상단바에 노출할 것 — 홈(채팅창) 하나면 충분하다. */
export const brandWorkspaceRoutes = [
  { href: "/brand", label: "내 매니저" },
  { href: "/mypage", label: "마이페이지" },
] as const;
export const creatorWorkspaceRoutes = [
  { href: "/creator", label: "내 매니저" },
  { href: "/mypage", label: "마이페이지" },
] as const;
