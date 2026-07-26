"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  authConfigurationError,
  currentIdToken,
  firebaseConfigured,
  observeFirebaseUser,
} from "@/auth/firebaseClient";
import { ProductApiClient, ProductApiError, type CurrentUserContext } from "@/product/apiClient";

ProductApiClient.setAuthTokenProvider(currentIdToken);

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
  const configured = firebaseConfigured();
  const [state, setState] = useState<
    | { type: "loading" }
    | { type: "ready"; context: CurrentUserContext }
    | { type: "unauthenticated" }
    | { type: "forbidden"; message: string }
    | { type: "not-found"; message: string }
    | { type: "error"; message: string }
  >(
    configured
      ? { type: "loading" }
      : { type: "error", message: authConfigurationError() },
  );

  useEffect(() => {
    if (!configured) return;
    const unsubscribe = observeFirebaseUser((user) => {
      if (!user) {
        setState({ type: "unauthenticated" });
        return;
      }
      void new ProductApiClient()
        .getMe()
        .then((context) => {
          const account = context.account;
          if (!account.role) {
            router.replace("/signup");
            return;
          }
          if (expectedRole && account.role !== expectedRole) {
            setState({
              type: "forbidden",
              message: "현재 계정 역할로는 이 페이지에 접근할 수 없습니다.",
            });
            return;
          }
          if (completedRedirect && account.onboardingStatus === "COMPLETED") {
            router.replace(completedRedirect);
            return;
          }
          if (requireCompleted && account.onboardingStatus !== "COMPLETED") {
            router.replace(account.role === "BRAND" ? "/brand/onboarding" : "/creator/onboarding");
            return;
          }
          setState({ type: "ready", context });
        })
        .catch((error) => {
          if (error instanceof ProductApiError && error.status === 403) {
            setState({ type: "forbidden", message: error.message });
            return;
          }
          if (error instanceof ProductApiError && error.status === 404) {
            setState({ type: "not-found", message: error.message });
            return;
          }
          setState({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        });
    });
    return unsubscribe;
  }, [completedRedirect, configured, expectedRole, requireCompleted, router]);

  if (state.type === "ready") return children(state.context);
  if (state.type === "unauthenticated") {
    return (
      <GuardPanel
        title="로그인이 필요합니다"
        body="계정 확인 후 이 페이지로 다시 돌아올 수 있습니다."
        actionLabel="로그인"
        onAction={() => router.push("/login")}
      />
    );
  }
  if (state.type === "forbidden") {
    return <GuardPanel title="접근 권한이 없습니다" body={state.message} />;
  }
  if (state.type === "not-found") {
    return <GuardPanel title="프로필을 찾을 수 없습니다" body={state.message} />;
  }
  if (state.type === "error") {
    return (
      <GuardPanel
        title="다시 시도해주세요"
        body={state.message}
        actionLabel="새로고침"
        onAction={() => window.location.reload()}
      />
    );
  }
  return <GuardPanel title="계정 확인 중" body="Firebase session과 Product API account context를 확인하고 있습니다." />;
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
