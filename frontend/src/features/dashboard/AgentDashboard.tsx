"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { Money } from "@/features/chat/Money";
import {
  type ApiAgreement,
  type ApiCandidate,
  type ApiNegotiation,
  type ApiNegotiationMessage,
  type ApiPromotion,
  type BrandDashboard,
  type CreatorAgentControl,
  type CreatorDashboard,
  ProductApiClient,
  ProductApiError,
  type CurrentUserContext,
} from "@/product/apiClient";
import { useBoard } from "@/product/dealBoard";
import type { BrandSetup } from "@/product/setupStore";

type Role = "brand" | "creator";

type BrandRun = {
  promotion: ApiPromotion;
  candidates: ApiCandidate[];
  negotiation: ApiNegotiation;
  agreement: ApiAgreement | null;
  messages: ApiNegotiationMessage[];
};

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
  const { board } = useBoard();
  const client = useMemo(() => new ProductApiClient(), []);
  const [dashboard, setDashboard] = useState<LoadState<BrandDashboard>>(emptyLoad);
  const [agreements, setAgreements] = useState<Array<ApiAgreement & Record<string, unknown>>>([]);
  const [run, setRun] = useState<BrandRun | null>(null);
  const [status, setStatus] = useState<"idle" | "creating" | "negotiating">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setDashboard(emptyLoad());
      try {
        const [nextDashboard, nextAgreements] = await Promise.all([
          client.getBrandDashboard(),
          client.listBrandAgreements(),
        ]);
        if (!active) return;
        setDashboard({ data: nextDashboard, loading: false, error: null });
        setAgreements(nextAgreements);
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

  async function startAgentRun() {
    if (!board.brand) {
      setError("먼저 제품 입력을 완료해주세요.");
      return;
    }
    setStatus("creating");
    setError(null);
    setRun(null);
    try {
      const promotion = await client.createBrandPromotion(
        promotionInputFromSetup(board.brand),
        `brand-dashboard-promotion-${Date.now()}`,
      );
      setStatus("negotiating");
      const flow = await client.runAgentForPromotion(promotion.promotionId);
      const messages = flow.negotiation
        ? await client.listNegotiationMessages(flow.negotiation.negotiationId)
        : [];
      setRun({
        promotion: flow.promotion,
        candidates: flow.candidates,
        negotiation: flow.negotiation,
        agreement: flow.agreement,
        messages,
      });
      const [nextDashboard, nextAgreements] = await Promise.all([
        client.getBrandDashboard(),
        client.listBrandAgreements(),
      ]);
      setDashboard({ data: nextDashboard, loading: false, error: null });
      setAgreements(nextAgreements);
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setStatus("idle");
    }
  }

  const latestAgreement = run?.agreement ?? agreements[0] ?? null;
  const product = board.brand;

  return (
    <DashboardShell
      role="brand"
      title="Brand dashboard"
      subtitle="제품을 검토하고, Agent가 Creator Agent와 협상한 결과만 확인합니다."
      agentId={context.account.agentId ?? "brand-agent-glow"}
    >
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="sketch ink border border-border-subtle bg-surface p-5">
          <SectionHeader eyebrow="정산" title="잠긴 금액과 계약 상태" />
          <SettlementSummary agreement={latestAgreement} />
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
          <SectionHeader eyebrow="에이전트 관리" title="협찬 프로젝트 검토" />
          {product ? (
            <BrandProjectReview product={product} />
          ) : (
            <EmptyState
              title="협찬 프로젝트 입력이 필요합니다"
              body="레퍼런스 온보딩과 같은 제품 링크, 무드, 예산 단계로 프로젝트를 만듭니다."
              actionHref="/brand/product"
              actionLabel="프로젝트 입력"
            />
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startAgentRun}
              disabled={!product || status !== "idle"}
              className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
            >
              {status === "creating"
                ? "프로모션 생성 중…"
                : status === "negotiating"
                  ? "협상 중…"
                  : "검토 끝, 협상 시작"}
            </button>
            <Link
              href="/brand/product"
              className="sketch-pill ink border border-border-subtle bg-surface px-5 py-3 text-sm"
            >
              다시 입력
            </Link>
          </div>
          {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}
        </section>
      </div>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeader eyebrow="에이전트 협상 기록" title="실제 A2A 메시지" />
        {status === "negotiating" ? (
          <div className="flex items-center gap-3 py-8 text-muted">
            <TypingDots />
            Brand Agent가 Creator Agent에게 제안하고 있습니다.
          </div>
        ) : run ? (
          <NegotiationLog role="brand" run={run} />
        ) : (
          <EmptyState
            title="아직 실행한 협상이 없습니다"
            body="에이전트 관리에서 프로젝트를 검토한 뒤 협상을 시작하면 전체 메시지가 이곳에 남습니다."
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
        <SectionHeader eyebrow="에이전트 협상 기록" title="받은 제안과 결과" />
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

function BrandProjectReview({ product }: { product: BrandSetup }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto]">
      <div>
        <p className="text-3xl">{product.productName}</p>
        <p className="mt-2 text-sm text-muted">{product.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[product.category, ...product.moodTags].filter(Boolean).map((item) => (
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
        <Money usdc={product.maxPerDealUsdc} size="lg" />
        <p className="mt-2 text-xs text-muted">총 {product.totalUsdc.toLocaleString()} USDC 안에서 협상</p>
      </div>
    </div>
  );
}

function SettlementSummary({ agreement }: { agreement: ApiAgreement | null }) {
  if (!agreement) {
    return (
      <div className="sketch-alt ink border border-border-subtle bg-background p-4">
        <p className="text-sm text-muted">계약이 생성되면 에스크로 잠금과 정산 상태가 여기로 이어집니다.</p>
      </div>
    );
  }
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-4">
      <p className="text-sm text-muted">최근 계약</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-3">
        <Money usdc={agreement.terms.compensation.baseAmountUsdc} size="lg" />
        <span className="sketch-pill ink border border-border-subtle px-3 py-1 font-mono text-xs">
          {agreement.status}
        </span>
      </div>
      <p className="mt-2 break-all font-mono text-xs text-muted">termsHash {agreement.termsHash}</p>
    </div>
  );
}

function NegotiationLog({ role, run }: { role: Role; run: BrandRun }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
      <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
        <p className="text-2xl">{run.negotiation.status}</p>
        <p className="mt-2 text-sm text-muted">{run.promotion.title}</p>
        <div className="mt-4 grid gap-2">
          {run.candidates.slice(0, 3).map((candidate) => (
            <CandidateLine key={candidate.creatorAgentId} candidate={candidate} />
          ))}
        </div>
      </div>
          <LiveMessageList
            key={run.negotiation.negotiationId}
            role={role}
            messages={run.messages}
            negotiation={run.negotiation}
          />
    </div>
  );
}

function LiveMessageList({
  role,
  messages,
  negotiation,
}: {
  role: Role;
  messages: ApiNegotiationMessage[];
  negotiation: ApiNegotiation;
}) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= messages.length) return;
    const id = window.setTimeout(() => setVisibleCount((count) => count + 1), visibleCount === 0 ? 250 : 900);
    return () => window.clearTimeout(id);
  }, [messages.length, visibleCount]);

  const visible = messages.slice(0, visibleCount);

  if (!messages.length) {
    return (
      <div className="sketch-alt ink border border-border-subtle bg-background p-5 text-sm text-muted">
        협상은 생성됐지만 메시지 목록을 아직 받지 못했습니다. negotiationId:{" "}
        <span className="font-mono">{negotiation.negotiationId}</span>
      </div>
    );
  }

  return (
    <div className="flex max-h-[620px] flex-col gap-3 overflow-y-auto rounded-lg bg-background/60 p-3">
      {visible.map((message, index) => {
        const side = messageSide(message, index);
        const mine = side === role;
        return (
          <motion.div
            key={message.messageId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${mine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`sketch-alt ink max-w-[86%] border border-border-subtle px-4 py-3 ${
                mine ? "bg-accent text-background" : "bg-surface"
              }`}
            >
              <p className="font-mono text-[10px] uppercase opacity-70">
                {side === "brand" ? "Brand Agent" : "Creator Agent"} · #{message.sequence ?? index + 1}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed">{messageLine(message, index)}</p>
              <p className="mt-2 font-mono text-[10px] opacity-60">{formatTime(message.createdAt)}</p>
            </div>
          </motion.div>
        );
      })}
      {visibleCount < messages.length ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <TypingDots /> 다음 A2A 메시지 수신 중
        </div>
      ) : null}
    </div>
  );
}

function CandidateLine({ candidate }: { candidate: ApiCandidate }) {
  const score = typeof candidate.overallScore === "number" ? Math.round(candidate.overallScore * 100) : null;
  const selected = Boolean(candidate.negotiationId);
  return (
    <div className="border-b border-border-subtle/30 pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-xs">{candidate.creatorAgentId}</span>
        <span className={selected ? "text-positive" : candidate.eligible ? "text-muted" : "text-negative"}>
          {selected ? "선택" : candidate.eligible ? "후보" : "차단"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">{score === null ? candidate.explanation ?? "-" : `score ${score}`}</p>
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
  return (
    <Link
      href={`/creator/agreements/${agreement.agreementId}`}
      className="sketch-alt ink flex flex-wrap items-center justify-between gap-3 border border-border-subtle bg-background p-3"
    >
      <span className="min-w-0 truncate font-mono text-xs">{agreement.agreementId}</span>
      <span className="flex items-center gap-2">
        <Money usdc={agreement.terms.compensation.baseAmountUsdc} />
        <span className="text-sm text-muted">{agreement.status}</span>
      </span>
    </Link>
  );
}

function OfferRow({ offer }: { offer: Record<string, unknown> }) {
  const negotiationId = String(offer.negotiationId ?? offer.id ?? "");
  const status = String(offer.status ?? offer.negotiationStatus ?? "OFFER");
  const label = String(offer.productTitle ?? offer.title ?? offer.promotionTitle ?? "협찬 제안");
  const amount = numberFromUnknown(offer.amountUsdc ?? offer.currentAmountUsdc ?? offer.baseAmountUsdc);
  return (
    <Link
      href={negotiationId ? `/creator/offers/${negotiationId}` : "/creator"}
      className="sketch-alt ink flex flex-wrap items-center justify-between gap-3 border border-border-subtle bg-surface-raised p-4"
    >
      <span>
        <span className="block text-xl">{label}</span>
        <span className="font-mono text-xs text-muted">{status}</span>
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

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

function promotionInputFromSetup(setup: BrandSetup) {
  const initialOffer = Math.max(50, Math.round((setup.maxPerDealUsdc * 0.75) / 50) * 50);
  return {
    productName: setup.productName,
    title: `${setup.productName} 협찬 프로젝트`,
    objective: setup.summary || "제품 인지도와 실제 사용 콘텐츠 확보",
    categories: [setup.category || "beauty"],
    targetAudience: setup.moodTags.length ? setup.moodTags.join(", ") : "제품과 어울리는 크리에이터",
    totalBudget: setup.totalUsdc,
    initialOffer,
    maximumPerCreator: setup.maxPerDealUsdc,
    autoAcceptCeiling: setup.maxPerDealUsdc,
    maximumRounds: 3,
    deliverables: [{ format: "reel", count: 1 }],
    usageRights: "organicOnly",
    deadline: deadlineAfterDays(14),
    prohibitedClaims: ["의료 효능 과장", "무검수 게시"],
  };
}

function messageSide(message: ApiNegotiationMessage, index: number): Role {
  if (String(message.role ?? "") === "ROLE_AGENT") return "creator";
  if (String(message.role ?? "") === "ROLE_USER") return "brand";
  const type = String(message.payload?.type ?? "").toUpperCase();
  if (type === "ACCEPT" || type === "REJECT") return "creator";
  return index % 2 === 0 ? "brand" : "creator";
}

function messageLine(message: ApiNegotiationMessage, index: number) {
  const payload = message.payload ?? {};
  const type = String(payload.type ?? (index === 0 ? "OFFER" : "COUNTER")).toUpperCase();
  const terms = isRecord(payload.terms) ? payload.terms : null;
  const compensation = terms && isRecord(terms.compensation) ? terms.compensation : null;
  const amount = numberFromUnknown(compensation?.baseAmountUsdc);
  const rationale = typeof payload.rationale === "string" ? payload.rationale : null;
  const amountText = amount === null ? "" : ` ${amount.toLocaleString()} USDC`;

  if (type === "OFFER") return `제안${amountText}을 보냈습니다.${rationale ? ` ${rationale}` : ""}`;
  if (type === "COUNTER") return `조건을 조정해 역제안${amountText}을 보냈습니다.${rationale ? ` ${rationale}` : ""}`;
  if (type === "ACCEPT") return `조건을 수락했습니다.${amountText ? ` 최종 금액은${amountText}입니다.` : ""}`;
  if (type === "REJECT") return `조건을 거절했습니다.${rationale ? ` ${rationale}` : ""}`;
  if (type === "ESCALATE") return `사람 검토가 필요한 조건입니다.${rationale ? ` ${rationale}` : ""}`;
  return rationale ?? type;
}

function readableError(caught: unknown) {
  if (caught instanceof ProductApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return String(caught);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function deadlineAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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
