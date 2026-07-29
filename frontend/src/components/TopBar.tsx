"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthProvider";
import { brandWorkspaceRoutes, creatorWorkspaceRoutes } from "@/product/flow";
import type { Role } from "@/product/types";

const ROLE_LABEL: Record<Role, { org: string; who: string }> = {
  brand: { org: "Brand", who: "Brand owner" },
  creator: { org: "Creator", who: "Creator" },
};

/**
 * 상단바는 현재 창이 누구로 로그인했는지에 따라 달라진다.
 *
 * 데모는 창 두 개를 좌우로 나란히 놓고 돌리므로, 스크린샷만 봐도 어느 창이
 * 누구인지 바로 읽혀야 한다. 그래서 로그인한 사용자와 소속을 상단에 박아두고,
 * 내비게이션도 그 역할의 워크스페이스만 노출한다 — 상대 역할 링크를 띄워두면
 * 그 창의 정체가 흐려지고, 시연 중에 상대 화면으로 새는 사고가 난다.
 */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { status, context, logout } = useAuth();
  const role = toUiRole(context?.account.role);
  const ready = status !== "loading";

  const workspace = role === "brand" ? brandWorkspaceRoutes : creatorWorkspaceRoutes;
  const homeHref =
    role && context?.account.onboardingStatus !== "COMPLETED"
      ? `/${role}/onboarding`
      : role
        ? `/${role}`
        : "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/85 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <Link href={homeHref} className="flex items-baseline gap-2">
          <span className="display text-2xl leading-none">knot</span>
          <span className="hidden text-sm text-muted sm:inline">
            크리에이터 × 브랜드, 에이전트끼리
          </span>
        </Link>

        {/* 세션을 읽기 전에는 아무것도 그리지 않는다 — 로그인한 창이 한 프레임
            로그아웃 상태로 보이는 것보다 비어 있는 게 낫다. */}
        {!ready ? null : role ? (
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="워크스페이스" className="flex flex-wrap gap-3 text-sm font-semibold">
              {workspace.map((route) => {
                const active = pathname === route.href;
                return (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={active ? "text-foreground underline" : "text-muted hover:text-foreground"}
                  >
                    {route.label}
                  </Link>
                );
              })}
            </nav>

            <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-3 py-1 text-xs">
              {role === "brand" ? "브랜드" : "크리에이터"} ·{" "}
              <span className="font-semibold">{ROLE_LABEL[role].org}</span>
              <span className="text-muted"> ({ROLE_LABEL[role].who})</span>
            </span>

            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
                className="text-muted hover:text-foreground"
              >
                로그아웃
              </button>
            </div>
          </div>
        ) : (
          <nav aria-label="계정" className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link href="/login" className="text-muted hover:text-foreground">
              로그인
            </Link>
            <Link href="/signup" className="text-muted hover:text-foreground">
              회원가입
            </Link>
            <Link href="/dev/admin" className="text-muted hover:text-foreground">
              Dev
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

function toUiRole(role: "BRAND" | "CREATOR" | null | undefined): Role | null {
  if (role === "BRAND") return "brand";
  if (role === "CREATOR") return "creator";
  return null;
}
