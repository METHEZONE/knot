"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthProvider";
import { getMyPagePath, headerMenuForAuth } from "@/auth/authState";

export function TopBar() {
  const router = useRouter();
  const { status, context, dashboardPath, logout } = useAuth();
  const menu = headerMenuForAuth(status, context?.account.role);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

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
            {menu.includes("loading") && (
              <span className="inline-block h-4 w-28 animate-pulse rounded-full bg-border-subtle/20" aria-label="인증 상태 확인 중" />
            )}
            {menu.includes("login") && <Link href="/login" className="hover:text-muted">로그인</Link>}
            {menu.includes("signup") && <Link href="/signup" className="hover:text-muted">회원가입</Link>}
            {menu.includes("dashboard") && dashboardPath && (
              <Link href={dashboardPath} className="hover:text-muted">대시보드</Link>
            )}
            {menu.includes("mypage") && (
              <Link href={getMyPagePath(context?.account.role)} className="hover:text-muted">마이페이지</Link>
            )}
            {menu.includes("logout") && (
              <button type="button" onClick={handleLogout} className="font-semibold hover:text-muted">
                로그아웃
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
