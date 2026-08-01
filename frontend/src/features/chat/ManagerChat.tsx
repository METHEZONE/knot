"use client";

/**
 * 내 매니저와의 채팅창 — 온보딩 뒤 사용자가 머무는 유일한 화면
 * (docs/24_UX_JOURNEY_v1.md §3-3, §4-3).
 *
 * 진짜 메신저처럼 만든다: 고정 헤더, 스크롤되는 메시지 영역, 아바타, 시간,
 * 타이핑 인디케이터, 새 메시지가 오면 자동 스크롤. 사람에게 승인을 묻지 않고
 * 매니저가 결과를 보고하며, 에이전트끼리의 원문은 인용 버블을 펼쳐서 본다.
 *
 * 하드 게이트(17 §2)는 전부 채팅 카드로 남는다: 후보 3명 · 정책 차단 ·
 * 계약 해시 · 에스크로/정산 · 증빙 판정.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { AgentAvatar } from "@/components/AgentAvatar";
import { agentTraits } from "@/lib/agentIdentity";
import { Money } from "@/features/chat/Money";
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

const clock = (offsetMin: number) => {
  const base = 9 * 60 + 12 + offsetMin;
  const h = Math.floor(base / 60) % 24;
  const m = base % 60;
  return `${h > 12 ? "오후" : "오전"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------

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

/** 매니저가 보내는 말풍선 — 아바타 + 이름 + 시간이 붙는 진짜 채팅 형태. */
function AgentMessage({
  role,
  at,
  children,
}: {
  role: Role;
  at: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      className="flex items-end gap-2"
    >
      <AgentAvatar agentId={AGENT_ID[role]} side={role} category="beauty" size="md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs text-muted">{AGENT_NAME[role]}</span>
        <div className="sketch-alt ink max-w-[92%] border border-border-subtle bg-surface px-4 py-3 text-[15px] leading-relaxed">
          {children}
        </div>
      </div>
      <span className="mb-1 shrink-0 font-mono text-[10px] text-muted">{clock(at)}</span>
    </motion.div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sketch ink mt-3 border-2 border-border-subtle bg-surface-raised p-4">
      <div className="mb-2.5 font-mono text-[10px] uppercase tracking-widest text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

/** 적합도 막대 — 숫자만 있으면 눈에 안 들어온다. */
function FitBar({ fit, dim }: { fit: number; dim?: boolean }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-background">
      <motion.div
        className="h-full rounded-full"
        style={{ background: dim ? "var(--muted)" : "var(--accent)" }}
        initial={{ width: 0 }}
        animate={{ width: `${fit}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

/** 에스크로 항아리 — 잠긴 돈과 풀린 돈이 눈에 보여야 한다. */
function EscrowVault({
  total,
  released,
}: {
  total: number;
  released: number;
}) {
  const pct = total > 0 ? Math.round((released / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 90 100" width="78" height="87" className="squig" aria-hidden="true">
        <defs>
          <clipPath id="vault-clip">
            <path d="M18 40 C6 54 8 88 45 92 C82 88 84 54 72 40 Z" />
          </clipPath>
        </defs>
        {/* 매듭으로 묶인 주머니 */}
        <path
          d="M18 40 C6 54 8 88 45 92 C82 88 84 54 72 40 Z"
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth="3"
        />
        <g clipPath="url(#vault-clip)">
          <motion.rect
            x="0"
            width="90"
            fill="var(--positive)"
            opacity="0.25"
            initial={{ y: 100, height: 0 }}
            animate={{ y: 100 - pct, height: pct }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </g>
        <path
          d="M22 40 C34 22 48 44 58 30 C66 20 76 36 74 40"
          fill="none"
          stroke="var(--border)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted">에스크로에 잠긴 금액</span>
        <Money usdc={total} size="lg" />
        <span className="text-xs text-muted">
          {released > 0 ? `${pct}% 지급됨` : "아직 지급 전"}
        </span>
      </div>
    </div>
  );
}

/** 인용 버블 — 펼치면 에이전트끼리의 원문이 실시간으로 흐른다. */
function NegotiationThread({
  rounds,
  maxRounds,
  role,
}: {
  rounds: Round[];
  maxRounds: number;
  role: Role;
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
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="sketch-pill ink flex w-full items-center justify-between gap-2 border-2 border-border-subtle bg-background px-4 py-2.5 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>{open ? "▾" : "▸"}</span>
          에이전트끼리 대화
        </span>
        <span className="flex items-center gap-2 font-mono text-xs text-muted">
          {live ? (
            <>
              <TypingDots /> {visible.at(-1)?.round ?? 1} / {maxRounds}
            </>
          ) : (
            "완료"
          )}
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
            <div className="mt-3 flex flex-col gap-3 rounded-lg bg-background/60 p-3">
              {visible.map((r, i) => {
                if (r.speaker === "policy") {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 1.6, rotate: 8 }}
                      animate={{ opacity: 1, scale: 1, rotate: -2 }}
                      transition={{ type: "spring", stiffness: 260, damping: 14 }}
                      className="sketch-pill self-center border-2 border-dashed px-4 py-1.5 text-center text-[13px] font-semibold"
                      style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
                    >
                      {r.line}
                    </motion.div>
                  );
                }
                const mine = r.speaker === role;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: mine ? 14 : -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex max-w-[94%] items-end gap-2 ${
                      mine ? "flex-row-reverse self-end" : "self-start"
                    }`}
                  >
                    <AgentAvatar
                      agentId={mine ? AGENT_ID[role] : AGENT_ID[role === "brand" ? "creator" : "brand"]}
                      side={mine ? role : role === "brand" ? "creator" : "brand"}
                      category="beauty"
                      size="sm"
                    />
                    <div className={mine ? "text-right" : ""}>
                      <div className="mb-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted">
                        <span>{mine ? AGENT_NAME[role] : COUNTER_NAME[role]}</span>
                        {r.amountUsdc !== null ? (
                          <span className="sketch-pill border border-border-subtle bg-surface-raised px-1.5">
                            {r.amountUsdc.toLocaleString()} USDC
                          </span>
                        ) : null}
                      </div>
                      <div
                        className={`sketch-alt ink border border-border-subtle px-3 py-2 text-[14px] ${
                          mine ? "bg-surface-raised" : "bg-surface"
                        }`}
                      >
                        {r.line}
                      </div>
                      {r.note ? (
                        <div className="mt-0.5 text-[12px] text-muted">{r.note}</div>
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}

              {live && next ? (
                <div
                  className={`flex items-center gap-2 text-[12px] text-muted ${
                    next.speaker === role ? "self-end" : "self-start"
                  }`}
                >
                  <TypingDots />
                  {next.speaker === "policy"
                    ? "정책 검사 중"
                    : `${next.speaker === role ? AGENT_NAME[role] : COUNTER_NAME[role]} 입력 중`}
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
  const endRef = useRef<HTMLDivElement | null>(null);

  const creator = board.creator;
  const brand = board.brand;
  const bothReady = Boolean(creator && brand);

  const deal = useMemo(
    () => (creator && brand ? runDeal(creator, brand) : null),
    [creator, brand],
  );

  const runKey = `${board.epoch}:${deal?.rounds.length ?? 0}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const settled = settledKey === runKey;
  useEffect(() => {
    if (!deal) return;
    const t = window.setTimeout(
      () => setSettledKey(runKey),
      600 + deal.rounds.length * ROUND_MS,
    );
    return () => window.clearTimeout(t);
  }, [deal, runKey]);

  const evidenceResult = board.evidenceUrl ? verifyEvidence(board.evidenceUrl) : null;
  const paid = evidenceResult?.passed ? (deal?.milestones[1].usdc ?? 0) : 0;

  // 새 내용이 붙으면 아래로 따라간다 — 메신저의 기본 동작.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [settled, board.evidenceUrl, bothReady]);

  if (!ready) {
    return <div className="py-24 text-center text-muted">불러오는 중…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      {/* 고정 헤더 — 대화 상대가 항상 보인다 */}
      <div className="sticky top-14 z-30 -mx-4 mb-3 border-b border-border-subtle bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <AgentCharacter
            agentId={AGENT_ID[role]}
            side={role}
            category="beauty"
            pose={bothReady && !settled ? "walk" : "idle"}
            size={54}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xl leading-tight">{AGENT_NAME[role]}</div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {bothReady && !settled ? (
                <>
                  <TypingDots /> 협상하는 중
                </>
              ) : bothReady ? (
                "대화 완료"
              ) : (
                "상대를 기다리는 중"
              )}
            </div>
          </div>
          <Link
            href={`/${role}/settings`}
            className="sketch-pill ink shrink-0 border border-border-subtle bg-surface px-3 py-1.5 text-xs text-muted"
          >
            설정
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-10">
        <AgentMessage role={role} at={0}>
          안녕하세요. 이제 제가 대신 붙겠습니다.
          {role === "creator" && creator ? (
            <span className="mt-1.5 block text-sm text-muted">
              기준선 <Money usdc={creator.minUsdc} size="sm" />, 안 하는 건{" "}
              {creator.blocked.map((b) => BLOCKED_CATEGORY_LABEL[b]).join(" · ") || "없음"}{" "}
              기억했어요.
            </span>
          ) : null}
          {role === "brand" && brand ? (
            <span className="mt-1.5 block text-sm text-muted">
              {brand.productName} · 한 건에 <Money usdc={brand.maxPerDealUsdc} size="sm" />
              까지는 물어보지 않고 씁니다.
            </span>
          ) : null}
        </AgentMessage>

        {!bothReady ? (
          <AgentMessage role={role} at={1}>
            {role === "brand"
              ? "지금 조건에 맞는 크리에이터를 찾고 있어요."
              : "들어오는 제안을 기다리고 있어요."}
            <span className="mt-1.5 block text-sm text-muted">
              창을 하나 더 띄워 {role === "brand" ? "크리에이터" : "브랜드"}로 로그인하면
              여기서 바로 협상이 시작됩니다.
            </span>
          </AgentMessage>
        ) : null}

        {deal ? (
          <AgentMessage role={role} at={2}>
            {role === "brand"
              ? "무드에 맞는 후보 3명 추렸어요."
              : `${brand?.productName ?? "브랜드"} 쪽에서 제안이 들어왔어요.`}

            {role === "brand" ? (
              <Card title="후보">
                <div className="flex flex-col gap-3">
                  {deal.candidates.map((c) => (
                    <div key={c.handle} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className={c.selected ? "font-semibold" : "text-muted"}>
                          {c.handle}
                          {c.selected ? " · 선택됨" : ""}
                        </span>
                        <span className="font-mono text-xs">{c.fit}</span>
                      </div>
                      <FitBar fit={c.fit} dim={!c.selected} />
                      <span className="text-xs text-muted">{c.reason}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <NegotiationThread
              key={runKey}
              rounds={deal.rounds}
              maxRounds={deal.maxRounds}
              role={role}
            />
          </AgentMessage>
        ) : null}

        {deal && settled && deal.blocked ? (
          <AgentMessage role={role} at={5}>
            <span style={{ color: "var(--negative)" }} className="font-semibold">
              이번 건은 접었습니다.
            </span>
            <span className="mt-1.5 block text-sm text-muted">
              {role === "brand"
                ? "상대 기준선이 제 딜당 한도를 넘어서, 제 권한으로는 서명할 수 없었어요."
                : "브랜드 쪽 한도가 제 기준선보다 낮았어요."}
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/${role}/settings`}
                className="sketch-pill bg-accent px-4 py-2 text-sm text-background"
              >
                {role === "brand" ? "한도 올리기" : "기준선 낮추기"}
              </Link>
              <button
                type="button"
                onClick={resetDeal}
                className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
              >
                다시 붙여보기
              </button>
            </div>
          </AgentMessage>
        ) : null}

        {deal && settled && !deal.blocked && deal.agreedUsdc !== null ? (
          <>
            <AgentMessage role={role} at={5}>
              합의했고, 제 권한 안이라 바로 서명했습니다.
              <Card title="계약">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm">릴스 1개 · 30/70 분할</span>
                  <Money usdc={deal.agreedUsdc} size="lg" />
                </div>
                <div className="mt-2 break-all font-mono text-[10px] text-muted">
                  {deal.termsHash}
                </div>
              </Card>
            </AgentMessage>

            <AgentMessage role={role} at={6}>
              에스크로에 잠갔어요.
              <Card title="에스크로 · Solana testnet">
                <EscrowVault total={deal.agreedUsdc} released={paid} />
                <div className="mt-4 flex flex-col gap-2.5">
                  {deal.milestones.map((m, i) => {
                    const done = i === 0 || evidenceResult?.passed;
                    return (
                      <div key={m.label} className="flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="flex items-center gap-1.5">
                            <span
                              aria-hidden
                              style={{ color: done ? "var(--positive)" : "var(--muted)" }}
                            >
                              {done ? "●" : "○"}
                            </span>
                            {m.label}
                            <span className="font-mono text-xs text-muted">{m.pct}%</span>
                          </span>
                          <Money usdc={m.usdc} size="sm" />
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: done ? "var(--positive)" : "var(--border)",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: done ? "100%" : "8%" }}
                            transition={{ duration: 0.7 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 font-mono text-[10px] text-muted">
                  SIMULATED · 서명 없음 — 실제 서명이 붙으면 explorer 링크가 생깁니다
                </div>
              </Card>
            </AgentMessage>

            <AgentMessage role={role} at={7}>
              {role === "creator"
                ? "게시물 올리고 링크만 주시면 나머지는 제가 합니다."
                : "크리에이터가 게시물을 올리면 제가 확인하고 잔금을 보냅니다."}

              {role === "creator" && !board.evidenceUrl ? (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                    placeholder="https://www.instagram.com/reel/..."
                    className="sketch-alt ink border border-border-subtle bg-background px-3 py-2.5 text-sm outline-none"
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
                <Card title="증빙 판정">
                  <div className="flex flex-col gap-2">
                    {evidenceResult.checks.map((c) => (
                      <div
                        key={c.label}
                        className="flex items-baseline justify-between gap-2 text-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            aria-hidden
                            style={{ color: c.ok ? "var(--positive)" : "var(--negative)" }}
                          >
                            {c.ok ? "✓" : "✕"}
                          </span>
                          {c.label}
                        </span>
                        <span
                          className="font-mono text-xs"
                          style={{ color: c.ok ? "var(--positive)" : "var(--negative)" }}
                        >
                          {c.ok ? "통과" : "실패"}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}
            </AgentMessage>

            {evidenceResult?.passed ? (
              <AgentMessage role={role} at={9}>
                확인됐습니다. 잔금 <Money usdc={deal.milestones[1].usdc} size="sm" /> 내보냈어요.
                이번 건은 여기서 끝입니다.
                <button
                  type="button"
                  onClick={resetDeal}
                  className="sketch-pill ink mt-3 border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
                >
                  다시 붙여보기
                </button>
              </AgentMessage>
            ) : null}
          </>
        ) : null}

        <div ref={endRef} />
      </div>

      <span className="sr-only">{traits.name}</span>
    </div>
  );
}
