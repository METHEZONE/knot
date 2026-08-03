"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { getDashboardPath, safeRedirectPath } from "@/auth/authState";
import type { CurrentUserContext } from "@/product/apiClient";

type GuardRole = "BRAND" | "CREATOR";

type AuthGateProps = {
  expectedRole?: GuardRole;
  requireCompleted?: boolean;
  completedRedirect?: string;
  children: (context: CurrentUserContext) => ReactNode;
};

export function AuthGate({
  expectedRole,
  requireCompleted = false,
  completedRedirect,
  children,
}: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, context, error } = useAuth();

  useEffect(() => {
    if (status !== "authenticated" || !context) return;
    const account = context.account;
    if (!account.role) {
      router.replace("/signup");
      return;
    }
    if (completedRedirect && account.onboardingStatus === "COMPLETED") {
      router.replace(completedRedirect);
      return;
    }
    if (requireCompleted && account.onboardingStatus !== "COMPLETED") {
      router.replace(account.role === "BRAND" ? "/brand/onboarding" : "/creator/connect");
      return;
    }
    if (expectedRole && account.role !== expectedRole) {
      router.replace(getDashboardPath(account.role) ?? "/signup");
    }
  }, [completedRedirect, context, expectedRole, requireCompleted, router, status]);

  if (status === "loading") {
    return <GuardPanel title="계정 확인 중" body="Firebase session과 Product API account context를 확인하고 있습니다." />;
  }

  if (status === "unauthenticated") {
    return (
      <GuardPanel
        title="로그인이 필요합니다"
        body={error ?? "계정 확인 후 이 페이지로 다시 돌아올 수 있습니다."}
        actionLabel="로그인"
        onAction={() => {
          const query = searchParams.toString();
          const currentPath = `${pathname}${query ? `?${query}` : ""}`;
          router.push(`/login?redirect=${encodeURIComponent(safeRedirectPath(currentPath) ?? pathname)}`);
        }}
      />
    );
  }

  if (!context) {
    return <GuardPanel title="다시 시도해주세요" body="계정 정보를 불러오지 못했습니다." actionLabel="새로고침" onAction={() => window.location.reload()} />;
  }

  const account = context.account;
  if (!account.role) {
    return <GuardPanel title="역할 선택이 필요합니다" body="회원가입에서 Brand 또는 Creator 역할을 선택해주세요." />;
  }
  if (expectedRole && account.role !== expectedRole) {
    return <GuardPanel title="이동 중입니다" body="현재 계정 역할에 맞는 대시보드로 이동합니다." />;
  }
  if (requireCompleted && account.onboardingStatus !== "COMPLETED") {
    return <GuardPanel title="온보딩이 필요합니다" body="프로필을 먼저 완성하면 대시보드를 볼 수 있습니다." />;
  }
  if (completedRedirect && account.onboardingStatus === "COMPLETED") {
    return <GuardPanel title="이동 중입니다" body="이미 완료된 계정입니다. 대시보드로 이동합니다." />;
  }

  return children(context);
}

function GuardPanel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-3xl items-center px-5 py-12">
      <section className="w-full rounded border border-border-subtle bg-surface p-6">
        <p className="text-sm font-semibold text-muted">Account</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background"
          >
            {actionLabel}
          </button>
        )}
      </section>
    </main>
  );
}
