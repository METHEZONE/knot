"use client";

/**
 * 그래프 뷰 (실험) — knot을 노드 그래프로 조작하는 컨셉 비교용 화면.
 *
 * - 노드를 끌어서 자유 배치
 * - 크리에이터를 브랜드 근처로 끌면 매듭이 묶임 (한도 초과면 정책이 튕겨냄)
 * - 매듭(가운데 원)을 클릭하면 싹둑 — 연결 해제
 * 데모 본편과 독립된 로컬 상태로 돈다.
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "@/demo/demo.css";
import { AUTOPILOT_CREATOR, CREATORS } from "@/demo/engine/script";
import { Yarn } from "@/demo/character/Yarn";
import { Face } from "@/demo/ui/bits";
import { Badge } from "@/demo/ui/primitives";

type Node = {
  id: string;
  handle: string;
  color: string;
  photo: string;
  niche: string;
  fit: number;
  amountUsdc: number;
  /** 딜당 한도(450)를 넘는 요구 — 묶으려 하면 정책이 차단 */
  overCap?: boolean;
};

const BRAND = { name: "무드빔", color: "#d9a441", logo: "/demo/moodbeam.svg", capUsdc: 450 };

const NODES: Node[] = [
  ...CREATORS.map((c) => ({
    id: c.id,
    handle: c.handle,
    color: c.color,
    photo: c.photo,
    niche: c.niche,
    fit: c.fit,
    amountUsdc: c.id === "ssin" ? 400 : c.id === "geekble" ? 260 : 800,
    overCap: c.id === "risabae",
  })),
  {
    id: AUTOPILOT_CREATOR.id,
    handle: AUTOPILOT_CREATOR.handle,
    color: AUTOPILOT_CREATOR.color,
    photo: AUTOPILOT_CREATOR.photo,
    niche: AUTOPILOT_CREATOR.niche,
    fit: AUTOPILOT_CREATOR.fit,
    amountUsdc: AUTOPILOT_CREATOR.amountUsdc,
  },
];

function KnotGlyph({ size = 15, color = "#18181b" }: { size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M4 9c5-4 9 10 16 6" />
      <path d="M4 15c5 4 9-10 16-6" />
    </svg>
  );
}

type Pos = { x: number; y: number };
const TIE_RADIUS = 210;

function edgePath(a: Pos, b: Pos) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + 26; // 실이 살짝 처지는 느낌
  return { d: `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`, mid: { x: mx, y: my / 2 + (a.y + b.y) / 4 } };
}

export default function GraphPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Record<string, Pos> | null>(null);
  const [tied, setTied] = useState<Set<string>>(new Set(["ssin", "geekble"]));
  const [rejected, setRejected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 초기 배치: 브랜드 중앙, 크리에이터는 주변에
  useEffect(() => {
    const w = ref.current?.clientWidth ?? 1000;
    const h = ref.current?.clientHeight ?? 700;
    setPos({
      brand: { x: w * 0.42, y: h * 0.5 },
      ssin: { x: w * 0.74, y: h * 0.26 },
      geekble: { x: w * 0.76, y: h * 0.62 },
      risabae: { x: w * 0.2, y: h * 0.2 },
      jocoding: { x: w * 0.18, y: h * 0.74 },
    });
  }, []);

  const say = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  };

  const move = (id: string, dx: number, dy: number) =>
    setPos((p) => (p ? { ...p, [id]: { x: p[id].x + dx, y: p[id].y + dy } } : p));

  const onDrop = (n: Node) => {
    if (!pos || tied.has(n.id)) return;
    const d = Math.hypot(pos[n.id].x - pos.brand.x, pos[n.id].y - pos.brand.y);
    if (d > TIE_RADIUS) return;
    if (n.overCap) {
      setRejected(n.id);
      setTimeout(() => setRejected(null), 1600);
      say(`🛡️ 정책 차단 — ${n.handle}의 요구 ${n.amountUsdc} USDC가 딜당 한도 ${BRAND.capUsdc}을 초과해요`);
      return;
    }
    setTied((s) => new Set(s).add(n.id));
    say(`🪢 ${n.handle}와 매듭이 묶였어요 — ${n.amountUsdc} USDC 에스크로 예치`);
  };

  const cut = (n: Node) => {
    setTied((s) => {
      const next = new Set(s);
      next.delete(n.id);
      return next;
    });
    say(`✂️ ${n.handle} 매듭을 끊었어요 — 잔여 에스크로 반환`);
  };

  const spent = NODES.filter((n) => tied.has(n.id)).reduce((a, n) => a + n.amountUsdc, 0);

  return (
    <div data-knot-demo className="flex h-screen flex-col overflow-hidden">
      {/* 헤더 */}
      <header className="z-10 flex items-center gap-3 border-b border-[var(--k-line)] bg-white px-5 py-3">
        <a
          href="/b"
          className="shrink-0 whitespace-nowrap text-[13px] font-bold text-[var(--k-muted)] hover:text-[var(--k-ink)]"
        >
          ← 워크스페이스
        </a>
        <span className="shrink-0 whitespace-nowrap text-[15px] font-bold">그래프 뷰</span>
        <Badge className="shrink-0">β</Badge>
        <span className="hidden min-w-0 truncate text-[12px] text-[var(--k-muted)] lg:block">
          노드를 끌어 배치 · 브랜드 근처로 끌면 매듭이 묶여요 · 매듭 클릭 = ✂️
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap text-[12.5px]">
          <span className="text-[var(--k-muted)]">에스크로</span>
          <span className="k-mono font-bold">{spent.toLocaleString()} / 1,000 USDC</span>
        </div>
      </header>

      {/* 캔버스 */}
      <div
        ref={ref}
        className="relative flex-1"
        style={{
          backgroundImage: "radial-gradient(circle, #dcdce0 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      >
        {pos && (
          <>
            {/* 실(엣지) */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              {NODES.map((n) => {
                const isTied = tied.has(n.id);
                const isRejected = rejected === n.id;
                if (!isTied && !isRejected) return null;
                const { d } = edgePath(pos.brand, pos[n.id]);
                return (
                  <g key={n.id}>
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={isRejected ? "#dc2626" : n.color}
                      strokeWidth={isRejected ? 2.5 : 3.5}
                      strokeLinecap="round"
                      strokeDasharray={isRejected ? "7 7" : undefined}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                    />
                    {isTied && (
                      <motion.path
                        d={d}
                        fill="none"
                        stroke={BRAND.color}
                        strokeWidth="1.6"
                        strokeDasharray="9 12"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.7 }}
                      />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* 매듭 (엣지 중앙, 클릭하면 끊기) */}
            {NODES.filter((n) => tied.has(n.id)).map((n) => {
              const mx = (pos.brand.x + pos[n.id].x) / 2;
              const my = (pos.brand.y + pos[n.id].y) / 2 + 13;
              return (
                <motion.button
                  key={`knot-${n.id}`}
                  onClick={() => cut(n)}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.25 }}
                  className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: mx, top: my }}
                  title="매듭 끊기"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--k-ink)] bg-white text-[13px] shadow-sm">
                    <span className="group-hover:hidden">
                      <KnotGlyph />
                    </span>
                    <span className="hidden group-hover:inline">✂️</span>
                  </span>
                  <span className="k-mono mt-1 rounded-full bg-[var(--k-ink)] px-2 py-0.5 text-[10.5px] font-bold text-white">
                    {n.amountUsdc} USDC
                  </span>
                </motion.button>
              );
            })}

            {/* 브랜드 노드 */}
            <motion.div
              drag
              dragMomentum={false}
              onDrag={(_, info) => move("brand", info.delta.x, info.delta.y)}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
              style={{ left: pos.brand.x, top: pos.brand.y }}
            >
              <div className="flex flex-col items-center rounded-2xl border-2 border-[var(--k-ink)] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BRAND.logo} alt="" width={34} height={34} className="rounded-[9px]" />
                  <div>
                    <div className="text-[15px] font-bold leading-tight">{BRAND.name}</div>
                    <div className="k-mono text-[10.5px] text-[var(--k-muted)]">
                      딜당 한도 {BRAND.capUsdc} USDC
                    </div>
                  </div>
                  <Yarn color={BRAND.color} size={36} mood="idle" />
                </div>
              </div>
            </motion.div>

            {/* 크리에이터 노드 */}
            {NODES.map((n) => {
              const isTied = tied.has(n.id);
              const isRejected = rejected === n.id;
              return (
                <motion.div
                  key={n.id}
                  drag
                  dragMomentum={false}
                  onDrag={(_, info) => move(n.id, info.delta.x, info.delta.y)}
                  onDragEnd={() => onDrop(n)}
                  animate={isRejected ? { x: [0, -7, 7, -5, 5, 0] } : { x: 0 }}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                  style={{ left: pos[n.id].x, top: pos[n.id].y }}
                >
                  <div
                    className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2.5 shadow-sm transition-colors ${
                      isRejected
                        ? "border-red-400"
                        : isTied
                          ? "border-[var(--k-ink)]"
                          : "border-dashed border-[var(--k-line-strong)]"
                    }`}
                  >
                    <Face src={n.photo} color={n.color} size={30} alt={n.handle} />
                    <div>
                      <div className="text-[12.5px] font-bold leading-tight">{n.handle}</div>
                      <div className="text-[10.5px] text-[var(--k-muted)]">
                        {n.niche} · 적합도 {n.fit}
                      </div>
                    </div>
                    {isTied ? (
                      <Badge tone="ok">
                        <KnotGlyph size={13} color="#047857" />
                      </Badge>
                    ) : (
                      <span className="k-mono text-[10.5px] text-[var(--k-muted)]">
                        {n.amountUsdc}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </>
        )}

        {/* 토스트 */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-[var(--k-ink)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
