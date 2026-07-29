"use client";

import { useEffect, useState } from "react";
import { AgentCharacter } from "@/components/AgentCharacter";
import {
  ProductApiClient,
  type ApiAgreement,
  type ApiNegotiation,
  type ApiNegotiationMessage,
} from "@/product/apiClient";

type DetailState =
  | { status: "loading"; negotiation: null; messages: []; agreement: null; error: null }
  | {
      status: "ready";
      negotiation: ApiNegotiation;
      messages: ApiNegotiationMessage[];
      agreement: ApiAgreement | null;
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
      .then(([negotiation, messages, agreement]) => {
        if (!cancelled) setState({ status: "ready", negotiation, messages, agreement, error: null });
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
    </Shell>
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
