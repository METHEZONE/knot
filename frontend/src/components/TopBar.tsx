"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";

/**
 * Global top bar: wordmark, role switcher placeholder (brand/creator),
 * and the notification feed.
 */
export function TopBar() {
  const pathname = usePathname();

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
            className="flex rounded-full border border-border-subtle bg-surface p-0.5"
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

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
