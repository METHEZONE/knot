import type { Role } from "./types";

export const appRoutes = [
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
] as const;

export function roleHome(role: Role) {
  return `/${role}/onboarding`;
}

export function roleNegotiation(role: Role) {
  return role === "brand" ? "/brand/negotiate" : "/creator/result";
}

export function roleResult(role: Role) {
  return `/${role}/result`;
}

export const brandWorkspaceRoutes = [
  { href: "/brand/onboarding", label: "Brand profile" },
  { href: "/brand/products/new", label: "Product" },
  { href: "/brand/negotiate", label: "Negotiation" },
  { href: "/brand/result", label: "Result" },
  { href: "/brand/settlement", label: "Settlement" },
  { href: "/brand/me", label: "My page" },
  { href: "/brand/settings", label: "Settings" },
] as const;

export const creatorWorkspaceRoutes = [
  { href: "/creator/onboarding", label: "SNS profile" },
  { href: "/creator/criteria", label: "Criteria" },
  { href: "/creator/result", label: "Results" },
  { href: "/creator/brands/glow-bar", label: "Brand deal" },
  { href: "/creator/me", label: "My page" },
  { href: "/creator/settings", label: "Settings" },
] as const;
