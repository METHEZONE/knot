"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AgentCharacter } from "@/components/AgentCharacter";
import {
  ProductApiClient,
  type ApiPromotion,
  type BrandDashboard,
  type CreatorDashboard,
} from "@/product/apiClient";
import type { Role } from "@/product/types";

type LoadState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export function RoleDashboard({ role }: { role: Role }) {
  const [state, setState] = useState<LoadState<BrandDashboard | CreatorDashboard>>({
    status: "loading",
    data: null,
    error: null,
  });

  const loadDashboard = useCallback(() => {
    const client = new ProductApiClient();
    const request = role === "brand" ? client.getBrandDashboard() : client.getCreatorDashboard();
    setState((current) => current.status === "ready" ? current : { status: "loading", data: null, error: null });
    request
      .then((data) => setState({ status: "ready", data, error: null }))
      .catch((caught) => {
        setState({
          status: "error",
          data: null,
          error: caught instanceof Error ? caught.message : String(caught),
        });
      });
  }, [role]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (state.status === "loading") {
    return <DashboardShell role={role}><EmptyState text="Dashboard를 불러오는 중..." /></DashboardShell>;
  }

  if (state.status === "error") {
    return <DashboardShell role={role}><EmptyState text={state.error} /></DashboardShell>;
  }

  return role === "brand" ? (
    <BrandDashboardView dashboard={state.data as BrandDashboard} />
  ) : (
    <CreatorDashboardView dashboard={state.data as CreatorDashboard} onReload={loadDashboard} />
  );
}

function BrandDashboardView({ dashboard }: { dashboard: BrandDashboard }) {
  const results = brandResults(dashboard);
  const settlementHref = firstResultHref(results);

  return (
    <DashboardShell role="brand">
      <ActionGrid
        items={[
          {
            title: "정산하기",
            body: settlementHref ? "합의된 건의 Escrow, Evidence, Settlement를 확인합니다." : "정산 가능한 에이전트 결과가 아직 없습니다.",
            href: settlementHref ?? "/brand/agent",
            disabled: !settlementHref,
          },
          {
            title: "에이전트 켜기",
            body: "Glow Agent 대화방으로 이동해 후보 탐색과 협상 상태를 봅니다.",
            href: "/brand/agent",
            primary: true,
          },
          {
            title: "에이전트 결과",
            body: `${results.length}건의 협상 결과를 확인합니다.`,
            href: settlementHref ?? "/brand/promotions/new",
          },
        ]}
      />
      <ResultSection title="에이전트 결과" empty="아직 협상 결과가 없습니다. 에이전트를 켜서 Promotion을 시작하세요.">
        {results.map((item) => <ResultRow key={item.key} item={item} />)}
      </ResultSection>
    </DashboardShell>
  );
}

function CreatorDashboardView({ dashboard, onReload }: { dashboard: CreatorDashboard; onReload: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const results = creatorResults(dashboard);
  const settlementHref = firstResultHref(results);
  const accepting = dashboard.creator.acceptingOffers === true || dashboard.creator.receivingOffers === true;

  async function enableAgent() {
    setSaving(true);
    setError(null);
    try {
      if (!accepting) {
        await new ProductApiClient().updateCreatorAvailability(true);
        onReload();
      }
      window.location.assign("/creator/agent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  }

  return (
    <DashboardShell role="creator">
      <ActionGrid
        items={[
          {
            title: "정산하기",
            body: settlementHref ? "합의된 협찬의 정산 상태를 확인합니다." : "정산 가능한 에이전트 결과가 아직 없습니다.",
            href: settlementHref ?? "/creator/agent",
            disabled: !settlementHref,
          },
          {
            title: saving ? "에이전트 켜는 중" : "에이전트 켜기",
            body: accepting ? "Mina Agent 대화방으로 이동합니다." : "신규 제안 수신을 켜고 Mina Agent 대화방으로 이동합니다.",
            onClick: enableAgent,
            primary: true,
          },
          {
            title: "에이전트 결과",
            body: `${results.length}건의 협상 결과를 확인합니다.`,
            href: settlementHref ?? "/creator/agent",
          },
        ]}
      />
      {error ? <EmptyState text={error} /> : null}
      <ResultSection title="에이전트 결과" empty="아직 받은 제안이나 협상 결과가 없습니다. 에이전트를 켜면 Brand 제안 수신 대상이 됩니다.">
        {results.map((item) => <ResultRow key={item.key} item={item} />)}
      </ResultSection>
    </DashboardShell>
  );
}

function DashboardShell({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 py-8">
      <section className="flex flex-wrap items-center gap-4">
        <AgentCharacter agentId={`${role}-dashboard-agent`} side={role} category="beauty" pose="greet" size={88} />
        <div>
          <p className="font-mono text-xs uppercase text-muted">KNOT v2</p>
          <h1 className="mt-1 text-4xl">{role === "brand" ? "Brand Dashboard" : "Creator Dashboard"}</h1>
        </div>
      </section>
      {children}
    </div>
  );
}

type ActionItem = {
  title: string;
  body: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
};

function ActionGrid({ items }: { items: ActionItem[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-3">
      {items.map((item) => <ActionTile key={item.title} item={item} />)}
    </section>
  );
}

function ActionTile({ item }: { item: ActionItem }) {
  const className = `sketch ink flex min-h-40 flex-col justify-between border p-5 ${
    item.primary ? "border-accent bg-accent/10" : "border-border-subtle bg-surface"
  } ${item.disabled ? "opacity-60" : ""}`;
  const content = (
    <>
      <div>
        <h2 className="text-3xl">{item.title}</h2>
        <p className="mt-2 text-sm text-muted">{item.body}</p>
      </div>
      <span className="sketch-pill mt-4 inline-flex self-start bg-accent px-4 py-2 text-sm text-background">
        열기
      </span>
    </>
  );
  if (item.onClick) {
    return <button type="button" onClick={item.onClick} className={`${className} text-left`}>{content}</button>;
  }
  return <Link href={item.href ?? "#"} className={className}>{content}</Link>;
}

type ResultItem = {
  key: string;
  title: string;
  status: string;
  href: string;
};

function ResultSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = useMemo(() => flattenChildren(children), [children]);
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.length ? items : <EmptyState text={empty} />}
      </div>
    </section>
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  return (
    <Link href={item.href} className="sketch-alt ink border border-border-subtle bg-background p-4 hover:bg-surface-raised">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{item.title}</span>
        <span className="font-mono text-xs text-muted">{item.status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">상세보기</p>
    </Link>
  );
}

function brandResults(dashboard: BrandDashboard): ResultItem[] {
  const promotions = dashboard.activePromotions.map((promotion: ApiPromotion) => ({
    key: promotion.promotionId,
    title: promotion.title || promotion.objective || promotion.promotionId,
    status: promotion.status,
    href: `/brand/promotions/${promotion.promotionId}`,
  }));
  const activities = dashboard.recentAgentActivity
    .map((item, index) => {
      const negotiationId = nestedText(item, "negotiationId");
      if (!negotiationId) return null;
      return {
        key: `activity-${negotiationId}-${index}`,
        title: "협상 결과",
        status: text(item.type) || "A2A",
        href: `/negotiations/${negotiationId}`,
      };
    })
    .filter(Boolean) as ResultItem[];
  return dedupeResults([...activities, ...promotions]);
}

function creatorResults(dashboard: CreatorDashboard): ResultItem[] {
  const rows = [...dashboard.offers, ...dashboard.activeSponsorships].map((item, index) => {
    const negotiationId = nestedText(item, "negotiationId");
    const agreementId = nestedText(item, "agreementId");
    return {
      key: negotiationId || agreementId || `creator-result-${index}`,
      title: text(item.title) || text(item.productName) || text(item.promotionTitle) || "협상 결과",
      status: text(item.status) || "ACTIVE",
      href: negotiationId ? `/negotiations/${negotiationId}` : "/creator/agent",
    };
  });
  return dedupeResults(rows);
}

function firstResultHref(results: ResultItem[]) {
  return results[0]?.href ?? null;
}

function EmptyState({ text: value }: { text: string }) {
  return <div className="sketch-alt ink border border-border-subtle bg-background p-4 text-sm text-muted">{value}</div>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function nestedText(item: Record<string, unknown>, key: string) {
  const direct = text(item[key]);
  if (direct) return direct;
  const data = item.data;
  if (data && typeof data === "object") return text((data as Record<string, unknown>)[key]);
  return "";
}

function flattenChildren(children: React.ReactNode) {
  return Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
}

function dedupeResults(items: ResultItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}
