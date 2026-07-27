"use client";

/**
 * 내 매니저와의 1:1 채팅창 — 온보딩이 끝난 뒤 사용자가 머무는 유일한 화면
 * (docs/24_UX_JOURNEY_v1.md §3-3, §4-3).
 *
 * 사람에게 승인을 묻지 않는다. 매니저는 결과를 보고하고, 사용자는 지켜본다.
 * 에이전트끼리 주고받은 원문은 인용 버블을 펼쳐 실시간으로 흐른다.
 *
 * 하드 게이트(17 §2)는 전부 이 채팅 안 카드로 남는다:
 * 후보 3명 · 정책 차단 · 계약 해시 · 에스크로/정산 영수증 · 증빙 판정.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { agentTraits } from "@/lib/agentIdentity";
import { resetDeal, useBoard, writeBoard } from "@/product/dealBoard";
import { runDeal, verifyEvidence, type Round } from "@/product/journey";
import { BLOCKED_CATEGORY_LABEL } from "@/product/setupStore";
import type { Role } from "@/product/types";

const AGENT_ID: Record<Role, string> = {
  brand: "brand-agent-glow",
  creator: "creator-agent-mina",
};
const AGENT_NAME: Record<Role, string> = { brand: "Glow Agent", creator: "Mina Agent" };
const COUNTER_NAME: Record<Role, string> = { brand: "Mina Agent", creator: "Glow Agent" };

/** 대사 한 줄이 화면에 머무는 시간. 읽을 수 있을 만큼 느리게. */
const ROUND_MS = 2400;

// ---------------------------------------------------------------------------

function Bubble({
  from,
  children,
  time,
}: {
  from: "agent" | "me";
  children: React.ReactNode;
  time?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className={`flex flex-col gap-1 ${from === "me" ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[88%] border px-4 py-3 text-[15px] leading-relaxed ${
          from === "me"
            ? "sketch ink bg-surface-raised"
            : "sketch-alt ink bg-surface"
        }`}
      >
        {children}
      </div>
      {time ? <span className="font-mono text-[10px] text-muted">{time}</span> : null}
    </motion.div>
  );
}

function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sketch-alt ink mt-2 border border-border-subtle bg-surface-raised p-3.5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

/** 인용 버블 — 펼치면 에이전트끼리의 원문이 실시간으로 흐른다. */
function NegotiationThread({
  rounds,
  maxRounds,
  role,
  epoch,
}: {
  rounds: Round[];
  maxRounds: number;
  role: Role;
  epoch: number;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(true);
  const [shown, setShown] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open || shown >= rounds.length) return;
    timer.current = window.setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? 600 : reduced ? 300 : ROUND_MS,
    );
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [open, shown, rounds.length, reduced]);

  const visible = rounds.slice(0, shown);
  const live = shown < rounds.length;
  const next = rounds[shown];

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="sketch-pill ink flex w-full items-center justify-between border border-border-subtle bg-background px-3.5 py-2 text-left text-sm"
      >
        <span>▸ 에이전트끼리 대화 {open ? "접기" : "보기"}</span>
        <span className="font-mono text-xs text-muted">
          {live ? `${Math.max(1, visible.at(-1)?.round ?? 1)} / ${maxRounds}` : "완료"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col gap-2 border-l-2 border-border-subtle pl-3">
              {visible.map((r, i) => {
                if (r.speaker === "policy") {
                  return (
                    <motion.div
                      key={`${epoch}-${i}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="sketch-pill self-center border-2 border-dashed px-3 py-1 text-center text-[13px]"
                      style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
                    >
                      {r.line}
                    </motion.div>
                  );
                }
                const mine = r.speaker === role;
                return (
                  <motion.div
                    key={`${epoch}-${i}`}
                    initial={{ opacity: 0, x: mine ? 8 : -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`max-w-[92%] text-[14px] ${mine ? "self-end text-right" : "self-start"}`}
                  >
                    <div className="font-mono text-[10px] text-muted">
                      {mine ? AGENT_NAME[role] : COUNTER_NAME[role]}
                      {r.amountUsdc !== null ? ` · ${r.amountUsdc.toLocaleString()} USDC` : ""}
                    </div>
                    <div>{r.line}</div>
                    {r.note ? (
                      <div className="text-[12px] text-muted">{r.note}</div>
                    ) : null}
                  </motion.div>
                );
              })}

              {live && next ? (
                <div
                  className={`text-[12px] text-muted ${
                    next.speaker === role ? "self-end" : "self-start"
                  }`}
                >
                  ● {next.speaker === "policy" ? "정책 검사" : next.speaker === role ? AGENT_NAME[role] : COUNTER_NAME[role]} 입력 중…
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ManagerChat({ role }: { role: Role }) {
  const { board, ready } = useBoard();
  const traits = agentTraits(AGENT_ID[role], role, "beauty");
  const [evidence, setEvidence] = useState("");

  const creator = board.creator;
  const brand = board.brand;
  const bothReady = Boolean(creator && brand);

  const deal = useMemo(
    () => (creator && brand ? runDeal(creator, brand) : null),
    [creator, brand],
  );

  /**
   * 협상 대사가 다 흐른 뒤에야 결과 카드를 보여준다. 상태를 effect에서 바로
   * 세우면 렌더가 연쇄되므로, 재생이 끝나는 시각만 계산해 두고 그때 한 번
   * 깨운다.
   */
  const runKey = `${board.epoch}:${deal?.rounds.length ?? 0}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const settled = settledKey === runKey;
  useEffect(() => {
    if (!deal) return;
    const total = 600 + deal.rounds.length * ROUND_MS;
    const t = window.setTimeout(() => setSettledKey(runKey), total);
    return () => window.clearTimeout(t);
  }, [deal, runKey]);

  const evidenceResult = board.evidenceUrl ? verifyEvidence(board.evidenceUrl) : null;

  if (!ready) {
    return <div className="py-24 text-center text-muted">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-6">
      {/* 매니저 헤더 */}
      <div className="sketch ink flex items-center gap-3 border border-border-subtle bg-surface p-3">
        <AgentCharacter agentId={AGENT_ID[role]} side={role} category="beauty" pose="idle" size={56} />
        <div>
          <div className="text-xl leading-tight">{AGENT_NAME[role]}</div>
          <div className="text-sm text-muted">
            {role === "brand" ? "내 브랜드 매니저" : "내 크리에이터 매니저"}
          </div>
        </div>
        <span
          className="sketch-pill ml-auto border-2 px-2.5 py-1 text-[11px]"
          style={{ borderColor: traits.tint }}
        >
          {bothReady ? "일하는 중" : "대기 중"}
        </span>
      </div>

      {/* 인사 + 설정 요약 (내 것만 보여준다) */}
      <Bubble from="agent">
        안녕하세요. 이제 제가 대신 붙겠습니다.
        {role === "creator" && creator ? (
          <span className="mt-1 block text-sm text-muted">
            기준선 {creator.minUsdc.toLocaleString()} USDC, 안 하는 건{" "}
            {creator.blocked.map((b) => BLOCKED_CATEGORY_LABEL[b]).join(" · ") || "없음"} 기억했어요.
          </span>
        ) : null}
        {role === "brand" && brand ? (
          <span className="mt-1 block text-sm text-muted">
            {brand.productName} · 한 건에 {brand.maxPerDealUsdc.toLocaleString()} USDC까지는
            물어보지 않고 씁니다.
          </span>
        ) : null}
      </Bubble>

      {/* 상대가 아직 없을 때 */}
      {!bothReady ? (
        <Bubble from="agent">
          {role === "brand"
            ? "지금 조건에 맞는 크리에이터를 찾고 있어요."
            : "들어오는 제안을 기다리고 있어요."}
          <span className="mt-1 block text-sm text-muted">
            창을 하나 더 띄워 {role === "brand" ? "크리에이터" : "브랜드"}로 로그인하면 여기서
            바로 협상이 시작됩니다.
          </span>
        </Bubble>
      ) : null}

      {/* 후보 3명 — 하드 게이트 */}
      {deal ? (
        <Bubble from="agent">
          {role === "brand"
            ? "무드에 맞는 후보 3명 추렸어요."
            : `${brand?.productName ?? "브랜드"} 쪽에서 제안이 들어왔어요.`}
          {role === "brand" ? (
            <CardShell title="후보">
              <div className="flex flex-col gap-1.5">
                {deal.candidates.map((c) => (
                  <div
                    key={c.handle}
                    className={`flex items-baseline justify-between gap-2 text-sm ${
                      c.selected ? "" : "text-muted"
                    }`}
                  >
                    <span>
                      {c.handle}
                      {c.selected ? " ·  선택" : ""}
                    </span>
                    <span className="font-mono text-xs">적합도 {c.fit}</span>
                  </div>
                ))}
              </div>
            </CardShell>
          ) : null}
          <NegotiationThread
            key={`${board.epoch}-${deal.rounds.length}`}
            rounds={deal.rounds}
            maxRounds={deal.maxRounds}
            role={role}
            epoch={board.epoch}
          />
        </Bubble>
      ) : null}

      {/* 결과 */}
      {deal && settled && deal.blocked ? (
        <Bubble from="agent">
          <span style={{ color: "var(--negative)" }} className="font-semibold">
            이번 건은 접었습니다.
          </span>
          <span className="mt-1 block text-sm text-muted">
            {role === "brand"
              ? "상대 기준선이 제 딜당 한도를 넘어서, 제 권한으로는 서명할 수 없었어요. 한도를 올리시면 다시 붙어볼게요."
              : "브랜드 쪽 한도가 제 기준선보다 낮았어요. 기준선을 낮추면 다시 시도합니다."}
          </span>
          <button
            type="button"
            onClick={resetDeal}
            className="sketch-pill ink mt-3 border border-border-subtle bg-surface px-3 py-1.5 text-sm"
          >
            다시 붙여보기
          </button>
        </Bubble>
      ) : null}

      {deal && settled && !deal.blocked && deal.agreedUsdc !== null ? (
        <>
          <Bubble from="agent">
            {deal.agreedUsdc.toLocaleString()} USDC에 합의했고, 제 권한 안이라 바로
            서명했습니다.
            <CardShell title="계약">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm">릴스 1개 · 30/70 분할</span>
                <span className="font-mono">{deal.agreedUsdc.toLocaleString()} USDC</span>
              </div>
              <div className="mt-1 break-all font-mono text-[10px] text-muted">
                {deal.termsHash}
              </div>
            </CardShell>
          </Bubble>

          <Bubble from="agent">
            에스크로에 잠갔어요.
            <CardShell title="에스크로 · Solana devnet">
              <div className="flex flex-col gap-1">
                {deal.milestones.map((m) => (
                  <div key={m.label} className="flex items-baseline justify-between gap-2 text-sm">
                    <span>
                      {m.label} <span className="font-mono text-xs text-muted">{m.pct}%</span>
                    </span>
                    <span className="font-mono">{m.usdc.toLocaleString()} USDC</span>
                  </div>
                ))}
              </div>
              {/* 서명이 없으므로 explorer 링크를 만들지 않는다 (17 §3). */}
              <div className="mt-2 font-mono text-[10px] text-muted">
                SIMULATED · 서명 없음 — 실제 서명이 붙으면 explorer 링크가 생깁니다
              </div>
            </CardShell>
          </Bubble>

          {/* 증빙 — 크리에이터가 올리고, 두 창 모두 판정을 본다 */}
          <Bubble from="agent">
            {role === "creator"
              ? "게시물 올리고 링크만 주시면 나머지는 제가 합니다."
              : "크리에이터가 게시물을 올리면 제가 확인하고 잔금을 보냅니다."}
            {role === "creator" && !board.evidenceUrl ? (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="https://www.instagram.com/reel/..."
                  className="sketch-alt ink border border-border-subtle bg-background px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={!evidence.trim()}
                  onClick={() => writeBoard({ evidenceUrl: evidence.trim() })}
                  className="sketch-pill self-start bg-accent px-4 py-2 text-sm text-background disabled:opacity-40"
                >
                  링크 제출
                </button>
              </div>
            ) : null}
            {evidenceResult ? (
              <CardShell title="증빙 판정">
                <div className="flex flex-col gap-1">
                  {evidenceResult.checks.map((c) => (
                    <div key={c.label} className="flex items-baseline justify-between text-sm">
                      <span>{c.label}</span>
                      <span
                        className="font-mono text-xs"
                        style={{ color: c.ok ? "var(--positive)" : "var(--negative)" }}
                      >
                        {c.ok ? "통과" : "실패"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardShell>
            ) : null}
          </Bubble>

          {evidenceResult?.passed ? (
            <Bubble from="agent">
              확인됐습니다. 잔금{" "}
              <span className="font-mono">
                {deal.milestones[1].usdc.toLocaleString()} USDC
              </span>{" "}
              내보냈어요. 이번 건은 여기서 끝입니다.
              <button
                type="button"
                onClick={resetDeal}
                className="sketch-pill ink mt-3 border border-border-subtle bg-surface px-3 py-1.5 text-sm"
              >
                다시 붙여보기
              </button>
            </Bubble>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
