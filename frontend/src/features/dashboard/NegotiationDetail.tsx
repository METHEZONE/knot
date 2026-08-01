"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { Money } from "@/features/chat/Money";
import { usePhantomWallet } from "@/features/wallet/usePhantomWallet";
import {
  type ApiAgreement,
  type ApiAgreementEscrowBundle,
  type ApiAgreementTerms,
  type ApiEvidence,
  type ApiNegotiation,
  type ApiNegotiationMessage,
  ProductApiClient,
  ProductApiError,
} from "@/product/apiClient";

type Role = "brand" | "creator";

type DetailState = {
  negotiation: ApiNegotiation | null;
  messages: ApiNegotiationMessage[];
  agreement: ApiAgreement | null;
  escrowBundle: ApiAgreementEscrowBundle | null;
  title: string;
};

type LoadState = {
  loading: boolean;
  error: string | null;
  detail: DetailState | null;
};

export function NegotiationDetail({
  role,
  negotiationId,
}: {
  role: Role;
  negotiationId: string;
}) {
  const client = useMemo(() => new ProductApiClient(), []);
  const [state, setState] = useState<LoadState>({ loading: true, error: null, detail: null });
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    const offerDetailPromise = role === "creator" ? client.getCreatorOfferDetail(negotiationId) : null;
    const [negotiation, messages, agreement, title] = await Promise.all([
      offerDetailPromise
        ? offerDetailPromise.then((detail) => detail.negotiation as ApiNegotiation)
        : client.getNegotiation(negotiationId),
      client.listNegotiationMessages(negotiationId),
      client.getNegotiationAgreement(negotiationId).catch((caught: unknown) => {
        if (caught instanceof ProductApiError && caught.status === 404) return null;
        throw caught;
      }),
      offerDetailPromise
        ? offerDetailPromise.then((detail) => String(detail.offer.title ?? "협찬 제안"))
        : Promise.resolve("협상 상세"),
    ]);
    const escrowBundle = agreement
      ? await client.getAgreementEscrow(agreement.agreementId).catch((caught: unknown) => {
          if (caught instanceof ProductApiError && caught.status === 404) return null;
          throw caught;
        })
      : null;
    return { negotiation, messages, agreement, escrowBundle, title };
  }, [client, negotiationId, role]);

  useEffect(() => {
    let active = true;
    loadDetail()
      .then((detail) => {
        if (!active) return;
        setState({ loading: false, error: null, detail });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setState({ loading: false, error: readableError(caught), detail: null });
      });
    return () => {
      active = false;
    };
  }, [loadDetail]);

  async function refresh() {
    setActionError(null);
    try {
      const detail = await loadDetail();
      setState({ loading: false, error: null, detail });
    } catch (caught) {
      setActionError(readableError(caught));
    }
  }

  async function lockEscrow() {
    if (!state.detail?.agreement) return;
    setActionError(null);
    try {
      await client.lockEscrow(state.detail.agreement.agreementId);
      await refresh();
    } catch (caught) {
      setActionError(readableError(caught));
    }
  }

  if (state.loading) {
    return <PanelMessage title="협상 기록 불러오는 중" body="A2A 메시지와 계약 정보를 조회하고 있습니다." />;
  }

  if (state.error || !state.detail?.negotiation) {
    return <PanelMessage title="협상 기록을 불러오지 못했습니다" body={state.error ?? "다시 시도해주세요."} />;
  }

  const { negotiation, messages, agreement, escrowBundle, title } = state.detail;

  return (
    <div className="flex flex-col gap-6 py-8">
      <section className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
        <div>
          <Link href={role === "brand" ? "/brand" : "/creator"} className="font-mono text-xs uppercase text-muted">
            dashboard
          </Link>
          <h1 className="mt-2 text-5xl">{title}</h1>
          <p className="mt-2 break-all font-mono text-xs text-muted">{negotiation.negotiationId}</p>
        </div>
        <AgentCharacter
          agentId={role === "brand" ? negotiation.brandAgentId : negotiation.creatorAgentId}
          side={role}
          category="beauty"
          pose="sit"
          size={140}
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <CounterpartyProfilePanel role={role} negotiation={negotiation} agreement={agreement} />
        <WorkSummaryPanel role={role} negotiation={negotiation} agreement={agreement} />
        <WalletSettlementPanel role={role} escrowBundle={escrowBundle} />
      </div>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeader eyebrow="계약과 escrow" title="마일스톤 정산" />
        {agreement ? (
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <EscrowPanel
              role={role}
              agreement={agreement}
              escrowBundle={escrowBundle}
              onLock={role === "brand" ? lockEscrow : undefined}
            />
            <MilestonePanel
              role={role}
              agreement={agreement}
              escrowBundle={escrowBundle}
              onRefresh={refresh}
              onError={setActionError}
            />
          </div>
        ) : (
          <PanelMessage
            title="아직 계약이 생성되지 않았습니다"
            body="협상이 합의되면 termsHash, 마일스톤, escrow 상태가 이 영역에 표시됩니다."
          />
        )}
        {actionError ? <p className="mt-4 text-sm text-negative">{actionError}</p> : null}
      </section>

      <section className="sketch-alt ink border border-border-subtle bg-surface-raised p-5">
        <SectionHeader eyebrow="실제 A2A 메시지" title="Agent 대화" />
        <MessageThread role={role} messages={messages} />
      </section>
    </div>
  );
}

function CounterpartyProfilePanel({
  role,
  negotiation,
  agreement,
}: {
  role: Role;
  negotiation: ApiNegotiation;
  agreement: ApiAgreement | null;
}) {
  const brand = agreement?.brandSnapshot ?? negotiation.brandSnapshot ?? null;
  const creator = agreement?.creatorSnapshot ?? negotiation.creatorSnapshot ?? null;
  const promotion = agreement?.promotionSnapshot ?? negotiation.promotionSnapshot ?? null;
  const counterparty = role === "brand" ? creator : brand;
  const counterpartyTitle =
    role === "brand"
      ? textValue(counterparty, "displayName", agreement?.creatorDisplayName ?? negotiation.creatorDisplayName ?? negotiation.creatorAgentId)
      : textValue(counterparty, "displayName", agreement?.brandDisplayName ?? negotiation.brandDisplayName ?? negotiation.brandAgentId);
  const counterpartyAgent =
    role === "brand"
      ? textValue(counterparty, "creatorAgentId", negotiation.creatorAgentId)
      : negotiation.brandAgentId;

  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <SectionHeader
        eyebrow={role === "brand" ? "Creator profile" : "Brand profile"}
        title={counterpartyTitle}
      />
      <div className="grid gap-3">
        <Metric label={role === "brand" ? "Creator Agent" : "Brand Agent"} value={counterpartyAgent} />
        {role === "brand" ? (
          <>
            <Metric label="카테고리" value={listValue(counterparty, "categories")} />
            <Metric label="완료된 거래" value={textValue(counterparty, "completedDealCount", "0")} />
          </>
        ) : (
          <>
            <Metric label="웹사이트" value={textValue(counterparty, "websiteUrl", "미등록")} />
            <Metric label="타깃" value={textValue(counterparty, "targetAudience", "미등록")} />
          </>
        )}
        <Metric label="프로모션" value={textValue(promotion, "productName", negotiation.productName ?? negotiation.promotionTitle ?? "프로모션")} />
      </div>
      <p className="mt-3 text-sm text-muted">
        {role === "brand"
          ? "이 협상은 위 Creator Agent와 체결된 기록입니다."
          : "이 협상은 위 Brand Agent가 보낸 제안에서 체결된 기록입니다."}
      </p>
    </section>
  );
}

function WorkSummaryPanel({
  role,
  negotiation,
  agreement,
}: {
  role: Role;
  negotiation: ApiNegotiation;
  agreement: ApiAgreement | null;
}) {
  const terms = agreement?.terms ?? negotiation.currentTerms;
  const amount = agreement?.terms.compensation.baseAmountUsdc ?? negotiation.currentTerms.compensation.baseAmountUsdc;
  const creatorName = agreement?.creatorDisplayName ?? negotiation.creatorDisplayName ?? negotiation.creatorAgentId;
  const productName = agreement?.productName ?? negotiation.productName ?? negotiation.promotionTitle ?? "프로모션";
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <SectionHeader eyebrow="Agent 결과" title={negotiation.status} />
      <div className="grid gap-3">
        <Metric label="연동된 크리에이터" value={creatorName} />
        <Metric label="제품/프로모션" value={productName} />
        <Metric label="합의 금액" value={`${amount.toLocaleString()} USDC`} />
        <Metric label="A2A Round" value={`${negotiation.currentRound}/${negotiation.maxRounds}`} />
      </div>
      <div className="mt-4">
        <p className="text-xs text-muted">{role === "creator" ? "내가 해야 받을 작업" : "합의된 작업"}</p>
        <WorkItemList terms={terms} compact={false} />
      </div>
      <p className="mt-4 break-all font-mono text-xs text-muted">A2A Task {negotiation.taskId}</p>
    </section>
  );
}

function MessageThread({ role, messages }: { role: Role; messages: ApiNegotiationMessage[] }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= messages.length) return;
    const id = window.setTimeout(() => setVisibleCount((count) => count + 1), visibleCount === 0 ? 200 : 850);
    return () => window.clearTimeout(id);
  }, [messages.length, visibleCount]);

  const visible = messages.slice(0, visibleCount);

  if (!messages.length) {
    return <p className="text-sm text-muted">저장된 A2A 메시지가 없습니다.</p>;
  }

  return (
    <div className="flex max-h-[820px] flex-col gap-3 overflow-y-auto rounded-lg bg-background/60 p-3">
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
              <p className="mt-1 font-mono text-[10px] opacity-70">
                {message.transport ?? "A2A_STORED"} · {message.a2aEndpoint ?? message.taskId}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed">{messageLine(message, index)}</p>
              <details className="mt-3">
                <summary className="cursor-pointer font-mono text-[10px] uppercase opacity-70">
                  A2A payload
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background/80 p-2 font-mono text-[10px] text-foreground">
                  {formatA2aPayload(message)}
                </pre>
              </details>
              <p className="mt-2 font-mono text-[10px] opacity-60">{formatTime(message.createdAt)}</p>
            </div>
          </motion.div>
        );
      })}
      {visibleCount < messages.length ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <TypingDots /> 다음 A2A 메시지
        </div>
      ) : null}
    </div>
  );
}

function WalletSettlementPanel({
  role,
  escrowBundle,
}: {
  role: Role;
  escrowBundle: ApiAgreementEscrowBundle | null;
}) {
  const client = useMemo(() => new ProductApiClient(), []);
  const wallet = usePhantomWallet();
  const [balance, setBalance] = useState<Record<string, unknown> | null>(null);
  const escrow = escrowBundle?.escrow ?? null;
  const latestSettlement = escrowBundle?.settlements?.[escrowBundle.settlements.length - 1] ?? null;

  const loadBalance = useCallback(async () => {
    setBalance(await client.getMyWalletBalance());
  }, [client]);

  useEffect(() => {
    let active = true;
    client
      .getMyWalletBalance()
      .then((nextBalance) => {
        if (active) setBalance(nextBalance);
      })
      .catch(() => {
        if (active) setBalance({ connected: false });
      });
    return () => {
      active = false;
    };
  }, [client, wallet.address]);

  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <SectionHeader eyebrow="Wallet & settlement" title={role === "brand" ? "지갑과 예치" : "지갑과 정산"} />
      <div className="grid gap-3">
        <Metric label="Phantom 지갑" value={wallet.address ?? textValue(balance, "address", "미연결")} />
        <Metric label="잔고" value={walletBalanceLabel(balance)} />
        <Metric label="Escrow" value={escrow ? `${escrow.status} · ${baseUnitsToUsdcLabel(escrow.lockedAmountBaseUnits)}` : "아직 잠김 없음"} />
        <Metric label={role === "brand" ? "크리에이터 수령 지갑" : "수령 지갑"} value={escrow?.creatorDestinationWallet ?? "정산 지갑 연결 필요"} />
        <Metric label="정산 tx" value={latestSettlement?.signature ?? "정산 전"} />
      </div>
      <button
        type="button"
        onClick={() => {
          void wallet.connect().then(() => loadBalance());
        }}
        disabled={wallet.status === "connecting" || wallet.status === "saving"}
        className="sketch-pill mt-4 bg-accent px-4 py-2 text-background disabled:opacity-50"
      >
        {wallet.status === "connecting" ? "Phantom 연결 중..." : wallet.status === "saving" ? "지갑 저장 중..." : "Phantom 지갑 연결"}
      </button>
      {wallet.error ? <p className="mt-2 text-sm text-negative">{wallet.error}</p> : null}
      <p className="mt-3 text-sm text-muted">
        Agent가 정책 한도 안에서 escrow lock/release를 실행하고, Phantom 지갑은 사용자의 수령/확인 지갑으로 저장됩니다.
      </p>
    </section>
  );
}

function EscrowPanel({
  role,
  agreement,
  escrowBundle,
  onLock,
}: {
  role: Role;
  agreement: ApiAgreement;
  escrowBundle: ApiAgreementEscrowBundle | null;
  onLock?: () => Promise<void>;
}) {
  const escrow = escrowBundle?.escrow ?? null;
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-4">
      <p className="text-sm text-muted">Agreement</p>
      <p className="mt-1 break-all font-mono text-xs">{agreement.agreementId}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-3">
        <Money usdc={agreement.terms.compensation.baseAmountUsdc} size="lg" />
        <span className="sketch-pill ink border border-border-subtle px-3 py-1 font-mono text-xs">
          {escrow ? escrow.status : "ESCROW_PENDING"}
        </span>
      </div>
      <p className="mt-3 break-all font-mono text-xs text-muted">termsHash {agreement.termsHash}</p>
      {escrow ? (
        <div className="mt-4 grid gap-2 text-sm">
          <Metric label="잠긴 금액" value={baseUnitsToUsdcLabel(escrow.lockedAmountBaseUnits)} />
          <Metric label="지급 완료" value={baseUnitsToUsdcLabel(escrow.releasedAmountBaseUnits)} />
          <Metric label="lock signature" value={escrow.lockSignature ?? "pending"} />
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-muted">아직 실제 escrow lock 기록이 없습니다.</p>
          {role === "brand" && onLock ? (
            <button type="button" onClick={onLock} className="sketch-pill mt-3 bg-accent px-4 py-2 text-background">
              에스크로 잠그기
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function WorkItemList({ terms, compact }: { terms: ApiAgreementTerms; compact: boolean }) {
  if (!terms.deliverables.length) {
    return <p className="mt-2 text-sm text-muted">아직 합의된 작업이 없습니다.</p>;
  }
  return (
    <div className={`mt-2 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
      {terms.deliverables.map((deliverable, index) => (
        <div key={`${deliverable.format}-${index}`} className="sketch-alt ink border border-border-subtle bg-background p-3">
          <p className="text-lg">{formatDeliverable(deliverable.format)} {deliverable.count}개</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {deliverable.postWindow.start} - {deliverable.postWindow.end}
          </p>
          <p className="mt-1 text-xs text-muted">수정 {deliverable.revisionRounds ?? 1}회까지</p>
        </div>
      ))}
    </div>
  );
}

function MilestonePanel({
  role,
  agreement,
  escrowBundle,
  onRefresh,
  onError,
}: {
  role: Role;
  agreement: ApiAgreement;
  escrowBundle: ApiAgreementEscrowBundle | null;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const escrow = escrowBundle?.escrow ?? null;
  const settlements = escrowBundle?.settlements ?? [];
  return (
    <div className="grid gap-3">
      {agreement.terms.milestones.map((milestone) => {
        const released = settlements.some((settlement) => settlement.milestoneId === milestone.id);
        const amount = Math.round((agreement.terms.compensation.baseAmountUsdc * milestone.releasePct) / 100);
        return (
          <div key={milestone.id} className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xl">{milestone.trigger}</p>
                <p className="mt-1 font-mono text-xs text-muted">{milestone.id} · {milestone.releasePct}%</p>
              </div>
              <Money usdc={amount} />
            </div>
            <p className="mt-3 text-sm text-muted">
              {released
                ? "정산 완료"
                : escrow
                  ? `에스크로 잔금 수령 조건: ${deliverableRequirement(agreement.terms)} 완료 URL 제출 후 Agent 검토 통과`
                  : `에스크로가 잠긴 뒤 ${deliverableRequirement(agreement.terms)} 완료 URL을 제출할 수 있습니다.`}
            </p>
            <WorkItemList terms={agreement.terms} compact />
            {role === "creator" ? (
              escrow && !released ? (
                <EvidenceForm
                  agreement={agreement}
                  escrowId={escrow.escrowId}
                  milestoneId={milestone.id}
                  onRefresh={onRefresh}
                  onError={onError}
                />
              ) : (
                <EvidencePlaceholder released={released} hasEscrow={Boolean(escrow)} />
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EvidencePlaceholder({ released, hasEscrow }: { released: boolean; hasEscrow: boolean }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      <input
        disabled
        placeholder="https://instagram.com/p/..."
        className="sketch-alt ink border border-border-subtle bg-surface px-3 py-2 text-sm text-muted outline-none opacity-70"
      />
      <p className="text-xs text-muted">
        {released
          ? "이미 Agent 검토와 정산이 완료되어 추가 제출이 잠겼습니다."
          : hasEscrow
            ? "제출 준비 중입니다."
            : "에스크로가 먼저 잠겨야 영상 링크를 제출할 수 있습니다."}
      </p>
    </div>
  );
}

function EvidenceForm({
  agreement,
  escrowId,
  milestoneId,
  onRefresh,
  onError,
}: {
  agreement: ApiAgreement;
  escrowId: string;
  milestoneId: string;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const client = useMemo(() => new ProductApiClient(), []);
  const [url, setUrl] = useState("https://instagram.com/p/demo-brand-ad");
  const [busy, setBusy] = useState(false);
  const [lastEvidence, setLastEvidence] = useState<ApiEvidence | null>(null);

  async function submit() {
    setBusy(true);
    onError(null);
    try {
      const evidence = await client.submitEvidence(agreement, milestoneId, url);
      const verification = await client.verifyEvidenceWithAgentActions(evidence.evidenceId);
      setLastEvidence(verification.evidence);
      if (
        verification.evidence.status === "PASSED" &&
        verification.autoRelease?.status !== "RELEASED"
      ) {
        await client.releaseMilestone(escrowId, milestoneId);
      }
      await onRefresh();
    } catch (caught) {
      onError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://instagram.com/p/..."
        className="sketch-alt ink border border-border-subtle bg-surface px-3 py-2 text-sm outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !url.trim()}
        className="sketch-pill self-start bg-accent px-4 py-2 text-background disabled:opacity-50"
      >
        {busy ? "Agent 검토 중…" : "URL 제출하고 Agent 검토"}
      </button>
      {lastEvidence ? <p className="text-xs text-muted">최근 검토: {lastEvidence.status}</p> : null}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 break-all font-mono text-sm">{value}</p>
    </div>
  );
}

function PanelMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="sketch ink border border-border-subtle bg-surface p-5">
      <p className="text-2xl">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
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

function formatA2aPayload(message: ApiNegotiationMessage) {
  const a2aData = firstA2aPartData(message.a2aMessage);
  return JSON.stringify(a2aData ?? message.payload ?? {}, null, 2);
}

function firstA2aPartData(a2aMessage: Record<string, unknown> | undefined) {
  const parts = a2aMessage?.parts;
  if (!Array.isArray(parts)) return null;
  const first = parts[0];
  if (!isRecord(first)) return null;
  return first.data ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function textValue(source: Record<string, unknown> | null | undefined, key: string, fallback: string) {
  const value = source?.[key];
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString();
  return fallback;
}

function listValue(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  if (Array.isArray(value)) return value.map(String).join(", ") || "미등록";
  return typeof value === "string" && value ? value : "미등록";
}

function walletBalanceLabel(balance: Record<string, unknown> | null) {
  if (!balance) return "조회 중";
  if (!balance || balance.connected === false) return "지갑 미연결";
  if (typeof balance.error === "string") return balance.error;
  const sol = typeof balance.sol === "number" ? `${balance.sol.toLocaleString()} SOL` : "SOL -";
  const usdc = typeof balance.usdc === "number" ? `${balance.usdc.toLocaleString()} USDC` : "USDC -";
  return `${usdc} / ${sol}`;
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

function deliverableRequirement(terms: ApiAgreementTerms) {
  const parts = terms.deliverables.map((deliverable) => `${formatDeliverable(deliverable.format)} ${deliverable.count}개`);
  return parts.length ? parts.join(", ") : "합의 작업";
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

function readableError(caught: unknown) {
  if (caught instanceof ProductApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return String(caught);
}
