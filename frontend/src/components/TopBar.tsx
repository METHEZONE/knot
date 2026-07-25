import Link from "next/link";

export function TopBar() {
  const primaryRoutes = [
    { href: "/brand/products/new", label: "Brand" },
    { href: "/creator/result", label: "Creator" },
    { href: "/dev/admin", label: "Dev" },
    { href: "/login", label: "Login" },
    { href: "/signup", label: "Sign up" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            KNOT
          </span>
          <span className="hidden text-xs text-muted sm:inline">
            agentic promotions
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label="Product navigation" className="flex flex-wrap gap-2 text-sm font-semibold">
            {primaryRoutes.map((route) => (
              <Link key={route.href} href={route.href} className="hover:text-muted">
                {route.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
