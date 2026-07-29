"use client";

/**
 * 역할 워크스페이스 게이트.
 *
 * `/brand/**`와 `/creator/**`를 각각 감싼다. 로그인하지 않았으면 `/login`으로,
 * 다른 역할로 로그인했으면 자기 역할의 첫 화면으로 보낸다.
 *
 * 이건 편의 기능이 아니라 PLANS.md의 프라이버시 규칙을 구조로 지키는 장치다.
 * 브랜드 화면에는 hard cap과 내부 스코어가, 크리에이터 화면에는 최저 단가와
 * 금지 주제가 있다. 게이트가 없으면 한 창에서 상대 역할 URL을 그냥 열어
 * 상대의 private 정책을 볼 수 있고, 그러면 두 유저를 나란히 시연하는 것 자체가
 * 성립하지 않는다.
 */

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthProvider";
import { getDashboardPath } from "@/auth/authState";
import type { Role } from "./types";

export function RoleGate({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, context, error } = useAuth();
  const expected = role === "brand" ? "BRAND" : "CREATOR";
  const active = context?.account.role ?? null;
  const onboardingPath = `/${role}/onboarding`;
  const inOnboarding = pathname === onboardingPath;

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.replace(`/login?redirect=/${role}`);
      return;
    }
    if (!active) {
      router.replace("/signup");
      return;
    }
    if (active !== expected) {
      router.replace(getDashboardPath(active) ?? "/signup");
      return;
    }
    if (!inOnboarding && context?.account.onboardingStatus !== "COMPLETED") {
      router.replace(onboardingPath);
    }
  }, [active, context, expected, inOnboarding, onboardingPath, role, router, status]);

  if (
    status === "loading" ||
    active !== expected ||
    (!inOnboarding && context?.account.onboardingStatus !== "COMPLETED")
  ) {
    return (
      <div className="py-24 text-center text-muted">
        {status === "unauthenticated"
          ? error ?? "로그인 화면으로 이동합니다..."
          : active
            ? "내 워크스페이스로 이동합니다..."
            : "계정 확인 중..."}
      </div>
    );
  }

  return <>{children}</>;
}
