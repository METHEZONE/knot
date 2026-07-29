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
      .then((data) => {
        setState({ status: "ready", data, error: null });
      })
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
    return <DashboardShell role={role} title="Dashboard"><EmptyState text="Dashboard를 불러오는 중..." /></DashboardShell>;
  }

  if (state.status === "error") {
    return <DashboardShell role={role} title="Dashboard"><EmptyState text={state.error} /></DashboardShell>;
  }

  return role === "brand" ? (
    <BrandDashboardView dashboard={state.data as BrandDashboard} />
  ) : (
    <CreatorDashboardView dashboard={state.data as CreatorDashboard} onReload={loadDashboard} />
  );
}

function BrandDashboardView({ dashboard }: { dashboard: BrandDashboard }) {
  const brandName = text(dashboard.brand.displayName) || text(dashboard.brand.name) || "Brand";
  return (
    <DashboardShell role="brand" title="Brand Dashboard">
      <ManagerCard role="brand" title="Glow Agent" body={`${brandName}의 제안 준비와 협상 상태를 관리합니다.`} status="ACTIVE" />
      <SummaryGrid
        items={[
          ["진행 중 Promotion", String(dashboard.summary.activePromotions)],
          ["협상 중", String(dashboard.summary.negotiationsInProgress)],
          ["Agreement", String(dashboard.summary.agreements)],
          ["Escrow 잠김", formatUsdcBaseUnits(dashboard.summary.lockedEscrowBaseUnits)],
        ]}
      />
      <ActionPanel
        title="해야 할 일"
        body="Promotion을 만들고 Creator 후보를 탐색합니다. 협상 시작은 후보 확인 후 명시적으로 진행합니다."
        action={<Link href="/brand/promotions/new" className="sketch-pill inline-flex bg-accent px-4 py-2 text-sm text-background">협찬 제안하기</Link>}
      />
      <ListSection title="진행 중 목록" empty="진행 중인 Promotion이 없습니다.">
        {dashboard.activePromotions.map((promotion) => (
          <PromotionRow key={promotion.promotionId} promotion={promotion} />
        ))}
      </ListSection>
      <ActivitySection activity={dashboard.recentAgentActivity} />
    </DashboardShell>
  );
}

function CreatorDashboardView({ dashboard, onReload }: { dashboard: CreatorDashboard; onReload: () => void }) {
  const creatorName = text(dashboard.creator.displayName) || "Creator";
  const accepting = dashboard.creator.acceptingOffers === true || dashboard.creator.receivingOffers === true;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleAvailability() {
    setSaving(true);
    setError(null);
    try {
      await new ProductApiClient().updateCreatorAvailability(!accepting);
      onReload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell role="creator" title="Creator Dashboard">
      <ManagerCard role="creator" title="Mina Agent" body={`${creatorName}의 신규 제안과 정산 상태를 관리합니다.`} status={accepting ? "RECEIVING" : "OFFLINE"} />
      <SummaryGrid
        items={[
          ["새 제안", String(dashboard.summary.newOffers)],
          ["Agent 협상", String(dashboard.summary.agentNegotiations)],
          ["진행 중 협찬", String(dashboard.summary.activeSponsorships)],
          ["지급 대기", formatUsdcBaseUnits(dashboard.summary.pendingPayoutBaseUnits)],
        ]}
      />
      <ActionPanel
        title="해야 할 일"
        body={accepting ? "신규 제안 수신이 켜져 있습니다." : "협찬 받기를 켜면 Brand의 신규 제안 대상이 됩니다."}
        action={
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={toggleAvailability}
              disabled={saving}
              className="sketch-pill bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
            >
              {saving ? "저장 중..." : accepting ? "협찬 받기 끄기" : "협찬 받기"}
            </button>
            {error ? <span className="text-sm text-muted">{error}</span> : null}
          </div>
        }
      />
      <ListSection title="진행 중 목록" empty="현재 받은 제안이 없습니다.">
        {dashboard.offers.map((offer) => (
          <GenericRow key={text(offer.negotiationId) || JSON.stringify(offer)} item={offer} />
        ))}
      </ListSection>
      <ActivitySection activity={dashboard.recentAgentActivity} />
    </DashboardShell>
  );
}

function DashboardShell({ role, title, children }: { role: Role; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 py-8">
      <div>
        <p className="font-mono text-xs uppercase text-muted">KNOT v2</p>
        <h1 className="mt-1 text-4xl">{title}</h1>
      </div>
      {children}
      <div className="flex justify-end">
        <Link href="/mypage" className="text-sm font-semibold text-muted hover:text-foreground">
          마이페이지
        </Link>
      </div>
    </div>
  );
}

function ManagerCard({ role, title, body, status }: { role: Role; title: string; body: string; status: string }) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-center gap-5">
        <AgentCharacter agentId={`${role}-dashboard-agent`} side={role} category="beauty" pose="greet" size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-3xl">{title}</h2>
            <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 font-mono text-xs text-muted">
              {status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{body}</p>
        </div>
      </div>
    </section>
  );
}

function SummaryGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="sketch-alt ink border border-border-subtle bg-background p-4">
          <div className="text-xs text-muted">{label}</div>
          <div className="mt-1 break-words font-mono text-xl">{value}</div>
        </div>
      ))}
    </section>
  );
}

function ActionPanel({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <div className="mt-4">{action}</div>
    </section>
  );
}

function ListSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = useMemo(() => flattenChildren(children), [children]);
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-4 grid gap-3">{items.length ? items : <EmptyState text={empty} />}</div>
    </section>
  );
}

function PromotionRow({ promotion }: { promotion: ApiPromotion }) {
  return (
    <Link
      href={`/brand/promotions/${promotion.promotionId}`}
      className="sketch-alt ink border border-border-subtle bg-background p-4 hover:bg-surface-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{promotion.title}</span>
        <span className="font-mono text-xs text-muted">{promotion.status}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{promotion.objective}</p>
    </Link>
  );
}

function GenericRow({ item }: { item: Record<string, unknown> }) {
  const id = text(item.negotiationId) || text(item.id) || "item";
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm">{id}</span>
        <span className="font-mono text-xs text-muted">{text(item.status) || "ACTIVE"}</span>
      </div>
    </div>
  );
}

function ActivitySection({ activity }: { activity: Array<Record<string, unknown>> }) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">최근 활동</h2>
      <div className="mt-4 grid gap-3">
        {activity.length ? activity.slice(0, 5).map((item, index) => (
          <GenericRow key={`${text(item.eventId) || text(item.id) || "activity"}-${index}`} item={item} />
        )) : <EmptyState text="최근 활동이 없습니다." />}
      </div>
    </section>
  );
}

function EmptyState({ text: value }: { text: string }) {
  return <div className="sketch-alt ink border border-border-subtle bg-background p-4 text-sm text-muted">{value}</div>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function flattenChildren(children: React.ReactNode) {
  return Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
}

function formatUsdcBaseUnits(value: string) {
  try {
    const baseUnits = BigInt(value || "0");
    const scale = BigInt(1000000);
    const whole = baseUnits / scale;
    const fraction = baseUnits % scale;
    if (fraction === BigInt(0)) return `${whole.toString()} USDC`;
    return `${whole.toString()}.${fraction.toString().padStart(6, "0").replace(/0+$/, "")} USDC`;
  } catch {
    return "0 USDC";
  }
}
