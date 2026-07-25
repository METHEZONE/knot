"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { DEMO_ROLE_EVENT, storedDemoRole, type DemoRole } from "@/lib/demoSession";

/**
 * Global top bar: wordmark, role switcher placeholder (brand/creator),
 * the active demo-role chip, and the notification feed.
 */
export function TopBar() {
  const pathname = usePathname();

  // Read after mount so server and client markup match — sessionStorage
  // doesn't exist on the server, so this must never affect the initial
  // render (PRD v2 §3 demo accounts).
  const [demoRole, setDemoRole] = useState<DemoRole | null>(null);
  useEffect(() => {
    // sessionStorage doesn't exist during SSR, so this has to run after
    // mount — the setState here is the sync point, not a derived value.
    const sync = () => setDemoRole(storedDemoRole());
    sync();
    // An onboarding page sets the role in its own mount effect, which can lose
    // the race against this one; listening keeps the chip honest instead of
    // showing the previous role until the next navigation.
    window.addEventListener(DEMO_ROLE_EVENT, sync);
    return () => window.removeEventListener(DEMO_ROLE_EVENT, sync);
  }, [pathname]);

  const roles = [
    { label: "Brand", href: "/brand" },
    { label: "Creator", href: "/creator" },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            KNOT
          </span>
          <span className="hidden text-xs text-muted sm:inline">
            agentic promotions
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Role switcher placeholder */}
          <nav
            aria-label="Role switcher"
            className="flex sketch-pill ink border border-border-subtle bg-surface p-0.5"
          >
            {roles.map((role) => {
              const active = pathname.startsWith(role.href);
              return (
                <Link
                  key={role.href}
                  href={role.href}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-accent/20 text-accent-strong"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {role.label}
                </Link>
              );
            })}
          </nav>

          {demoRole && (
            <Link
              href="/demo"
              className="hidden sketch-pill ink border border-border-subtle bg-surface px-2.5 py-1 font-mono text-[11px] text-muted transition-colors hover:text-foreground sm:inline"
              title="Switch demo identity"
            >
              demo · {demoRole}
            </Link>
          )}

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
