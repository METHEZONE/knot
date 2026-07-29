"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/auth/AuthProvider";
import { postLoginPath, safeRedirectPath } from "@/auth/authState";
import {
  authConfigurationError,
  firebaseAuthErrorMessage,
  firebaseConfigured,
  signInWithEmail,
  signInWithGoogle,
} from "@/auth/firebaseClient";
import { AgentCharacter } from "@/components/AgentCharacter";
import { ProductApiClient } from "@/product/apiClient";
import type { Role } from "./types";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const configured = firebaseConfigured();
  const redirect = safeRedirectPath(searchParams.get("redirect"));

  async function submit(formData: FormData) {
    setStatus("saving");
    setError(null);
    try {
      if (!configured) throw new Error(authConfigurationError());
      await signInWithEmail(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
      const account = await new ProductApiClient().getMe();
      router.push(postLoginPath(account.account, account.dashboardTarget, redirect));
    } catch (caught) {
      setError(firebaseAuthErrorMessage(caught));
      setStatus("idle");
    }
  }

  async function google() {
    setStatus("saving");
    setError(null);
    try {
      if (!configured) throw new Error(authConfigurationError());
      await signInWithGoogle();
      const account = await new ProductApiClient().getMe();
      router.push(postLoginPath(account.account, account.dashboardTarget, redirect));
    } catch (caught) {
      setError(firebaseAuthErrorMessage(caught));
      setStatus("idle");
    }
  }

  return (
    <AuthFrame
      eyebrow="Sign in"
      title="계정으로 로그인"
      body="창을 두 개 열어 한쪽은 브랜드, 다른 쪽은 크리에이터로 로그인하면 두 Agent의 협상을 나란히 볼 수 있어요."
    >
      <Panel>
        <form action={submit} className="grid gap-4">
          <Input label="Email" name="email" placeholder="you@company.com" type="email" required />
          <Input label="Password" name="password" placeholder="Password" type="password" minLength={6} required />
          <button
            type="submit"
            disabled={status === "saving" || !configured}
            className="sketch-pill bg-accent px-5 py-3 text-sm font-semibold text-background disabled:opacity-50"
          >
            {status === "saving" ? "확인 중..." : "이메일 로그인"}
          </button>
          <button
            type="button"
            onClick={google}
            disabled={status === "saving" || !configured}
            className="sketch-pill ink border border-border-subtle bg-surface-raised px-5 py-3 text-sm font-semibold text-muted disabled:opacity-50"
          >
            Continue with Google
          </button>
          {!configured && <FormError message={authConfigurationError()} />}
          {error && <FormError message={error} />}
        </form>
        <p className="mt-5 text-sm text-muted">
          로그인 후 Product API가 검증한 role과 onboarding 상태에 맞춰 이동합니다. 계정을 새로 만들려면{" "}
          <Link className="font-semibold text-foreground" href="/signup">회원가입</Link>.
        </p>
      </Panel>
    </AuthFrame>
  );
}

export function SignupScreen() {
  const router = useRouter();
  const { status: authStatus, context, error: authError, refresh } = useAuth();
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function chooseRole(role: Role) {
    setStatus("saving");
    setError(null);
    try {
      await new ProductApiClient().selectMyRole(
        role === "brand" ? "BRAND" : "CREATOR",
        idempotencyKey(`select-role-${role}`),
      );
      await refresh();
      router.push(role === "brand" ? "/brand/onboarding" : "/creator/onboarding");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus("idle");
    }
  }

  if (authStatus === "loading") {
    return (
      <AuthFrame eyebrow="Create account" title="계정 확인 중" body="Firebase session과 Product API account context를 확인하고 있습니다.">
        <Panel><p className="text-sm text-muted">잠시만 기다려주세요.</p></Panel>
      </AuthFrame>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <AuthFrame eyebrow="Create account" title="먼저 로그인하세요" body="역할 선택은 Firebase Auth 계정에 연결됩니다.">
        <Panel>
          <p className="text-sm text-muted">{authError ?? "이메일 또는 Google 계정으로 로그인할 수 있습니다."}</p>
          <Link href="/login?redirect=%2Fsignup" className="sketch-pill mt-5 inline-flex bg-accent px-5 py-3 text-sm font-semibold text-background">
            로그인
          </Link>
        </Panel>
      </AuthFrame>
    );
  }

  const account = context?.account;
  if (account?.role) {
    const href =
      account.role === "BRAND"
        ? account.onboardingStatus === "COMPLETED" ? "/brand" : "/brand/onboarding"
        : account.onboardingStatus === "COMPLETED" ? "/creator" : "/creator/onboarding";
    return (
      <AuthFrame eyebrow="Create account" title="역할이 이미 연결됐습니다" body="현재 계정 상태에 맞는 화면으로 이동합니다.">
        <Panel>
          <Pill>{account.role}</Pill>
          <p className="mt-3 text-sm text-muted">상태: {account.onboardingStatus}</p>
          <Link href={href} className="sketch-pill mt-5 inline-flex bg-accent px-5 py-3 text-sm font-semibold text-background">
            계속하기
          </Link>
        </Panel>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      eyebrow="Create account"
      title="역할을 선택하세요"
      body="회원가입은 역할 선택 후 온보딩으로 이어지고, 온보딩 결과로 Brand 또는 Creator 프로필이 생성됩니다."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <RoleChoiceCard
          role="brand"
          title="브랜드로 시작"
          body="브랜드 정보와 제품 제안서를 만들고, Brand Agent가 크리에이터를 찾아 협상합니다."
          busy={status === "saving"}
          onSelect={() => chooseRole("brand")}
        />
        <RoleChoiceCard
          role="creator"
          title="크리에이터로 시작"
          body="SNS URL과 협상 기준을 정하면, Creator Agent가 제안을 선별합니다."
          busy={status === "saving"}
          onSelect={() => chooseRole("creator")}
        />
      </div>
      {error && <FormError message={error} />}
    </AuthFrame>
  );
}

function RoleChoiceCard({
  role,
  title,
  body,
  busy,
  onSelect,
}: {
  role: Role;
  title: string;
  body: string;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-4">
        <AgentCharacter agentId={`${role}-signup-agent`} side={role} category="wellness" pose="greet" size={86} />
        <div>
          <Pill>{role}</Pill>
          <h2 className="mt-2 text-4xl font-semibold">{title}</h2>
        </div>
      </div>
      <p className="mt-4 text-muted">{body}</p>
      <button
        type="button"
        onClick={onSelect}
        disabled={busy}
        className="sketch-pill mt-6 bg-accent px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        {busy ? "연결 중..." : "선택"}
      </button>
    </Panel>
  );
}

function AuthFrame({ eyebrow, title, body, children }: { eyebrow: string; title: string; body: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7 py-10">
      <div>
        <Pill>{eyebrow}</Pill>
        <h1 className="mt-3 text-5xl font-semibold leading-none">{title}</h1>
        <p className="mt-3 max-w-2xl text-muted">{body}</p>
      </div>
      {children}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="sketch ink border border-border-subtle bg-surface p-5">{children}</section>;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="sketch-pill ink inline-flex border border-border-subtle bg-surface-raised px-3 py-1 font-mono text-xs uppercase text-muted">{children}</span>;
}

function Input({
  label,
  placeholder,
  type = "text",
  name,
  required,
  minLength,
}: {
  label: string;
  placeholder: string;
  type?: string;
  name?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        minLength={minLength}
        className="mt-2 w-full sketch-alt ink border border-border-subtle bg-background p-3 text-sm outline-none focus:border-accent"
        placeholder={placeholder}
      />
    </label>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="sketch-alt ink border border-caution/50 bg-caution/10 px-4 py-3 text-sm text-muted">
      {message}
    </div>
  );
}

function idempotencyKey(action: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `frontend-${action}-${crypto.randomUUID()}`;
  }
  return `frontend-${action}-${Date.now()}`;
}
