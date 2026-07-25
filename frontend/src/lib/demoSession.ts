/**
 * Demo session (PRD v2 §3).
 *
 * `?demo=brand` / `?demo=creator` bypasses sign-in and binds to the seeded
 * brand-001 / creator-001, so every gate in 17_DEMO_ACCEPTANCE runs without an
 * auth dependency. The choice is remembered for the tab so deep links inside
 * the app keep the role. Firebase Google + Solana wallet sign-in lands later
 * and will populate the same role context.
 */

export type DemoRole = "brand" | "creator";

export const DEMO_SEEDS = {
  brand: {
    role: "brand",
    brandId: "brand-001",
    agentId: "brand-agent-001",
    category: "beauty",
    home: "/brand",
    onboarding: "/onboarding/brand",
  },
  creator: {
    role: "creator",
    creatorId: "creator-001",
    agentId: "creator-agent-001",
    category: "beauty",
    home: "/creator",
    onboarding: "/onboarding/creator",
  },
} as const;

const STORAGE_KEY = "knot.demoRole";

function isDemoRole(value: string | null | undefined): value is DemoRole {
  return value === "brand" || value === "creator";
}

/** Read the role from a query string (`?demo=brand`), if present and valid. */
export function demoRoleFromSearch(search: string): DemoRole | null {
  const value = new URLSearchParams(search).get("demo");
  return isDemoRole(value) ? value : null;
}

/**
 * Fired whenever the role changes so anything already mounted can re-read it.
 * Without this, a component that reads the role in a mount effect can win the
 * race against the page that sets it and show the previous role until the next
 * navigation — which is exactly what the top bar chip did.
 */
export const DEMO_ROLE_EVENT = "knot:demo-role";

/** Remember the role for this tab. No-op during SSR. */
export function persistDemoRole(role: DemoRole): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, role);
  } catch {
    // Private-mode storage failures are not worth surfacing.
  }
  window.dispatchEvent(new Event(DEMO_ROLE_EVENT));
}

/** The remembered role for this tab, or null when nobody has entered a demo. */
export function storedDemoRole(): DemoRole | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    return isDemoRole(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearDemoRole(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
