import Link from "next/link";

export default function Page() {
  return (
    <main className="fixed inset-0 bg-[#fffdf8]">
      <nav aria-label="Landing account navigation" className="fixed left-0 right-0 top-0 z-50 border-b border-border-subtle bg-background/80 backdrop-blur">
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
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <Link href="/login" className="hover:text-muted">로그인</Link>
              <Link href="/signup" className="hover:text-muted">회원가입</Link>
            </div>
          </div>
        </div>
      </nav>
      <iframe
        src="/knot/index.html"
        title="knot — 크리에이터와 브랜드를 잇는 매듭"
        className="h-full w-full border-0 bg-[#fffdf8]"
      />
    </main>
  );
}
