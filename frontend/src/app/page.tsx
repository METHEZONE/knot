"use client";

/**
 * Root landing + demo entry (PRD v2 §3).
 *
 * Production serves the marketing site at `thezonebio.com/knot` and links
 * into this app with `?demo=brand` / `?demo=creator`. Because Next is built
 * with `basePath=/knot/app`, those links arrive here at `/`, not `/demo` —
 * so the root page has to honour `?demo=` itself and short-circuit straight
 * into the matching hatching onboarding. Anyone landing without that param
 * sees the marketing-style pitch and a path into `/demo`.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEMO_SEEDS, demoRoleFromSearch, persistDemoRole } from "@/lib/demoSession";

const steps = [
  { title: "Match", body: "Agents rank creators against your promotion with explainable scores." },
  { title: "Negotiate", body: "Offer, counter, accept — every round logged with rationale." },
  { title: "Escrow", body: "USDC locked on agreement, released per milestone. Zero fees." },
  { title: "Verify", body: "Evidence checked against disclosures and policy before release." },
];

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const role = demoRoleFromSearch(window.location.search);
    if (!role) return;
    persistDemoRole(role);
    router.replace(DEMO_SEEDS[role].onboarding);
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-14 py-16 text-center">
      <div className="flex max-w-2xl flex-col items-center gap-5">
        <span className="sketch-pill ink border border-border-subtle bg-surface px-3 py-1 text-xs text-muted">
          creator × brand · agent-to-agent
        </span>
        <h1 className="text-5xl font-semibold tracking-tight">
          Promotions that run themselves.
        </h1>
        <p className="max-w-xl text-balance text-muted">
          KNOT ties brands and creators together. Your agent matches, negotiates,
          locks escrow, and verifies delivery — you approve the moments that matter.
        </p>
        <div className="mt-2 flex flex-col items-center gap-3">
          <Link
            href="/demo"
            className="sketch-pill bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Try the demo
          </Link>
          <div className="flex gap-4 text-xs text-muted">
            <Link href="/onboarding/brand" className="hover:text-foreground">
              I&apos;m a brand
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/onboarding/creator" className="hover:text-foreground">
              I&apos;m a creator
            </Link>
          </div>
          <p className="text-[11px] text-muted">
            Demo data · Solana devnet · no real money moves.
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="sketch ink border border-border-subtle bg-surface p-5 text-left"
          >
            <div className="mb-2 font-mono text-xs text-accent">0{i + 1}</div>
            <div className="mb-1 text-sm font-semibold">{step.title}</div>
            <p className="text-xs leading-relaxed text-muted">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
