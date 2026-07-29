import type { Role } from "./types";

export const appRoutes = [
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
  "/brand/promotions/[promotionId]/negotiations/[negotiationId]",
  "/brand/negotiations/[negotiationId]",
  "/brand/agreements/[agreementId]",
  "/brand/products/new",
  "/brand/negotiate",
  "/brand/result",
  "/brand/settlement",
  "/brand/settlements",
  "/brand/me",
  "/brand/settings",
  "/brand/settings/agent",
  "/creator",
  "/creator/onboarding",
  "/creator/deals",
  "/creator/deals/[dealId]",
  "/creator/offers",
  "/creator/offers/[negotiationId]",
  "/creator/criteria",
  "/creator/result",
  "/creator/agreements",
  "/creator/agreements/[agreementId]",
  "/creator/settlements",
  "/creator/me",
  "/creator/settings",
  "/creator/settings/agent",
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
  { href: "/brand/promotions", label: "Promotions" },
  { href: "/brand/promotions", label: "Negotiations" },
  { href: "/brand/settlements", label: "Settlements" },
  { href: "/brand/settings/agent", label: "Agent" },
] as const;

export const creatorWorkspaceRoutes = [
  { href: "/creator", label: "Dashboard" },
  { href: "/creator/offers", label: "Offers" },
  { href: "/creator/deals", label: "Deals" },
  { href: "/creator/settlements", label: "Settlements" },
  { href: "/creator/settings/agent", label: "Agent" },
] as const;

export const accountRoutes = [
  { href: "/brand/me", label: "Brand My" },
  { href: "/brand/settings", label: "Brand Settings" },
  { href: "/creator/me", label: "Creator My" },
  { href: "/creator/settings", label: "Creator Settings" },
] as const;
