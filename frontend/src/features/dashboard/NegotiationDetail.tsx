"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { useAuth } from "@/auth/AuthProvider";
import { Money } from "@/features/chat/Money";
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
import {
  connectPhantomWallet,
  sendPreparedSolanaTransaction,
  signPhantomMessage,
} from "@/features/wallet/phantom";

type Role = "brand" | "creator";
type MessageSide = Role | "system";

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

/**
 * 지갑 주소를 소유 증명과 함께 등록한다.
 *
 * 플랫폼이 유저 키를 보관하지 않으므로(docs/17 D7) 서버 챌린지를 지갑으로 서명해야
 * 주소가 등록된다. 자금을 이동시키지 않는 서명이다.
 */
async function proveAndSaveWallet(client: ProductApiClient, address: string) {
  const { challenge } = await client.createWalletChallenge(address);
  const signature = await signPhantomMessage(challenge.message);
  await client.saveWalletAddress(address, {
    challengeId: challenge.challengeId,
    signature,
  });
}

export function NegotiationDetail({
  role,
  negotiationId,
}: {
  role: Role;
  negotiationId: string;
}) {
  const { context: currentUser, refresh: refreshAuth } = useAuth();
  const client = useMemo(() => new ProductApiClient(), []);
  const [state, setState] = useState<LoadState>({ loading: true, error: null, detail: null });
  const [actionError, setActionError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [fundingState, setFundingState] = useState<"idle" | "connecting" | "signing" | "confirming" | "done">("idle");
  const [settlementState, setSettlementState] = useState<
    "idle" | "connecting" | "verifying" | "releasing" | "done"
  >("idle");

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

  async function fundEscrowWithPhantom() {
    if (!state.detail?.agreement) return;
    setActionError(null);
    setFundingState("connecting");
    try {
      const wallet = await connectPhantomWallet();
      setWalletAddress(wallet.address);
      await proveAndSaveWallet(client, wallet.address);
      await refreshAuth();
      const idempotencySeed = `${state.detail.agreement.agreementId}-${wallet.address}`;
      const prepared = await client.prepareEscrowFunding(
        state.detail.agreement.agreementId,
        uniqueRequestKey(`frontend-prepare-v3-${idempotencySeed}`),
      );
      if (!prepared.funding) {
        await refresh();
        setFundingState("done");
        return;
      }
      if (prepared.funding.brandAuthority !== wallet.address) {
        throw new Error("연결된 Phantom 지갑과 Agreement Brand 지갑이 다릅니다.");
      }
      setFundingState("signing");
      const signature = await sendPreparedSolanaTransaction(prepared.funding);
      setFundingState("confirming");
      await client.confirmEscrowFunding(
        state.detail.agreement.agreementId,
        signature,
        `frontend-confirm-${state.detail.agreement.agreementId}-${signature}`,
      );
      await refresh();
      setFundingState("done");
    } catch (caught) {
      setActionError(readableError(caught));
      setFundingState("idle");
    }
  }

  async function connectAndSaveWalletAddress() {
    setActionError(null);
    setFundingState("connecting");
    try {
      const wallet = await connectPhantomWallet();
      setWalletAddress(wallet.address);
      await proveAndSaveWallet(client, wallet.address);
      await refreshAuth();
      await refresh();
      setFundingState("idle");
      return wallet.address;
    } catch (caught) {
      setActionError(readableError(caught));
      setFundingState("idle");
      throw caught;
    }
  }

  async function connectAndSaveWallet() {
    await connectAndSaveWalletAddress();
  }

  async function ensureCreatorSettlementWallet(escrowDestination?: string | null) {
    setSettlementState("connecting");
    const address = await connectAndSaveWalletAddress();
    if (escrowDestination && escrowDestination !== address) {
      throw new Error(
        `연결된 지갑이 이 계약의 수령 지갑과 다릅니다. 연결됨: ${shortAddress(
          address,
        )}, 필요: ${shortAddress(escrowDestination)}`,
      );
    }
    return address;
  }

  if (state.loading) {
    return <PanelMessage title="협상 기록 불러오는 중" body="에이전트 대화와 계약 정보를 조회하고 있습니다." />;
  }

  if (state.error || !state.detail?.negotiation) {
    return <PanelMessage title="협상 기록을 불러오지 못했습니다" body={state.error ?? "다시 시도해주세요."} />;
  }

  const { negotiation, messages, agreement, escrowBundle, title } = state.detail;
  const effectiveWalletAddress = walletAddress ?? currentUser?.account.walletAddress ?? null;

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
        <SettlementSummaryPanel
          role={role}
          agreement={agreement}
          escrowBundle={escrowBundle}
          walletAddress={effectiveWalletAddress}
          fundingState={fundingState}
          onFund={role === "brand" && agreement ? fundEscrowWithPhantom : undefined}
          onConnectWallet={connectAndSaveWallet}
        />
      </div>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <SectionHeader eyebrow="계약과 예치금" title="마일스톤 정산" />
        {agreement ? (
          <MilestonePanel
            role={role}
            agreement={agreement}
            escrowBundle={escrowBundle}
            walletAddress={effectiveWalletAddress}
            settlementState={settlementState}
            onEnsureCreatorWallet={ensureCreatorSettlementWallet}
            onSettlementState={setSettlementState}
            onRefresh={refresh}
            onError={setActionError}
          />
        ) : (
          <PanelMessage
            title="아직 계약이 생성되지 않았습니다"
            body="협상이 합의되면 마일스톤과 예치 상태가 이 영역에 표시됩니다."
          />
        )}
        {actionError ? <p className="mt-4 text-sm text-negative">{actionError}</p> : null}
      </section>

      <section className="sketch-alt ink border border-border-subtle bg-surface-raised p-5">
        <SectionHeader eyebrow="협상 메시지" title="Agent 대화" />
        <MessageThread role={role} messages={messages} />
      </section>
    </div>
  );
}

function evidenceFromApiError(error: ProductApiError): ApiEvidence | null {
  const detail = error.detail;
  if (!detail || typeof detail !== "object" || !("evidence" in detail)) return null;
  const evidence = (detail as { evidence?: unknown }).evidence;
  if (!evidence || typeof evidence !== "object" || !("evidenceId" in evidence)) return null;
  return evidence as ApiEvidence;
}

function uniqueRequestKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AgreementNegotiationDetail({
  role,
  agreementId,
}: {
  role: Role;
  agreementId: string;
}) {
  const client = useMemo(() => new ProductApiClient(), []);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    negotiationId: string | null;
  }>({ loading: true, error: null, negotiationId: null });

  useEffect(() => {
    let active = true;
    client
      .getAgreement(agreementId)
      .then((agreement) => {
        if (!active) return;
        setState({
          loading: false,
          error: null,
          negotiationId: agreement.negotiationId || null,
        });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setState({ loading: false, error: readableError(caught), negotiationId: null });
      });
    return () => {
      active = false;
    };
  }, [agreementId, client]);

  if (state.loading) {
    return <PanelMessage title="계약 상세 불러오는 중" body="Agreement와 연결된 협상 기록을 조회하고 있습니다." />;
  }

  if (state.error || !state.negotiationId) {
    return (
      <PanelMessage
        title="계약 상세를 불러오지 못했습니다"
        body={state.error ?? "이 Agreement에 연결된 negotiationId가 없습니다."}
      />
    );
  }

  return <NegotiationDetail role={role} negotiationId={state.negotiationId} />;
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
            <Metric label="브랜드" value={textValue(counterparty, "displayName", "미등록")} />
            <Metric label="웹사이트" value={textValue(counterparty, "websiteUrl", "미등록")} />
          </>
        )}
        <Metric
          label="프로모션"
          value={textValue(promotion, "productName", negotiation.productName ?? negotiation.promotionTitle ?? "프로모션")}
        />
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
        <Metric label="협상 라운드" value={`${negotiation.currentRound}/${negotiation.maxRounds}`} />
      </div>
      <div className="mt-4">
        <p className="text-xs text-muted">{role === "creator" ? "내가 해야 받을 작업" : "합의된 작업"}</p>
        <WorkItemList terms={terms} compact={false} />
      </div>
      <p className="mt-4 break-all font-mono text-xs text-muted">협상 기록 {negotiation.taskId}</p>
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
    return <p className="text-sm text-muted">저장된 협상 메시지가 없습니다.</p>;
  }

  return (
    <div className="flex max-h-[820px] flex-col gap-3 overflow-y-auto rounded-lg bg-background/60 p-3">
      {visible.map((message, index) => {
        const side = messageSide(message, index);
        const mine = side === role;
        const system = side === "system";
        return (
          <motion.div
            key={message.messageId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${system ? "justify-center" : mine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`sketch-alt ink max-w-[86%] border border-border-subtle px-4 py-3 ${
                system ? "bg-background text-foreground" : mine ? "bg-accent text-background" : "bg-surface"
              }`}
            >
              <p className="font-mono text-[10px] uppercase opacity-70">
                {messageActorLabel(side)} · #{message.sequence ?? index + 1}
              </p>
              <p className="mt-1 font-mono text-[10px] opacity-70">
                {String(message.payload?.type ?? "협상")} · {message.taskId}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed">{messageLine(message, index)}</p>
              <details className="mt-3">
                <summary className="cursor-pointer font-mono text-[10px] uppercase opacity-70">
                  {system ? "검증 영수증" : "상세 조건"}
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
          <TypingDots /> 다음 협상 메시지
        </div>
      ) : null}
    </div>
  );
}

function SettlementSummaryPanel({
  role,
  agreement,
  escrowBundle,
  walletAddress,
  fundingState,
  onFund,
  onConnectWallet,
}: {
  role: Role;
  agreement: ApiAgreement | null;
  escrowBundle: ApiAgreementEscrowBundle | null;
  walletAddress: string | null;
  fundingState: "idle" | "connecting" | "signing" | "confirming" | "done";
  onFund?: () => Promise<void>;
  onConnectWallet: () => Promise<void>;
}) {
  const escrow = escrowBundle?.escrow ?? null;
  const signature = escrow?.fundingTransactionSignature ?? escrow?.lockSignature ?? null;
  const funded = escrow?.status === "FUNDED" || escrow?.status === "PARTIALLY_RELEASED" || escrow?.status === "RELEASED";
  const latestSettlement = escrowBundle?.settlements?.[escrowBundle.settlements.length - 1] ?? null;
  const totalBaseUnits =
    escrow?.lockedAmountBaseUnits ??
    (agreement ? String(Math.round(agreement.terms.compensation.baseAmountUsdc * 1_000_000)) : undefined);
  const releasedBaseUnits =
    escrow?.releasedAmountBaseUnits ??
    escrowBundle?.settlements
      ?.filter((settlement) => settlement.status === "CONFIRMED" || Boolean(settlement.signature))
      .reduce((sum, settlement) => sum + safeBigInt(settlement.amountBaseUnits), BigInt(0))
      .toString();
  const remainingBaseUnits =
    totalBaseUnits && releasedBaseUnits
      ? (safeBigInt(totalBaseUnits) - safeBigInt(releasedBaseUnits)).toString()
      : totalBaseUnits;
  const settlementSignature = latestSettlement?.signature ?? null;
  const primaryTx = role === "brand" ? signature : settlementSignature;

  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <SectionHeader eyebrow="정산" title={role === "brand" ? "지갑과 예치" : "지갑과 정산"} />
      <div className="grid gap-3">
        <Metric label="지갑 연결" value={walletAddress ? shortAddress(walletAddress) ?? walletAddress : "연결 필요"} />
        <Metric label="계약 금액" value={agreement ? `${agreement.terms.compensation.baseAmountUsdc.toLocaleString()} USDC` : "계약 전"} />
        <Metric label="예치 상태" value={escrow ? escrow.status : agreement ? "CREATED 전" : "계약 전"} />
        <Metric label={role === "brand" ? "남은 예치금" : "지급 완료"} value={role === "brand" ? baseUnitsToUsdcLabel(remainingBaseUnits) : baseUnitsToUsdcLabel(releasedBaseUnits)} />
        <Metric label={role === "brand" ? "예치 기록" : "정산 기록"} value={primaryTx ? "확인 가능" : role === "brand" ? "예치 전" : "정산 전"} />
      </div>
      {role === "brand" && onFund && !funded ? (
        <button
          type="button"
          onClick={walletAddress ? onFund : onConnectWallet}
          disabled={fundingState !== "idle"}
          className="sketch-pill mt-4 bg-accent px-4 py-2 text-background disabled:opacity-50"
        >
          {fundingButtonLabel(fundingState, walletAddress)}
        </button>
      ) : null}
      {role === "creator" ? (
        <button
          type="button"
          onClick={onConnectWallet}
          disabled={fundingState !== "idle"}
          className="sketch-pill mt-4 border border-border-subtle px-4 py-2 disabled:opacity-50"
        >
          {walletAddress ? "수령 지갑 다시 연결" : "수령 지갑 연결"}
        </button>
      ) : null}
      {signature ? <TransactionReference signature={signature} network={escrow?.network} label="예치 기록" /> : null}
      {latestSettlement?.signature ? (
        <TransactionReference
          signature={latestSettlement.signature}
          network={escrow?.network}
          label="정산 기록"
        />
      ) : null}
    </section>
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
  walletAddress,
  settlementState,
  onEnsureCreatorWallet,
  onSettlementState,
  onRefresh,
  onError,
}: {
  role: Role;
  agreement: ApiAgreement;
  escrowBundle: ApiAgreementEscrowBundle | null;
  walletAddress: string | null;
  settlementState: "idle" | "connecting" | "verifying" | "releasing" | "done";
  onEnsureCreatorWallet: (escrowDestination?: string | null) => Promise<string>;
  onSettlementState: (state: "idle" | "connecting" | "verifying" | "releasing" | "done") => void;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const escrow = escrowBundle?.escrow ?? null;
  const settlements = escrowBundle?.settlements ?? [];
  return (
    <div className="grid gap-3">
      {agreement.terms.milestones.map((milestone) => {
        const settlement = settlements.find((item) => item.milestoneId === milestone.id);
        const released = settlement?.status === "CONFIRMED" || Boolean(settlement?.signature);
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
            {settlement?.signature ? (
              <TransactionReference
                signature={settlement.signature}
                network={escrow?.network}
                label="settlement tx"
              />
            ) : null}
            <WorkItemList terms={agreement.terms} compact />
            {role === "creator" && escrow && !released ? (
              <EvidenceForm
                agreement={agreement}
                escrow={escrow}
                milestoneId={milestone.id}
                walletAddress={walletAddress}
                settlementState={settlementState}
                onEnsureCreatorWallet={onEnsureCreatorWallet}
                onSettlementState={onSettlementState}
                onRefresh={onRefresh}
                onError={onError}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EvidenceForm({
  agreement,
  escrow,
  milestoneId,
  walletAddress,
  settlementState,
  onEnsureCreatorWallet,
  onSettlementState,
  onRefresh,
  onError,
}: {
  agreement: ApiAgreement;
  escrow: NonNullable<ApiAgreementEscrowBundle["escrow"]>;
  milestoneId: string;
  walletAddress: string | null;
  settlementState: "idle" | "connecting" | "verifying" | "releasing" | "done";
  onEnsureCreatorWallet: (escrowDestination?: string | null) => Promise<string>;
  onSettlementState: (state: "idle" | "connecting" | "verifying" | "releasing" | "done") => void;
  onRefresh: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const client = useMemo(() => new ProductApiClient(), []);
  const [url, setUrl] = useState("https://instagram.com/p/demo-brand-ad");
  const [busy, setBusy] = useState(false);
  const [lastEvidence, setLastEvidence] = useState<ApiEvidence | null>(null);
  const [lastSettlementSignature, setLastSettlementSignature] = useState<string | null>(null);
  // 4단 판정 중 "오류가 아닌 상태"(재제출 요구 / 사람 검토)를 담는다. onError 로 내면
  // 화면이 실패로 보여서 크리에이터가 다시 올릴 수 있다는 걸 놓친다.
  const [outcomeNotice, setOutcomeNotice] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    onError(null);
    try {
      const connectedWallet = await onEnsureCreatorWallet(escrow.creatorDestination);
      if (escrow.creatorDestination && connectedWallet !== escrow.creatorDestination) {
        throw new Error(
          `연결된 지갑이 이 계약의 수령 지갑과 다릅니다. 연결됨: ${shortAddress(
            connectedWallet,
          )}, 필요: ${shortAddress(escrow.creatorDestination)}`,
        );
      }
      onSettlementState("verifying");
      let evidenceToVerify: ApiEvidence | null = null;
      try {
        evidenceToVerify = await client.submitEvidence(agreement, milestoneId, url);
      } catch (caught) {
        if (caught instanceof ProductApiError && caught.code === "EVIDENCE_ALREADY_SUBMITTED") {
          evidenceToVerify = evidenceFromApiError(caught);
        } else {
          throw caught;
        }
      }
      if (!evidenceToVerify) {
        throw new Error("기존 증빙을 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.");
      }
      const verified = await client.verifyEvidence(evidenceToVerify.evidenceId);
      setLastEvidence(verified.evidence);
      setOutcomeNotice(null);
      if (verified.autoSettlement?.released) {
        const signature = verified.autoSettlement.settlement?.signature ?? null;
        setLastSettlementSignature(signature);
        await onRefresh();
        onSettlementState("done");
        return;
      }
      // 통과하지 못했지만 계약이 살아 있는 두 상태는 안내로 표시하고 끝낸다.
      if (verified.outcome === "REVISION_REQUIRED" || verified.outcome === "MANUAL_REVIEW") {
        setOutcomeNotice(evidenceOutcomeNotice(verified));
        await onRefresh();
        onSettlementState("idle");
        return;
      }
      if (verified.evidence.status === "PASSED") {
        throw new Error(
          `증빙 검증은 통과했지만 자동 정산이 아직 완료되지 않았습니다. 사유: ${
            verified.autoSettlement?.reason ?? "AUTO_SETTLEMENT_DEFERRED"
          }`,
        );
      }
      await onRefresh();
      onSettlementState("done");
    } catch (caught) {
      onError(readableError(caught));
      onSettlementState("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="sketch-alt ink border border-border-subtle bg-background p-3 text-xs">
        <p className="text-muted">정산 받을 지갑</p>
        <p className="mt-1 break-all font-mono">
          {shortAddress(walletAddress) ?? "연결 필요"}
        </p>
      </div>
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
        {settlementButtonLabel(settlementState, walletAddress)}
      </button>
      {outcomeNotice ? (
        <p className="sketch-alt ink border border-border-subtle bg-surface p-3 text-xs">
          {outcomeNotice}
        </p>
      ) : null}
      {lastEvidence ? <p className="text-xs text-muted">최근 검토: {lastEvidence.status}</p> : null}
      {lastSettlementSignature ? (
        <TransactionReference signature={lastSettlementSignature} network={escrow.network} label="정산 기록" />
      ) : null}
    </div>
  );
}

const EVIDENCE_REASON_COPY: Record<string, string> = {
  EVIDENCE_DISCLOSURE_MISSING: "광고 표시(#광고 등)가 확인되지 않았습니다.",
  EVIDENCE_URL_UNREACHABLE: "게시물에 접근할 수 없었습니다.",
  EVIDENCE_BRAND_MENTION_MISSING: "브랜드/제품 언급이 확인되지 않았습니다.",
  EVIDENCE_PROHIBITED_CLAIM_FOUND: "사용할 수 없는 표현이 발견됐습니다.",
  EVIDENCE_LOW_CONFIDENCE: "자동 판정 신뢰도가 낮습니다.",
};

/** 4단 판정을 크리에이터가 무엇을 해야 하는지로 번역한다. */
function evidenceOutcomeNotice(verified: {
  outcome?: string;
  reasonCodes?: string[];
  revisionsRemaining?: number;
}): string {
  const reasons = (verified.reasonCodes ?? [])
    .map((code) => EVIDENCE_REASON_COPY[code] ?? code)
    .join(" ");
  if (verified.outcome === "REVISION_REQUIRED") {
    const remaining = verified.revisionsRemaining ?? 0;
    return `수정이 필요합니다. ${reasons} 고쳐서 다시 올려주세요. (남은 재제출 ${remaining}회)`;
  }
  return `자동 판정이 어려워 검토 중입니다. ${reasons} 결과가 정해지면 알려드립니다.`;
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

function TransactionReference({
  signature,
  network,
  label,
}: {
  signature: string;
  network?: string | null;
  label: string;
}) {
  const explorerUrl = explorerTransactionUrl(signature, network);
  if (!explorerUrl) {
    return (
      <p className="mt-2 break-all font-mono text-xs text-muted">
        {label} localnet · {signature}
      </p>
    );
  }
  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block break-all font-mono text-xs underline decoration-[1px] underline-offset-4"
    >
      {label} {signature}
    </a>
  );
}

function explorerTransactionUrl(signature: string, network?: string | null) {
  if (network === "solanaLocalnet" || network === "localnet") return null;
  const cluster = network === "solanaMainnet" || network === "mainnet" ? null : "devnet";
  const suffix = cluster ? `?cluster=${cluster}` : "";
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

function shortAddress(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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

function messageActorLabel(side: MessageSide) {
  if (side === "system") return "System";
  return side === "brand" ? "Brand Agent" : "Creator Agent";
}

function messageSide(message: ApiNegotiationMessage, index: number): MessageSide {
  const payload = message.payload ?? message.content ?? {};
  if (String(message.role ?? "") === "ROLE_SYSTEM") return "system";
  if (String(payload.type ?? "").toUpperCase() === "VERIFICATION_EVENT") return "system";
  if (String(message.role ?? "") === "ROLE_AGENT") return "creator";
  if (String(message.role ?? "") === "ROLE_USER") return "brand";
  const type = String(payload.type ?? "").toUpperCase();
  if (type === "ACCEPT" || type === "REJECT") return "creator";
  return index % 2 === 0 ? "brand" : "creator";
}

function messageLine(message: ApiNegotiationMessage, index: number) {
  const payload = message.payload ?? message.content ?? {};
  const display = isRecord(payload.display) ? payload.display : null;
  if (typeof display?.message === "string" && display.message.trim()) {
    const headline =
      typeof display.headline === "string" && display.headline.trim()
        ? `${display.headline} · `
        : "";
    const rationale =
      typeof display.rationale === "string" && display.rationale.trim()
        ? ` ${display.rationale}`
        : "";
    return `${headline}${display.message}${rationale}`;
  }
  const type = String(payload.type ?? (index === 0 ? "OFFER" : "COUNTER")).toUpperCase();
  if (type === "VERIFICATION_EVENT") {
    const amount = numberFromUnknown(payload.amountUsdc);
    const status = String(payload.status ?? "검증 기록");
    const provider = String(payload.provider ?? "pay.sh");
    return `${provider} 검증 ${status}${amount === null ? "" : ` · ${amount.toLocaleString()} USDC`}`;
  }
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
  return JSON.stringify(a2aData ?? message.payload ?? message.content ?? {}, null, 2);
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

function fundingButtonLabel(
  state: "idle" | "connecting" | "signing" | "confirming" | "done",
  walletAddress: string | null,
) {
  if (state === "connecting") return "지갑 연결 중";
  if (state === "signing") return "지갑에서 승인해 주세요";
  if (state === "confirming") return "에스크로 예치 중";
  if (state === "done") return "에스크로 예치 완료";
  return walletAddress ? "지갑으로 에스크로 예치하기" : "지갑 연결";
}

function settlementButtonLabel(
  state: "idle" | "connecting" | "verifying" | "releasing" | "done",
  walletAddress: string | null,
) {
  if (state === "connecting") return "수령 지갑 연결 중";
  if (state === "verifying") return "Agent가 결과물을 검토 중";
  if (state === "releasing") return "Creator 지갑으로 정산 중";
  if (state === "done") return "정산 완료";
  return walletAddress ? "URL 제출하고 정산 요청" : "지갑 연결 후 정산";
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

function safeBigInt(value: string | undefined) {
  if (!value) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function readableError(caught: unknown) {
  if (caught instanceof ProductApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return String(caught);
}
