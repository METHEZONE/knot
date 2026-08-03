"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentCharacter } from "@/components/AgentCharacter";
import { Money } from "@/features/chat/Money";
import {
  type ApiAgreement,
  type ApiPromotion,
  type BrandDashboard,
  type CreatorAgentControl,
  type CreatorDashboard,
  ProductApiClient,
  ProductApiError,
  type CurrentUserContext,
} from "@/product/apiClient";

type Role = "brand" | "creator";

type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const emptyLoad = <T,>(): LoadState<T> => ({ data: null, loading: true, error: null });

export function AgentDashboard({
  role,
  context,
}: {
  role: Role;
  context: CurrentUserContext;
}) {
  return role === "brand" ? (
    <BrandAgentDashboard context={context} />
  ) : (
    <CreatorAgentDashboard context={context} />
  );
}

function BrandAgentDashboard({ context }: { context: CurrentUserContext }) {
  const router = useRouter();
  const client = useMemo(() => new ProductApiClient(), []);
  const [dashboard, setDashboard] = useState<LoadState<BrandDashboard>>(emptyLoad);
  const [agreements, setAgreements] = useState<Array<ApiAgreement & Record<string, unknown>>>([]);
  const [promotions, setPromotions] = useState<Array<ApiPromotion & Record<string, unknown>>>([]);
  const [runningPromotionId, setRunningPromotionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null);

  const load = useCallback(async (markLoading = false) => {
    if (markLoading) setDashboard(emptyLoad());
    try {
      const [nextDashboard, nextAgreements, nextPromotions] = await Promise.all([
        client.getBrandDashboard(),
        client.listBrandAgreements(),
        client.listBrandPromotions(),
      ]);
      setDashboard({ data: nextDashboard, loading: false, error: null });
      setAgreements(nextAgreements);
      setPromotions(nextPromotions);
    } catch (caught) {
      setDashboard({ data: null, loading: false, error: readableError(caught) });
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    async function load() {
      setDashboard(emptyLoad());
      try {
        const [nextDashboard, nextAgreements, nextPromotions] = await Promise.all([
          client.getBrandDashboard(),
          client.listBrandAgreements(),
          client.listBrandPromotions(),
        ]);
        if (!active) return;
        setDashboard({ data: nextDashboard, loading: false, error: null });
        setAgreements(nextAgreements);
        setPromotions(nextPromotions);
      } catch (caught) {
        if (!active) return;
        setDashboard({ data: null, loading: false, error: readableError(caught) });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [client]);

  async function runPromotion(promotionId: string) {
    setRunningPromotionId(promotionId);
    setActionError(null);
    setWaitingMessage(null);
    try {
      const flow = await client.runAgentForPromotion(promotionId);
      if (flow.negotiation) {
        router.push(`/brand/negotiations/${flow.negotiation.negotiationId}`);
        router.refresh();
        return;
      }
      setWaitingMessage("조건에 맞는 Creator가 아직 없습니다. 새 Creator가 들어오면 다시 탐색할 수 있습니다.");
      await load(false);
    } catch (caught) {
      setActionError(readableError(caught));
    } finally {
      setRunningPromotionId(null);
    }
  }

  const totalContracted = agreements.reduce(
    (sum, agreement) => sum + (agreement.terms?.compensation?.baseAmountUsdc ?? 0),
    0,
  );

  return (
    <DashboardShell
      role="brand"
      title="Brand dashboard"
      subtitle="제품을 검토하고, Agent가 Creator Agent와 협상한 결과만 확인합니다."
      agentId={context.account.agentId ?? "brand-agent-glow"}
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="sketch ink border border-border-subtle bg-surface p-5">
          <SectionHeader eyebrow="정산" title="전체 escrow 요약" />
          <SettlementOverview
            lockedBaseUnits={dashboard.data?.summary.lockedEscrowBaseUnits}
            agreementCount={dashboard.data?.summary.agreements ?? agreements.length}
            contractedUsdc={totalContracted}
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="진행 중" value={String(dashboard.data?.summary.negotiationsInProgress ?? "-")} />
            <Metric label="계약" value={String(dashboard.data?.summary.agreements ?? agreements.length)} />
            <Metric
              label="잠긴 escrow"
              value={baseUnitsToUsdcLabel(dashboard.data?.summary.lockedEscrowBaseUnits)}
            />
          </div>
          {dashboard.error ? <p className="mt-3 text-sm text-negative">{dashboard.error}</p> : null}
        </section>

        <section className="sketch-alt ink border border-border-subtle bg-surface-raised p-5">
          <SectionHeader eyebrow="에이전트 관리" title="협찬 제안하기" />
          {promotions.length ? (
            <BrandProjectReview
              promotion={promotions[0]}
              agreement={agreements.find((agreement) => agreement.promotionId === promotions[0].promotionId)}
              busy={runningPromotionId === promotions[0].promotionId}
              onRun={() => runPromotion(promotions[0].promotionId)}
            />
          ) : (
            <p className="text-sm text-muted">
              새 프로모션은 제품 URL을 읽고 무드를 추출한 뒤, 검토 화면에서 협상을 시작합니다.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link href="/brand/promotions/new" className="sketch-pill bg-accent px-5 py-3 text-background">
              프로모션 만들기
            </Link>
          </div>
          {(waitingMessage ?? actionError) ? (
            <p className={`mt-3 text-sm ${actionError ? "text-negative" : "text-muted"}`}>
              {actionError ?? waitingMessage}
            </p>
          ) : null}
        </section>
      </div>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeader eyebrow="Agent 기록" title="만든 프로모션과 협상 결과" />
        {promotions.length ? (
          <BrandRecordList
            promotions={promotions}
            agreements={agreements}
            runningPromotionId={runningPromotionId}
            onRunPromotion={runPromotion}
          />
        ) : (
          <EmptyState
            title="아직 만든 프로모션이 없습니다"
            body="프로모션 만들기를 완료하면 이곳에서 기록을 모아보고, 협상 상세로 들어갈 수 있습니다."
          />
        )}
      </section>
    </DashboardShell>
  );
}

function CreatorAgentDashboard({ context }: { context: CurrentUserContext }) {
  const client = useMemo(() => new ProductApiClient(), []);
  const [dashboard, setDashboard] = useState<LoadState<CreatorDashboard>>(emptyLoad);
  const [agent, setAgent] = useState<CreatorAgentControl | null>(null);
  const [agreements, setAgreements] = useState<Array<ApiAgreement & Record<string, unknown>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (markLoading = false) => {
    if (markLoading) setDashboard(emptyLoad());
    try {
      const [nextDashboard, nextAgent, nextAgreements] = await Promise.all([
        client.getCreatorDashboard(),
        client.getCreatorAgent(),
        client.listCreatorAgreements(),
      ]);
      setDashboard({ data: nextDashboard, loading: false, error: null });
      setAgent(nextAgent.agent);
      setAgreements(nextAgreements);
    } catch (caught) {
      setDashboard({ data: null, loading: false, error: readableError(caught) });
    }
  }, [client]);

  useEffect(() => {
    let active = true;
    Promise.all([
      client.getCreatorDashboard(),
      client.getCreatorAgent(),
      client.listCreatorAgreements(),
    ])
      .then(([nextDashboard, nextAgent, nextAgreements]) => {
        if (!active) return;
        setDashboard({ data: nextDashboard, loading: false, error: null });
        setAgent(nextAgent.agent);
        setAgreements(nextAgreements);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setDashboard({ data: null, loading: false, error: readableError(caught) });
      });
    return () => {
      active = false;
    };
  }, [client]);

  async function toggleAgent() {
    setBusy(true);
    setError(null);
    try {
      const next =
        agent?.publicationStatus === "PUBLISHED"
          ? await client.pauseCreatorAgent()
          : agent?.publicationStatus === "PAUSED"
            ? await client.resumeCreatorAgent()
            : await client.publishCreatorAgent();
      setAgent(next.agent);
      await load(true);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell
      role="creator"
      title="Creator dashboard"
      subtitle="받을 제안 조건을 관리하고, Agent가 처리한 협상과 정산만 확인합니다."
      agentId={context.account.agentId ?? "creator-agent-mina"}
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="sketch ink border border-border-subtle bg-surface p-5">
          <SectionHeader eyebrow="정산" title="받을 금액" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="새 제안" value={String(dashboard.data?.summary.newOffers ?? "-")} />
            <Metric label="진행 협상" value={String(dashboard.data?.summary.agentNegotiations ?? "-")} />
            <Metric label="대기 정산" value={baseUnitsToUsdcLabel(dashboard.data?.summary.pendingPayoutBaseUnits)} />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {agreements.slice(0, 3).map((agreement) => (
              <AgreementRow key={agreement.agreementId} agreement={agreement} />
            ))}
            {!agreements.length ? <p className="text-sm text-muted">아직 계약된 협찬이 없습니다.</p> : null}
          </div>
        </section>

        <section className="sketch-alt ink border border-border-subtle bg-surface-raised p-5">
          <SectionHeader eyebrow="에이전트 관리" title="협찬 받기 상태" />
          <div className="flex flex-wrap items-center gap-5">
            <AgentCharacter
              agentId={agent?.agentId ?? context.account.agentId ?? "creator-agent-mina"}
              side="creator"
              category="beauty"
              pose={agent?.acceptingOffers ? "greet" : "idle"}
              size={120}
            />
            <div className="min-w-0 flex-1">
              <p className="text-2xl">{agent?.acceptingOffers ? "제안 받는 중" : "제안 멈춤"}</p>
              <p className="mt-1 text-sm text-muted">
                {agent
                  ? `${agent.publicationStatus} · 동시 협상 ${agent.activeNegotiations}/${agent.maxConcurrentNegotiations}`
                  : "Agent 상태를 불러오고 있습니다."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleAgent}
            disabled={busy || !agent}
            className="sketch-pill mt-5 bg-accent px-5 py-3 text-background disabled:opacity-50"
          >
            {busy
              ? "변경 중…"
              : agent?.publicationStatus === "PUBLISHED"
                ? "협찬 받기 끄기"
                : "협찬 받기 켜기"}
          </button>
          {(error ?? dashboard.error) ? (
            <p className="mt-3 text-sm text-negative">{error ?? dashboard.error}</p>
          ) : null}
        </section>
      </div>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeader eyebrow="Agent 기록" title="받은 제안과 결과" />
        <div className="grid gap-3">
          {(dashboard.data?.offers ?? []).slice(0, 5).map((offer, index) => (
            <OfferRow key={String(offer.negotiationId ?? offer.offerId ?? index)} offer={offer} />
          ))}
          {!dashboard.loading && !(dashboard.data?.offers ?? []).length ? (
            <EmptyState
              title="표시할 협상 기록이 없습니다"
              body="Brand Agent가 제안을 보내면 공개 가능한 조건과 결과만 이곳에 남습니다."
            />
          ) : null}
        </div>
      </section>
    </DashboardShell>
  );
}

function DashboardShell({
  role,
  title,
  subtitle,
  agentId,
  children,
}: {
  role: Role;
  title: string;
  subtitle: string;
  agentId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid items-center gap-6 py-3 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">
            {role === "brand" ? "브랜드" : "크리에이터"} · role dashboard
          </p>
          <h1 className="mt-2 text-5xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>
        </div>
        <AgentCharacter
          agentId={agentId}
          side={role}
          category="beauty"
          pose={role === "brand" ? "knock" : "greet"}
          size={150}
        />
      </section>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{eyebrow}</p>
      <h2 className="mt-1 text-3xl">{title}</h2>
    </div>
  );
}

function BrandProjectReview({
  promotion,
  agreement,
  busy,
  onRun,
}: {
  promotion: ApiPromotion;
  agreement?: ApiAgreement | null;
  busy: boolean;
  onRun: () => void;
}) {
  const prohibitedClaims = promotion.constraints?.prohibitedClaims ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
      <div>
        <p className="text-3xl">{promotion.title}</p>
        <p className="mt-2 text-sm text-muted">{promotion.objective}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[promotion.category, ...promotion.targetAudience, ...prohibitedClaims]
            .filter(Boolean)
            .slice(0, 6)
            .map((item) => (
              <span
                key={item}
                className="sketch-pill ink border border-border-subtle bg-surface px-3 py-1 text-sm"
              >
                {item}
              </span>
            ))}
        </div>
      </div>
      <div className="sketch ink min-w-44 border border-border-subtle bg-surface p-4">
        <p className="text-xs text-muted">딜당 한도</p>
        <Money usdc={promotion.budget.maxPerCreatorUsdc} size="lg" />
        <p className="mt-2 text-xs text-muted">
          총 {promotion.budget.totalUsdc.toLocaleString()} USDC 안에서 협상
        </p>
        {agreement ? (
          <Link
            href={`/brand/agreements/${agreement.agreementId}`}
            className="sketch-pill mt-4 inline-flex border border-border-subtle bg-background px-4 py-2 text-sm"
          >
            계약 상세보기
          </Link>
        ) : (
          <button
            type="button"
            onClick={onRun}
            disabled={busy}
            className="sketch-pill mt-4 bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
          >
            {busy ? "Creator 탐색 중…" : "Creator 탐색·협상 시작"}
          </button>
        )}
      </div>
    </div>
  );
}

function SettlementOverview({
  lockedBaseUnits,
  agreementCount,
  contractedUsdc,
}: {
  lockedBaseUnits: string | undefined;
  agreementCount: number;
  contractedUsdc: number;
}) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-4">
      <p className="text-sm text-muted">전체 계약 금액</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <Money usdc={contractedUsdc} size="lg" />
        <span className="sketch-pill ink border border-border-subtle px-3 py-1 font-mono text-xs">
          {agreementCount} agreements
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        실제 잠긴 escrow: <span className="font-mono text-foreground">{baseUnitsToUsdcLabel(lockedBaseUnits)}</span>
      </p>
      <p className="mt-1 text-xs text-muted">
        escrow가 아직 잠기지 않은 계약 금액은 계약 금액으로만 표시하고, 잠긴 금액으로 합산하지 않습니다.
      </p>
    </div>
  );
}

function BrandRecordList({
  promotions,
  agreements,
  runningPromotionId,
  onRunPromotion,
}: {
  promotions: Array<ApiPromotion & Record<string, unknown>>;
  agreements: Array<ApiAgreement & Record<string, unknown>>;
  runningPromotionId: string | null;
  onRunPromotion: (promotionId: string) => void;
}) {
  const agreementByPromotion = new Map(agreements.map((agreement) => [agreement.promotionId, agreement]));
  return (
    <div className="grid gap-3">
      {promotions.map((promotion) => {
        const agreement = agreementByPromotion.get(promotion.promotionId);
        const negotiationId = agreement?.negotiationId;
        const href =
          typeof negotiationId === "string" && negotiationId
            ? `/brand/negotiations/${negotiationId}`
            : `/brand/promotions/${promotion.promotionId}`;
        return (
          <div
            key={promotion.promotionId}
            className="sketch-alt ink flex flex-wrap items-center justify-between gap-3 border border-border-subtle bg-surface-raised p-4"
          >
            <Link href={href} className="min-w-0 flex-1">
              <span className="min-w-0">
                <span className="block truncate text-xl">{promotion.title}</span>
                <span className="font-mono text-xs text-muted">
                  {promotion.status} · {formatTime(String(promotion.updatedAt ?? promotion.createdAt ?? ""))}
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {agreement?.creatorDisplayName ? `${agreement.creatorDisplayName} · ` : ""}
                  {deliverableSummary(agreement?.terms.deliverables ?? promotion.deliverables)}
                </span>
              </span>
            </Link>
            <span className="flex items-center gap-3">
              {agreement ? <Money usdc={agreement.terms.compensation.baseAmountUsdc} /> : null}
              {agreement ? (
                <Link
                  href={href}
                  className="sketch-pill ink border border-border-subtle bg-surface px-3 py-1 text-sm"
                >
                  상세보기
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onRunPromotion(promotion.promotionId)}
                  disabled={runningPromotionId === promotion.promotionId}
                  className="sketch-pill bg-accent px-3 py-1 text-sm text-background disabled:opacity-50"
                >
                  {runningPromotionId === promotion.promotionId ? "탐색 중…" : "다시 탐색"}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl">{value}</p>
    </div>
  );
}

function AgreementRow({ agreement }: { agreement: ApiAgreement & Record<string, unknown> }) {
  const negotiationId = typeof agreement.negotiationId === "string" ? agreement.negotiationId : null;
  return (
    <Link
      href={negotiationId ? `/creator/offers/${negotiationId}` : `/creator/agreements/${agreement.agreementId}`}
      className="sketch-alt ink flex flex-wrap items-center justify-between gap-3 border border-border-subtle bg-background p-3"
    >
      <span className="min-w-0 truncate font-mono text-xs">{agreement.agreementId}</span>
      <span className="flex items-center gap-2">
        <Money usdc={agreement.terms.compensation.baseAmountUsdc} />
        <span className="text-sm text-muted">{agreement.status}</span>
      </span>
      <span className="w-full text-sm text-muted">{deliverableSummary(agreement.terms.deliverables)}</span>
    </Link>
  );
}

function OfferRow({ offer }: { offer: Record<string, unknown> }) {
  const negotiationId = String(offer.negotiationId ?? offer.id ?? "");
  const status = String(offer.status ?? offer.negotiationStatus ?? "OFFER");
  const label = String(offer.productTitle ?? offer.title ?? offer.promotionTitle ?? "협찬 제안");
  const amount = numberFromUnknown(offer.amountUsdc ?? offer.currentAmountUsdc ?? offer.baseAmountUsdc);
  const work = typeof offer.deliverableSummary === "string" ? offer.deliverableSummary : null;
  return (
    <Link
      href={negotiationId ? `/creator/offers/${negotiationId}` : "/creator"}
      className="sketch-alt ink flex flex-wrap items-center justify-between gap-3 border border-border-subtle bg-surface-raised p-4"
    >
      <span>
        <span className="block text-xl">{label}</span>
        <span className="font-mono text-xs text-muted">{status}</span>
        {work ? <span className="mt-1 block text-sm text-muted">{work}</span> : null}
      </span>
      {amount === null ? <span className="text-sm text-muted">금액 확인 중</span> : <Money usdc={amount} />}
    </Link>
  );
}

function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="sketch-alt ink border border-dashed border-border-subtle bg-background p-5">
      <p className="text-xl">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="sketch-pill mt-4 inline-flex bg-accent px-4 py-2 text-background">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function readableError(caught: unknown) {
  if (caught instanceof ProductApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return String(caught);
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function baseUnitsToUsdcLabel(value: string | undefined) {
  if (!value) return "-";
  const raw = Number(value);
  if (!Number.isFinite(raw)) return value;
  return `${(raw / 1_000_000).toLocaleString()} USDC`;
}

function deliverableSummary(deliverables: Array<{ format: string; count: number }> | undefined) {
  if (!deliverables?.length) return "작업 조건 미정";
  return deliverables
    .filter((deliverable) => deliverable.count > 0)
    .map((deliverable) => `${formatDeliverable(deliverable.format)} ${deliverable.count}개`)
    .join(", ");
}

function formatDeliverable(format: string) {
  const labels: Record<string, string> = {
    reel: "릴스",
    short: "숏츠",
    post: "게시글",
    story: "스토리",
  };
  return labels[format] ?? format;
}
