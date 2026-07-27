import Link from "next/link";

export default function Page() {
  return (
    <main className="fixed inset-0 bg-[#fffdf8]">
      <nav
        aria-label="Landing account navigation"
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-5 py-4 text-[#1d1b16] md:px-8"
      >
        <Link href="/" className="font-mono text-sm font-bold uppercase tracking-[0.14em]">
          KNOT
        </Link>
        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
          <Link
            href="/login"
            className="rounded-full border-2 border-[#1d1b16] bg-[#fffdf8]/85 px-4 py-2 shadow-[3px_3px_0_#1d1b16] backdrop-blur transition-transform hover:-translate-y-0.5"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="rounded-full border-2 border-[#1d1b16] bg-[#b8ff65] px-4 py-2 shadow-[3px_3px_0_#1d1b16] transition-transform hover:-translate-y-0.5"
          >
            회원가입
          </Link>
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
