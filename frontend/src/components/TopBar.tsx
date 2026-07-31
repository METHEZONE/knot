"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
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
    <header className="sticky top-0 z-50 border-b-2 border-border-subtle bg-background/85 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="display text-2xl text-foreground">knot</span>
          <span className="hidden text-xs text-muted sm:inline">크리에이터 x 브랜드, 에이전트끼리</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {context?.account.role ? (
            <span className="sketch-pill ink hidden border border-border-subtle bg-surface-raised px-3 py-1 font-mono text-[10px] uppercase text-muted sm:inline-flex">
              {context.account.role}
            </span>
          ) : null}
          <nav aria-label="Product navigation" className="flex flex-wrap items-center gap-2 text-sm">
            {menu.includes("loading") && (
              <span className="inline-block h-4 w-28 animate-pulse rounded-full bg-border-subtle/20" aria-label="인증 상태 확인 중" />
            )}
            {menu.includes("login") && <NavLink href="/login">로그인</NavLink>}
            {menu.includes("signup") && <NavLink href="/signup">회원가입</NavLink>}
            {menu.includes("dashboard") && dashboardPath && (
              <NavLink href={dashboardPath}>대시보드</NavLink>
            )}
            {menu.includes("mypage") && (
              <NavLink href={getMyPagePath(context?.account.role)}>마이페이지</NavLink>
            )}
            {menu.includes("logout") && (
              <button
                type="button"
                onClick={handleLogout}
                className="sketch-pill ink border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-raised"
              >
                로그아웃
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="sketch-pill ink border border-border-subtle bg-surface px-3 py-1.5 hover:bg-surface-raised">
      {children}
    </Link>
  );
}
