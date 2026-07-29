"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentCharacter } from "@/components/AgentCharacter";
import {
  ProductApiClient,
  type ApiNegotiationMessage,
  type BrandDashboard,
  type CreatorDashboard,
} from "@/product/apiClient";
import type { Role } from "@/product/types";

type LoadState =
  | { status: "loading"; dashboard: null; messages: ApiNegotiationMessage[]; error: null }
  | { status: "ready"; dashboard: BrandDashboard | CreatorDashboard; messages: ApiNegotiationMessage[]; error: null }
  | { status: "error"; dashboard: null; messages: ApiNegotiationMessage[]; error: string };

const AGENT_NAME: Record<Role, string> = { brand: "Glow Agent", creator: "Mina Agent" };
const OTHER_AGENT_NAME: Record<Role, string> = { brand: "Mina Agent", creator: "Glow Agent" };

export function AgentConversation({ role }: { role: Role }) {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    dashboard: null,
    messages: [],
    error: null,
  });

  const load = useCallback(async () => {
    setState({ status: "loading", dashboard: null, messages: [], error: null });
    const client = new ProductApiClient();
    try {
      const dashboard = role === "brand" ? await client.getBrandDashboard() : await client.getCreatorDashboard();
      const negotiationId = findNegotiationId(dashboard);
      const messages = negotiationId ? await client.listNegotiationMessages(negotiationId).catch(() => []) : [];
      setState({ status: "ready", dashboard, messages, error: null });
    } catch (caught) {
      setState({
        status: "error",
        dashboard: null,
        messages: [],
        error: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }, [role]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") {
    return <Frame role={role}><Bubble side={role}>에이전트 상태를 불러오는 중입니다.</Bubble></Frame>;
  }

  if (state.status === "error") {
    return (
      <Frame role={role}>
        <Bubble side={role}>Product API 연결을 확인해야 합니다.</Bubble>
        <SystemCard>{state.error}</SystemCard>
      </Frame>
    );
  }

  const dashboard = state.dashboard;
  const negotiationId = findNegotiationId(dashboard);
  const resultCount = role === "brand"
    ? (dashboard as BrandDashboard).activePromotions.length
    : [
        ...(dashboard as CreatorDashboard).offers,
        ...(dashboard as CreatorDashboard).activeSponsorships,
      ].length;
  const accepting = role === "creator"
    ? (dashboard as CreatorDashboard).creator.acceptingOffers === true ||
      (dashboard as CreatorDashboard).creator.receivingOffers === true
    : true;

  return (
    <Frame role={role}>
      <Bubble side={role} delay={0}>
        에이전트가 켜졌습니다. 지금부터 조건 확인, 후보 탐색, 협상 상태를 이 채팅방에 모읍니다.
      </Bubble>
      <Bubble side={opposite(role)} delay={0.08}>
        {negotiationId ? "A2A 협상 내역을 불러왔습니다." : "아직 진행 중인 A2A 협상은 없습니다."}
      </Bubble>
      <Bubble side={role} delay={0.16}>
        {role === "creator" && !accepting
          ? "현재 신규 제안 수신이 꺼져 있습니다. 대시보드에서 에이전트 켜기를 다시 눌러 수신을 켤 수 있습니다."
          : `확인 가능한 결과 ${resultCount}건을 정리했습니다.`}
      </Bubble>

      {state.messages.length ? (
        <section className="mt-3 grid gap-3">
          <div className="font-mono text-xs uppercase text-muted">A2A live thread</div>
          {state.messages.map((message, index) => (
            <MessageBubble
              key={message.messageId || `${message.taskId}-${index}`}
              role={role}
              message={message}
              delay={0.24 + index * 0.08}
            />
          ))}
        </section>
      ) : (
        <SystemCard>
          {role === "brand"
            ? "협상 대화를 보려면 Promotion을 만들고 후보 확인 후 협상 시작을 누르세요."
            : "Brand Agent가 제안을 시작하면 이 화면에 Mina Agent와 Glow Agent의 대화가 표시됩니다."}
        </SystemCard>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {role === "brand" ? (
          <Link href="/brand/promotions/new" className="sketch-pill bg-accent px-4 py-2 text-sm text-background">
            협찬 제안하기
          </Link>
        ) : null}
        {negotiationId ? (
          <Link href={`/negotiations/${negotiationId}`} className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm">
            에이전트 결과 상세보기
          </Link>
        ) : null}
        <Link href={`/${role}`} className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted">
          대시보드
        </Link>
      </div>
    </Frame>
  );
}

function Frame({ role, children }: { role: Role; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col py-6">
      <header className="sticky top-14 z-30 -mx-4 border-b border-border-subtle bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <AgentCharacter agentId={`${role}-agent-live`} side={role} category="beauty" pose="walk" size={58} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-none">{AGENT_NAME[role]}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted">
              <TypingDots />
              에이전트 대화방
            </div>
          </div>
        </div>
      </header>
      <main className="grid gap-4 py-5">{children}</main>
    </div>
  );
}

function Bubble({ side, delay = 0, children }: { side: Role; delay?: number; children: React.ReactNode }) {
  const mine = side === "brand";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      className={`flex max-w-[92%] items-end gap-2 ${mine ? "self-end flex-row-reverse" : "self-start"}`}
    >
      <AgentAvatar agentId={`${side}-bubble-agent`} side={side} category="beauty" size="md" />
      <div className={mine ? "text-right" : ""}>
        <div className="mb-1 text-xs text-muted">{AGENT_NAME[side]}</div>
        <div className={`sketch-alt ink border border-border-subtle px-4 py-3 text-sm leading-relaxed ${mine ? "bg-surface-raised" : "bg-surface"}`}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}

function MessageBubble({
  role,
  message,
  delay,
}: {
  role: Role;
  message: ApiNegotiationMessage;
  delay: number;
}) {
  const speaker = String(message.role ?? "");
  const side = speaker.includes("BRAND") || speaker === "ROLE_USER" ? "brand" : "creator";
  const payload = message.payload ?? {};
  const line = messageLine(payload) || `${OTHER_AGENT_NAME[role]}와 조건을 교환했습니다.`;
  return <Bubble side={side} delay={delay}>{line}</Bubble>;
}

function SystemCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="sketch ink border border-border-subtle bg-surface p-4 text-sm text-muted">
      {children}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="inline-block h-1.5 w-1.5 rounded-full bg-muted"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.18 }}
        />
      ))}
    </span>
  );
}

function findNegotiationId(dashboard: BrandDashboard | CreatorDashboard) {
  const pools = "offers" in dashboard
    ? [dashboard.offers, dashboard.activeSponsorships, dashboard.recentAgentActivity]
    : [dashboard.activePromotions, dashboard.recentAgentActivity, dashboard.contractedCreators];
  for (const pool of pools) {
    for (const item of pool) {
      const direct = text((item as Record<string, unknown>).negotiationId);
      if (direct) return direct;
      const data = (item as Record<string, unknown>).data;
      if (data && typeof data === "object") {
        const nested = text((data as Record<string, unknown>).negotiationId);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function messageLine(payload: Record<string, unknown>) {
  return (
    text(payload.rationale) ||
    text(payload.message) ||
    text(payload.summary) ||
    text(payload.decisionType) ||
    text(payload.type)
  );
}

function opposite(role: Role): Role {
  return role === "brand" ? "creator" : "brand";
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
