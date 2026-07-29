import type { Role } from "./types";

/** KNOT v2 active route surface. */
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
] as const;

/** 로그인 직후 각 역할이 시작하는 곳. */
export function roleEntry(role: Role) {
  return role === "brand" ? "/brand/onboarding" : "/creator/onboarding";
}

/** 상단바에 노출할 것. */
export const brandWorkspaceRoutes = [
  { href: "/brand", label: "Dashboard" },
  { href: "/brand/agent", label: "Agent" },
  { href: "/mypage", label: "마이페이지" },
] as const;
export const creatorWorkspaceRoutes = [
  { href: "/creator", label: "Dashboard" },
  { href: "/creator/agent", label: "Agent" },
  { href: "/mypage", label: "마이페이지" },
] as const;
