"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthProvider";
import { AgentCharacter } from "@/components/AgentCharacter";
import { agentTraits } from "@/lib/agentIdentity";
import { ProductApiClient } from "@/product/apiClient";
import {
  KRW_PER_USDC,
  setCurrencyMode,
  useCurrencyMode,
} from "@/product/currency";
import type { Role } from "@/product/types";

const AGENT_NAME: Record<Role, string> = { brand: "Glow Agent", creator: "Mina Agent" };

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsScreen({ role: routeRole }: { role?: Role }) {
  const router = useRouter();
  const { status, context, error: authError, logout, refresh } = useAuth();
  const mode = useCurrencyMode();
  const role = toUiRole(context?.account.role) ?? routeRole ?? null;
  const account = context?.account ?? null;
  const profile = context?.profileSummary ?? null;
  const traits = agentTraits(account?.agentId ?? `${role ?? "brand"}-agent`, role ?? "brand", "beauty");
  const [wallet, setWallet] = useState(account?.walletAddress ?? "");
  const [saved, setSaved] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => [
      ["계정", account?.email ?? account?.displayName ?? "확인 필요"],
      ["Role", account?.role ?? "ROLE_REQUIRED"],
      ["Onboarding", account?.onboardingStatus ?? "확인 필요"],
      ["Profile ID", String(profile?.id ?? account?.brandId ?? account?.creatorId ?? "-")],
    ],
    [account, profile],
  );

  async function saveWallet() {
    setSavingWallet(true);
    setError(null);
    try {
      await new ProductApiClient().saveWalletAddress(wallet);
      await refresh();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSavingWallet(false);
    }
  }

  if (status === "loading") {
    return <div className="py-24 text-center text-muted">계정 확인 중...</div>;
  }

  if (status === "unauthenticated" || !context) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8">
        <h1 className="text-4xl">마이페이지</h1>
        <Section title="로그인이 필요합니다" hint={authError ?? "계정 확인 후 마이페이지를 볼 수 있습니다."}>
          <button
            type="button"
            onClick={() => router.push("/login?redirect=%2Fmypage")}
            className="sketch-pill bg-accent px-4 py-2 text-sm text-background"
          >
            로그인
          </button>
        </Section>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8">
        <h1 className="text-4xl">마이페이지</h1>
        <Section title="역할 선택이 필요합니다" hint="Brand 또는 Creator role을 먼저 연결하세요.">
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="sketch-pill bg-accent px-4 py-2 text-sm text-background"
          >
            역할 선택
          </button>
        </Section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8">
      <h1 className="text-4xl">마이페이지</h1>

      <Section title="내 매니저" hint="Agent는 Product API가 생성한 실제 role/profile 상태를 기준으로 표시됩니다.">
        <div className="flex flex-wrap items-center gap-5">
          <AgentCharacter
            agentId={account?.agentId ?? `${role}-agent`}
            side={role}
            category="beauty"
            pose="greet"
            size={96}
          />
          <div className="flex flex-col gap-1">
            <div className="text-2xl">{AGENT_NAME[role]}</div>
            <div className="text-sm text-muted">
              {role === "brand" ? "브랜드 매니저" : "크리에이터 매니저"}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span
                className="sketch-pill border-2 px-2.5 py-0.5 text-xs"
                style={{ borderColor: traits.tint }}
              >
                {profileText(profile, "displayName") || "프로필 준비 중"}
              </span>
              <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs">
                {account?.agentId ?? "agent pending"}
              </span>
            </div>
          </div>
        </div>
      </Section>

      <Section title="내 프로필" hint="상대방에게 노출되는 정보와 내부 정책 정보는 API DTO에서 분리해 표시합니다.">
        <div className="grid grid-cols-2 gap-4">
          {rows.map(([label, value]) => (
            <Stat key={label} label={label} value={value} />
          ))}
        </div>
      </Section>

      <Section
        title="지갑과 정산"
        hint="사용자 지갑은 Phantom 등 비수탁 지갑 주소만 저장합니다. Agent 지갑 공개키는 읽기 전용입니다."
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">사용자 지갑 주소</span>
          <input
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="Solana devnet wallet address"
            className="sketch-alt ink border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-sm outline-none"
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Stat label="Agent wallet" value={account?.agentWalletPubkey ?? "not provisioned"} />
          <Stat label="Network" value="Solana devnet" />
        </div>
        <button
          type="button"
          onClick={saveWallet}
          disabled={savingWallet || !wallet.trim()}
          className="sketch-pill mt-4 bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {savingWallet ? "저장 중..." : "지갑 저장"}
        </button>
        {saved ? <p className="mt-3 text-sm" style={{ color: "var(--positive)" }}>저장했어요.</p> : null}
        {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
      </Section>

      <Section
        title="금액 표시"
        hint={`계약과 정산의 단위는 언제나 USDC입니다. 원화는 표시 환율 1 USDC = ${KRW_PER_USDC.toLocaleString("ko-KR")}원 기준 참고값입니다.`}
      >
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "krwFirst", label: "원화 먼저", sample: "897,000원 650 USDC" },
              { key: "usdcFirst", label: "USDC 먼저", sample: "650 USDC 897,000원" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                setCurrencyMode(opt.key);
                setSaved(true);
                window.setTimeout(() => setSaved(false), 1600);
              }}
              className={`sketch-pill border-2 border-border-subtle px-4 py-2 text-left ${
                mode === opt.key ? "bg-accent text-background" : "bg-surface"
              }`}
            >
              <div className="text-sm font-semibold">{opt.label}</div>
              <div className="font-mono text-[11px] opacity-70">{opt.sample}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="계정">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(`/${role}`)}
            className="sketch-pill bg-accent px-4 py-2 text-sm text-background"
          >
            대시보드로 돌아가기
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
          >
            로그아웃
          </button>
        </div>
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="break-words font-mono text-sm">{value}</div>
    </div>
  );
}

function toUiRole(role: "BRAND" | "CREATOR" | null | undefined): Role | null {
  if (role === "BRAND") return "brand";
  if (role === "CREATOR") return "creator";
  return null;
}

function profileText(profile: Record<string, unknown> | null, key: string) {
  const value = profile?.[key];
  return typeof value === "string" ? value : "";
}
