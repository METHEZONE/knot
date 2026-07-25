"use client";

/**
 * 데모 스테이지 — 한 화면에 두 유저.
 *
 * 왼쪽은 크리에이터가 보는 화면, 오른쪽은 브랜드가 보는 화면이다. 각자
 * 자기 매니저를 부화시키고 나면, 두 에이전트가 서로 협상하는 과정이 양쪽에
 * 동시에 보인다 — 같은 메시지가 한쪽에서는 "보냄", 다른 쪽에서는 "받음"으로
 * 뜬다. 이게 이 제품의 유일한 와우포인트라서, 이 화면에는 그것 말고 아무것도
 * 두지 않았다.
 *
 * 숫자는 전부 `dealSim`의 결정론적 계산 결과다. 사람이 정하는 값은 딱 둘 —
 * 크리에이터의 최저 단가와 브랜드의 딜당 한도 — 이고, 그 둘만으로 합의될지
 * 정책에 막혀 결렬될지가 갈린다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { agentTraits } from "@/lib/agentIdentity";
import {
  simulateDeal,
  type BrandSetup,
  type CreatorSetup,
  type DealResult,
  type DealStep,
} from "@/lib/dealSim";

const CREATOR_AGENT_ID = "creator-agent-001";
const BRAND_AGENT_ID = "brand-agent-001";
const CATEGORY = "beauty";

type Phase = "setup" | "ready" | "deal" | "done";
type Side = "creator" | "brand";

/** 한 스텝이 화면에 머무는 시간. 읽을 수 있을 만큼 느리게. */
const STEP_MS = 2600;

// ---------------------------------------------------------------------------
// 작은 조각들
// ---------------------------------------------------------------------------

/**
 * 이 값은 부화 뒤에도 계속 만질 수 있게 남겨둔다 — 숫자를 바꿔서 다시 붙이면
 * 합의가 결렬로 뒤집히는 걸 직접 볼 수 있어야 자율성의 경계가 설명된다.
 */
function NumberField({
  label,
  hint,
  value,
  onChange,
  suffix,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  suffix: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <input
          type="number"
          min={10}
          step={10}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="sketch-alt ink w-32 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-lg outline-none focus:bg-surface disabled:opacity-50"
        />
        <span className="font-mono text-sm text-muted">{suffix}</span>
      </span>
      <span className="text-xs text-muted">{hint}</span>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sketch-alt ink border border-border-subtle bg-surface-raised px-3 py-2 outline-none focus:bg-surface"
      />
    </label>
  );
}

/** 한 유저 화면에 뜨는 말풍선. 내가 보낸 건지 받은 건지로 모양이 갈린다. */
function Bubble({ step, mine }: { step: DealStep; mine: boolean }) {
  if (step.kind === "block") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="sketch-pill self-center border-2 border-dashed px-3 py-1.5 text-center text-sm"
        style={{ borderColor: "var(--negative)", color: "var(--negative)" }}
      >
        {step.line}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      className={`max-w-[92%] border px-3.5 py-2.5 text-[15px] leading-snug ${
        mine
          ? "sketch ink self-end bg-surface-raised"
          : "sketch-alt ink self-start bg-surface"
      }`}
    >
      <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-wide text-muted">
        {mine ? "내 매니저" : "상대 매니저"}
        {step.amountUsdc !== null ? ` · ${step.amountUsdc.toLocaleString()} USDC` : ""}
      </span>
      {step.line}
      {step.reason ? (
        <span className="mt-1 block text-xs text-muted">{step.reason}</span>
      ) : null}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 한쪽 화면
// ---------------------------------------------------------------------------

function SidePanel({
  side,
  title,
  hatched,
  agentId,
  steps,
  children,
}: {
  side: Side;
  title: string;
  hatched: boolean;
  agentId: string;
  steps: DealStep[];
  children?: React.ReactNode;
}) {
  const traits = agentTraits(agentId, side === "brand" ? "brand" : "creator", CATEGORY);

  return (
    <section className="sketch ink flex min-w-0 flex-1 flex-col gap-4 border border-border-subtle bg-surface p-5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-xl">{title}</h2>
        {hatched ? (
          <span className="font-mono text-[11px] text-muted">매니저 {traits.name}</span>
        ) : null}
      </header>

      <div className="flex items-center justify-center">
        {hatched ? (
          <AgentCharacter
            agentId={agentId}
            side={side === "brand" ? "brand" : "creator"}
            category={CATEGORY}
            pose={steps.length > 0 ? "greet" : "idle"}
            size={104}
          />
        ) : (
          <svg viewBox="0 0 64 84" width="74" height="97" className="squig" aria-hidden="true">
            <path
              d="M32 4 C46 4 58 26 58 48 C58 68 46 80 32 80 C18 80 6 68 6 48 C6 26 18 4 32 4 Z"
              fill="var(--surface-raised)"
              stroke="var(--border)"
              strokeWidth="2.5"
            />
          </svg>
        )}
      </div>

      {children}

      {steps.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {steps.map((step, i) => (
              <Bubble
                key={`${step.round}-${step.kind}-${i}`}
                step={step}
                mine={step.from === side}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 스테이지
// ---------------------------------------------------------------------------

export function SplitStage() {
  const reduced = useReducedMotion();

  const [creator, setCreator] = useState<CreatorSetup>({
    handle: "@demobeauty",
    minBaseUsdc: 650,
  });
  const [brand, setBrand] = useState<BrandSetup>({
    name: "데모 스킨케어",
    maxPerDealUsdc: 800,
  });

  const [creatorHatched, setCreatorHatched] = useState(false);
  const [brandHatched, setBrandHatched] = useState(false);
  const [result, setResult] = useState<DealResult | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<number | null>(null);

  /**
   * phase는 저장하지 않고 파생시킨다. 저장하면 "둘 다 부화했으면 ready로",
   * "스텝을 다 보여줬으면 done으로" 같은 전이를 effect 안에서 동기적으로
   * setState해야 하는데, 그게 렌더 연쇄의 원인이다. 파생값으로 두면 전이가
   * 그냥 계산이 된다.
   */
  const phase: Phase = !(creatorHatched && brandHatched)
    ? "setup"
    : result === null
      ? "ready"
      : shown < result.steps.length
        ? "deal"
        : "done";

  const startDeal = useCallback(() => {
    setResult(simulateDeal(creator, brand));
    setShown(0);
  }, [creator, brand]);

  // 스텝을 하나씩 드러낸다. setState는 타이머 콜백 안에서만 일어난다.
  useEffect(() => {
    if (!result || shown >= result.steps.length) return;
    timer.current = window.setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? 500 : reduced ? 400 : STEP_MS,
    );
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [shown, result, reduced]);

  const visibleSteps = useMemo(
    () => (result ? result.steps.slice(0, shown) : []),
    [result, shown],
  );
  const current = visibleSteps[visibleSteps.length - 1];
  const agreed = phase === "done" && result?.agreedUsdc !== null;
  const blocked = phase === "done" && result?.agreedUsdc === null;

  const reset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setResult(null);
    setShown(0);
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="flex flex-col items-center gap-1.5 text-center">
        <h1 className="text-3xl sm:text-4xl">두 사람이 각자 매니저를 붙였습니다</h1>
        <p className="max-w-xl text-[15px] text-muted">
          왼쪽은 크리에이터 화면, 오른쪽은 브랜드 화면. 두 매니저가 서로 협상하는
          걸 그냥 지켜보면 됩니다.
        </p>
      </header>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row">
        <SidePanel
          side="creator"
          title={`크리에이터 ${creator.handle}`}
          hatched={creatorHatched}
          agentId={CREATOR_AGENT_ID}
          steps={visibleSteps}
        >
          <div className="flex flex-col gap-3">
            {!creatorHatched ? (
              <TextField
                label="인스타 핸들"
                value={creator.handle}
                onChange={(handle) => setCreator((c) => ({ ...c, handle }))}
              />
            ) : null}
            <NumberField
              label="최저 단가"
              suffix="USDC"
              hint="이 밑으로 들어오는 제안은 매니저가 알아서 거절해요."
              value={creator.minBaseUsdc}
              disabled={phase === "deal"}
              onChange={(minBaseUsdc) => setCreator((c) => ({ ...c, minBaseUsdc }))}
            />
            {!creatorHatched ? (
              <button
                type="button"
                onClick={() => setCreatorHatched(true)}
                className="sketch-pill mt-1 bg-accent px-5 py-2.5 text-[15px] text-background"
              >
                내 매니저 부화시키기
              </button>
            ) : null}
          </div>
        </SidePanel>

        {/* 가운데 실 — 합의되면 매듭이 된다 */}
        <div className="flex shrink-0 items-center justify-center gap-2 lg:w-32 lg:flex-col">
          <svg viewBox="0 0 100 140" width="100" height="140" className="squig-slow" aria-hidden="true">
            {agreed ? (
              // 합의되면 실이 매듭으로 묶인다.
              <path
                d="M2 70 C24 68 34 40 52 52 C70 64 44 92 30 76 C16 60 52 46 98 66"
                fill="none"
                stroke="var(--border)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M2 70 H98"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="8 9"
              />
            )}
          </svg>
          {phase === "deal" && current ? (
            <span className="font-mono text-[11px] text-muted">
              {current.round} / {result?.maxRounds}
            </span>
          ) : null}
        </div>

        <SidePanel
          side="brand"
          title={`브랜드 ${brand.name}`}
          hatched={brandHatched}
          agentId={BRAND_AGENT_ID}
          steps={visibleSteps}
        >
          <div className="flex flex-col gap-3">
            {!brandHatched ? (
              <TextField
                label="브랜드 이름"
                value={brand.name}
                onChange={(name) => setBrand((b) => ({ ...b, name }))}
              />
            ) : null}
            <NumberField
              label="딜당 한도"
              suffix="USDC"
              hint={`매니저가 한 건에 ${brand.maxPerDealUsdc.toLocaleString()} USDC까지는 사람 승인 없이 씁니다.`}
              value={brand.maxPerDealUsdc}
              disabled={phase === "deal"}
              onChange={(maxPerDealUsdc) => setBrand((b) => ({ ...b, maxPerDealUsdc }))}
            />
            {!brandHatched ? (
              <button
                type="button"
                onClick={() => setBrandHatched(true)}
                className="sketch-pill mt-1 bg-accent px-5 py-2.5 text-[15px] text-background"
              >
                내 매니저 부화시키기
              </button>
            ) : null}
          </div>
        </SidePanel>
      </div>

      {/* 아래쪽: 시작 버튼 / 결과 */}
      <div className="flex flex-col items-center gap-3 text-center">
        {phase === "ready" ? (
          <>
            <button
              type="button"
              onClick={startDeal}
              className="sketch-pill bg-accent px-7 py-3 text-lg text-background"
            >
              딜 붙여보기
            </button>
            <p className="text-sm text-muted">
              사람은 여기서 손을 뗍니다. 이후 협상·계약·정산은 매니저들이 합니다.
            </p>
          </>
        ) : null}

        {agreed && result ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="sketch ink flex w-full max-w-xl flex-col gap-3 border border-border-subtle bg-surface-raised p-5"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-2xl">매듭 지었습니다</h2>
              <span className="font-mono text-lg">
                {result.agreedUsdc?.toLocaleString()} USDC
              </span>
            </div>
            <p className="text-left text-sm text-muted">
              합의되는 순간 매니저가 클릭 없이 USDC를 에스크로에 잠갔어요. 단계별로
              이렇게 풀립니다.
            </p>
            <ul className="flex flex-col gap-1.5">
              {result.milestones.map((m) => (
                <li
                  key={m.label}
                  className="flex items-baseline justify-between gap-3 text-[15px]"
                >
                  <span>
                    {m.label}{" "}
                    <span className="font-mono text-xs text-muted">{m.pct}%</span>
                  </span>
                  <span className="font-mono">{m.usdc.toLocaleString()} USDC</span>
                </li>
              ))}
            </ul>
            <p className="text-left font-mono text-[11px] text-muted">
              Solana devnet · 시뮬레이션 영수증 (서명 없음)
            </p>
            <button
              type="button"
              onClick={reset}
              className="sketch-pill ink self-start border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
            >
              다시 붙여보기
            </button>
          </motion.div>
        ) : null}

        {blocked ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="sketch ink flex w-full max-w-xl flex-col gap-2 border-2 bg-surface p-5"
            style={{ borderColor: "var(--negative)" }}
          >
            <h2 className="text-2xl" style={{ color: "var(--negative)" }}>
              한도에 막혀 결렬됐어요
            </h2>
            <p className="text-left text-sm text-muted">
              크리에이터 최저 단가 {creator.minBaseUsdc.toLocaleString()} USDC가 브랜드
              딜당 한도 {brand.maxPerDealUsdc.toLocaleString()} USDC를 넘습니다. 사람이
              한도를 올려주지 않으면 매니저는 서명하지 않아요 — 이게 자율성의 경계입니다.
            </p>
            <button
              type="button"
              onClick={reset}
              className="sketch-pill ink self-start border border-border-subtle bg-surface px-4 py-2 text-sm text-muted"
            >
              숫자 바꿔서 다시
            </button>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
