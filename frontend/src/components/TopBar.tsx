import Link from "next/link";

export function TopBar() {
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
          <nav aria-label="Product navigation" className="flex gap-2 text-sm font-semibold">
            <Link href="/login" className="hover:text-muted">
              Login
            </Link>
            <Link href="/signup" className="hover:text-muted">
              Sign up
            </Link>
            <Link href="/brand/onboarding" className="hover:text-muted">
              Brand
            </Link>
            <Link href="/creator/onboarding" className="hover:text-muted">
              Creator
            </Link>
            <Link href="/dev/admin" className="hover:text-muted">
              Dev
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
