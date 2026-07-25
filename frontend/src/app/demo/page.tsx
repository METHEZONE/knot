"use client";

/**
 * Demo sign-in stand-in (PRD v2 §3).
 *
 * Google + Solana wallet sign-in is still coming; until then, demo accounts
 * bind straight to seeded `brand-001` / `creator-001` so every gate in
 * `17_DEMO_ACCEPTANCE.md` runs without an auth dependency. `?demo=brand` /
 * `?demo=creator` deep links (from the marketing site) short-circuit this
 * picker entirely and land straight in that role's hatching onboarding.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AgentCharacter } from "@/components/AgentCharacter";
import {
  DEMO_SEEDS,
  demoRoleFromSearch,
  persistDemoRole,
  type DemoRole,
} from "@/lib/demoSession";

const CARDS: {
  role: DemoRole;
  side: "brand" | "creator";
  label: string;
  copy: string;
}[] = [
  {
    role: "brand",
    side: "brand",
    label: "Enter as a brand",
    copy: "Set your budget and limits, then watch your agent find creators, negotiate, and lock escrow.",
  },
  {
    role: "creator",
    side: "creator",
    label: "Enter as a creator",
    copy: "Set your rate card and rules, then watch offers get screened and negotiated for you.",
  },
];

export default function DemoSignInPage() {
  const router = useRouter();

  useEffect(() => {
    const role = demoRoleFromSearch(window.location.search);
    if (!role) return;
    persistDemoRole(role);
    router.replace(DEMO_SEEDS[role].onboarding);
  }, [router]);

  function enter(role: DemoRole) {
    persistDemoRole(role);
    router.push(DEMO_SEEDS[role].onboarding);
  }

  return (
    <div className="flex flex-col items-center gap-10 py-14 text-center">
      <div className="flex max-w-xl flex-col items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Who&apos;s hatching an agent today?
        </h1>
        <p className="text-sm text-muted">
          Sign-in with Google and a Solana wallet is coming — for now, demo
          accounts bind to seeded data so every demo runs without auth.
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        {CARDS.map((card) => {
          const seed = DEMO_SEEDS[card.role];
          return (
            <div
              key={card.role}
              className="flex flex-col items-center gap-4 sketch ink border border-border-subtle bg-surface p-6"
            >
              <button
                type="button"
                onClick={() => enter(card.role)}
                className="flex w-full flex-col items-center gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-raised"
              >
                <AgentCharacter
                  agentId={seed.agentId}
                  side={card.side}
                  category="beauty"
                  pose="idle"
                  size={96}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="text-base font-semibold text-foreground">
                    {card.label}
                  </div>
                  <p className="max-w-xs text-xs leading-relaxed text-muted">
                    {card.copy}
                  </p>
                </div>
              </button>
              <Link
                href={seed.home}
                className="text-[11px] text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                skip onboarding →
              </Link>
            </div>
          );
        })}
      </div>

      <p className="max-w-md text-[11px] text-muted">
        Demo data · Solana devnet · no real money moves. Wallets shown in the
        app are display-only — KNOT never holds your keys.
      </p>
    </div>
  );
}
