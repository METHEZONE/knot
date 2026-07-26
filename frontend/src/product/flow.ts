import type { Role } from "./types";

export const appRoutes = [
  "/",
  "/login",
  "/signup",
  "/signup/brand",
  "/signup/creator",
  "/brand",
  "/brand/onboarding",
  "/brand/products/new",
  "/brand/negotiate",
  "/brand/result",
  "/brand/settlement",
  "/brand/me",
  "/brand/settings",
  "/creator",
  "/creator/onboarding",
  "/creator/criteria",
  "/creator/result",
  "/creator/agreements/[agreementId]",
  "/creator/me",
  "/creator/settings",
  "/dev/admin",
] as const;

export function roleHome(role: Role) {
  return `/${role}`;
}

export function roleNegotiation(role: Role) {
  return role === "brand" ? "/brand/negotiate" : "/creator/result";
}

export function roleResult(role: Role) {
  return `/${role}/result`;
}

export const brandWorkspaceRoutes = [
  { href: "/brand", label: "Dashboard" },
  { href: "/brand/products/new", label: "Promotions" },
  { href: "/brand/negotiate", label: "Negotiations" },
  { href: "/brand/settlement", label: "Settlements" },
] as const;

export const creatorWorkspaceRoutes = [
  { href: "/creator", label: "Dashboard" },
  { href: "/creator/criteria", label: "Criteria" },
  { href: "/creator/result", label: "Offers" },
  { href: "/creator/result", label: "Deals" },
] as const;

export const accountRoutes = [
  { href: "/brand/me", label: "Brand My" },
  { href: "/brand/settings", label: "Brand Settings" },
  { href: "/creator/me", label: "Creator My" },
  { href: "/creator/settings", label: "Creator Settings" },
] as const;
