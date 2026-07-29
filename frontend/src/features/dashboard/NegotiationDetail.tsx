"use client";

import { useEffect, useState } from "react";
import { AgentCharacter } from "@/components/AgentCharacter";
import {
  ProductApiClient,
  type ApiAgreement,
  type ApiAgreementEscrowBundle,
  type ApiEvidence,
  type ApiNegotiation,
  type ApiNegotiationMessage,
  type ApiReceipt,
} from "@/product/apiClient";

type DetailState =
  | { status: "loading"; negotiation: null; messages: []; agreement: null; error: null }
  | {
      status: "ready";
      negotiation: ApiNegotiation;
      messages: ApiNegotiationMessage[];
      agreement: ApiAgreement | null;
      escrowBundle: ApiAgreementEscrowBundle | null;
      error: null;
    }
  | { status: "error"; negotiation: null; messages: []; agreement: null; error: string };

export function NegotiationDetail({ negotiationId }: { negotiationId: string }) {
  const [state, setState] = useState<DetailState>({
    status: "loading",
    negotiation: null,
    messages: [],
    agreement: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    const client = new ProductApiClient();
    Promise.all([
      client.getNegotiation(negotiationId),
      client.listNegotiationMessages(negotiationId),
      client.getNegotiationAgreement(negotiationId).catch(() => null),
    ])
      .then(async ([negotiation, messages, agreement]) => {
        const escrowBundle = agreement ? await client.getAgreementEscrow(agreement.agreementId).catch(() => null) : null;
        if (!cancelled) setState({ status: "ready", negotiation, messages, agreement, escrowBundle, error: null });
      })
      .catch((caught) => {
        if (!cancelled) {
          setState({
            status: "error",
            negotiation: null,
            messages: [],
            agreement: null,
            error: caught instanceof Error ? caught.message : String(caught),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [negotiationId]);

  if (state.status === "loading") {
    return <Shell negotiationId={negotiationId}><Panel text="협상 기록을 불러오는 중..." /></Shell>;
  }
  if (state.status === "error") {
    return <Shell negotiationId={negotiationId}><Panel text={state.error} /></Shell>;
  }

  return (
    <Shell negotiationId={negotiationId}>
      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">협상 상태</h2>
          <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-3 py-1 font-mono text-xs text-muted">
            {state.negotiation.status}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Brand Agent" value={state.negotiation.brandAgentId} />
          <Stat label="Creator Agent" value={state.negotiation.creatorAgentId} />
          <Stat label="Round" value={`${state.negotiation.currentRound} / ${state.negotiation.maxRounds}`} />
        </div>
      </section>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl">에이전트끼리 대화</h2>
          <div className="flex items-center gap-4">
            <AgentCharacter agentId="brand-negotiation-agent" side="brand" category="beauty" pose="greet" size={64} />
            <AgentCharacter agentId="creator-negotiation-agent" side="creator" category="beauty" pose="greet" size={64} />
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {state.messages.length ? state.messages.map((message) => (
            <MessageRow key={message.messageId} message={message} />
          )) : <Panel text="저장된 A2A message가 없습니다." />}
        </div>
      </section>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <h2 className="text-2xl">Agreement</h2>
        {state.agreement ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Agreement ID" value={state.agreement.agreementId} />
            <Stat label="termsHash" value={state.agreement.termsHash} />
            <Stat label="Status" value={state.agreement.status} />
            <Stat label="Amount" value={`${state.agreement.terms.compensation.baseAmountUsdc} USDC`} />
          </div>
        ) : (
          <div className="mt-4"><Panel text="아직 Agreement가 없습니다." /></div>
        )}
      </section>

      {state.agreement ? (
        <SettlementPanel agreement={state.agreement} initialBundle={state.escrowBundle} />
      ) : null}
    </Shell>
  );
}

function SettlementPanel({
  agreement,
  initialBundle,
}: {
  agreement: ApiAgreement;
  initialBundle: ApiAgreementEscrowBundle | null;
}) {
  const firstMilestone = agreement.terms.milestones[0]?.id ?? "m1";
  const [bundle, setBundle] = useState(initialBundle);
  const [evidenceUrl, setEvidenceUrl] = useState("https://social.example/post/with-brand-and-ad");
  const [evidence, setEvidence] = useState<ApiEvidence | null>(null);
  const [receipt, setReceipt] = useState<ApiReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const escrow = bundle?.escrow ?? null;

  async function reloadBundle() {
    const next = await new ProductApiClient().getAgreementEscrow(agreement.agreementId);
    setBundle(next);
  }

  async function lock() {
    setSaving(true);
    setError(null);
    try {
      const result = await new ProductApiClient().lockEscrow(agreement.agreementId);
      setReceipt(result.receipt);
      await reloadBundle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function submitAndVerifyEvidence() {
    setSaving(true);
    setError(null);
    try {
      const submitted = await new ProductApiClient().submitEvidence(agreement, firstMilestone, evidenceUrl);
      const verified = await new ProductApiClient().verifyEvidence(submitted.evidenceId);
      setEvidence(verified);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function release() {
    if (!escrow) return;
    setSaving(true);
    setError(null);
    try {
      const result = await new ProductApiClient().releaseMilestone(escrow.escrowId, firstMilestone);
      setReceipt(result.receipt);
      await reloadBundle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <h2 className="text-2xl">Escrow · Evidence · Settlement</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Escrow" value={escrow ? escrow.status : "not locked"} />
        <Stat label="Locked" value={escrow ? formatUsdcBaseUnits(escrow.lockedAmountBaseUnits) : "0 USDC"} />
        <Stat label="Released" value={escrow ? formatUsdcBaseUnits(escrow.releasedAmountBaseUnits) : "0 USDC"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={lock}
          disabled={saving || Boolean(escrow)}
          className="sketch-pill bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Escrow lock
        </button>
        <button
          type="button"
          onClick={submitAndVerifyEvidence}
          disabled={saving || !escrow || !evidenceUrl.trim()}
          className="sketch-pill bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Evidence 검증
        </button>
        <button
          type="button"
          onClick={release}
          disabled={saving || !escrow || evidence?.status !== "PASSED"}
          className="sketch-pill bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Milestone release
        </button>
      </div>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm text-muted">Evidence URL</span>
        <input
          value={evidenceUrl}
          onChange={(event) => setEvidenceUrl(event.target.value)}
          className="sketch-alt ink border border-border-subtle bg-background px-3 py-2 text-sm outline-none"
        />
      </label>
      {evidence ? <div className="mt-4"><Stat label="Evidence status" value={evidence.status} /></div> : null}
      {receipt ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stat label="Receipt" value={receipt.receiptId} />
          <Stat label="Signature" value={receipt.signature ?? "not confirmed"} />
          <Stat label="Explorer" value={receipt.explorerUrl ?? "not available"} />
          <Stat label="Receipt status" value={receipt.status} />
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-muted">{error}</p> : null}
    </section>
  );
}

function Shell({ negotiationId, children }: { negotiationId: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 py-8">
      <div>
        <p className="font-mono text-xs uppercase text-muted">Negotiation Detail</p>
        <h1 className="mt-1 break-words text-4xl">{negotiationId}</h1>
      </div>
      {children}
    </div>
  );
}

function MessageRow({ message }: { message: ApiNegotiationMessage }) {
  const role = message.role ?? "ROLE_AGENT";
  const payload = message.payload ?? message.a2aMessage ?? {};
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted">{role}</span>
        <span className="font-mono text-xs text-muted">#{message.sequence ?? "-"}</span>
      </div>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-muted">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 break-words font-mono text-sm">{value}</div>
    </div>
  );
}

function Panel({ text: value }: { text: string }) {
  return <div className="sketch-alt ink border border-border-subtle bg-background p-4 text-sm text-muted">{value}</div>;
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
