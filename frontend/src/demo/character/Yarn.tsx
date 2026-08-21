"use client";

/**
 * 실타래 에이전트 캐릭터 — knot의 마스코트.
 *
 * 몸통은 실을 감아놓은 공, 아래로 실 한 가닥이 풀려 있다. 딜이 체결되면
 * 두 캐릭터의 실이 서로 묶인다(KnotTie). 표정(mood)으로 상태를 말한다.
 */

import { motion, type TargetAndTransition } from "framer-motion";
import type { Mood } from "@/demo/engine/types";

const bodyMotion: Record<Mood, TargetAndTransition> = {
  idle: { y: [0, -3, 0], rotate: [0, 1.5, 0], transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } },
  sleep: { y: [0, -1.5, 0], transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" } },
  think: { rotate: [0, -3, 0, -3, 0], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" } },
  talk: { y: [0, -2, 0], transition: { duration: 0.55, repeat: Infinity, ease: "easeInOut" } },
  happy: { y: [0, -7, 0], rotate: [0, -4, 4, 0], transition: { duration: 0.9, repeat: Infinity, ease: "easeOut" } },
  sad: { y: 3, rotate: -2, transition: { duration: 0.6 } },
  alert: { x: [0, -2, 2, -2, 0], transition: { duration: 0.5, repeat: Infinity } },
};

function Eyes({ mood }: { mood: Mood }) {
  if (mood === "sleep") {
    return (
      <g stroke="#18181b" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M42 57 q5 3.5 10 0" />
        <path d="M68 57 q5 3.5 10 0" />
      </g>
    );
  }
  if (mood === "happy") {
    return (
      <g stroke="#18181b" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M42 57 q5 -5 10 0" />
        <path d="M68 57 q5 -5 10 0" />
      </g>
    );
  }
  const dx = mood === "think" ? -2 : 0;
  const dy = mood === "think" ? -2.5 : 0;
  const r = mood === "alert" ? 5.4 : 4.4;
  return (
    <motion.g
      animate={{ scaleY: [1, 1, 0.08, 1, 1] }}
      transition={{ duration: 4.2, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}
      style={{ originY: "56px" }}
    >
      <circle cx={47 + dx} cy={56 + dy} r={r} fill="#18181b" />
      <circle cx={73 + dx} cy={56 + dy} r={r} fill="#18181b" />
      <circle cx={48.6 + dx} cy={54.2 + dy} r={1.4} fill="#fff" />
      <circle cx={74.6 + dx} cy={54.2 + dy} r={1.4} fill="#fff" />
    </motion.g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "talk":
      return (
        <motion.ellipse
          cx="60"
          cy="72"
          rx="5.5"
          fill="#18181b"
          animate={{ ry: [2.2, 5, 2.2] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      );
    case "happy":
      return <path d="M50 68 q10 12 20 0 z" fill="#18181b" />;
    case "sad":
      return <path d="M53 75 q7 -5 14 0" stroke="#18181b" strokeWidth="2.6" strokeLinecap="round" fill="none" />;
    case "think":
      return <circle cx="57" cy="72" r="3" fill="#18181b" />;
    case "alert":
      return <ellipse cx="60" cy="73" rx="4" ry="5" fill="#18181b" />;
    case "sleep":
      return <path d="M56 72 q4 2.5 8 0" stroke="#18181b" strokeWidth="2.4" strokeLinecap="round" fill="none" />;
    default:
      return <path d="M54 71 q6 4.5 12 0" stroke="#18181b" strokeWidth="2.6" strokeLinecap="round" fill="none" />;
  }
}

export function Yarn({
  color,
  size = 96,
  mood = "idle",
  flip = false,
}: {
  color: string;
  size?: number;
  mood?: Mood;
  flip?: boolean;
}) {
  const tint = `color-mix(in srgb, ${color} 26%, white)`;
  const deep = `color-mix(in srgb, ${color} 82%, black 6%)`;
  return (
    <motion.svg
      viewBox="0 0 120 126"
      width={size}
      height={size * 1.05}
      style={{ transform: flip ? "scaleX(-1)" : undefined, overflow: "visible" }}
      animate={bodyMotion[mood]}
    >
      {/* 풀린 실 한 가닥 */}
      <motion.path
        d="M92 92 q16 8 14 20 q-2 10 8 12"
        stroke={deep}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        animate={{ pathOffset: [0, 0.04, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />
      {/* 몸통 */}
      <circle cx="60" cy="62" r="41" fill={tint} stroke={deep} strokeWidth="3" />
      {/* 감긴 실 라인 */}
      <g stroke={deep} strokeWidth="2.4" fill="none" opacity="0.5" strokeLinecap="round">
        <path d="M25 48 q35 -22 70 0" />
        <path d="M21 66 q39 -18 78 -2" />
        <path d="M26 82 q34 16 66 2" />
        <path d="M38 96 q22 10 44 -2" />
      </g>
      {/* 하이라이트 */}
      <ellipse cx="45" cy="38" rx="10" ry="6" fill="white" opacity="0.5" transform="rotate(-24 45 38)" />
      {/* 볼터치 */}
      {(mood === "happy" || mood === "talk") && (
        <g fill={color} opacity="0.35">
          <ellipse cx="37" cy="66" rx="5.5" ry="3.5" />
          <ellipse cx="83" cy="66" rx="5.5" ry="3.5" />
        </g>
      )}
      <Eyes mood={mood} />
      <Mouth mood={mood} />
      {/* 수면 z */}
      {mood === "sleep" && (
        <motion.g
          fill="none"
          stroke="#8e8e96"
          strokeWidth="2.2"
          strokeLinecap="round"
          animate={{ opacity: [0, 1, 0], y: [-2, -8] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          <path d="M92 30 h9 l-9 9 h9" />
        </motion.g>
      )}
    </motion.svg>
  );
}

/** 두 실타래의 실이 매듭으로 묶이는 연출 — 승인 직후 2.5초. */
export function KnotTie({
  leftColor,
  rightColor,
  size = 300,
}: {
  leftColor: string;
  rightColor: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 300 110" width={size} style={{ overflow: "visible" }}>
      <motion.path
        d="M10 55 C80 55 100 30 140 52 C160 63 160 78 148 78 C136 78 136 58 156 50 C176 42 200 55 290 55"
        stroke={leftColor}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
      <motion.path
        d="M290 62 C210 62 190 85 152 64 C134 54 134 40 146 40 C158 40 158 60 138 66 C118 72 90 62 10 62"
        stroke={rightColor}
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: "easeInOut", delay: 0.25 }}
      />
      <motion.circle
        cx="150"
        cy="58"
        r="16"
        fill="none"
        stroke="#18181b"
        strokeWidth="2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.9, delay: 1.7 }}
      />
    </svg>
  );
}

/**
 * 실타래 진행률 — 실이 감기며 타래가 점점 커지고, 100%에서 표정이 생기며 완성.
 * 별 게이지를 대체한다.
 */
export function YarnMeter({
  pct,
  color = "#e8896b",
  size = 72,
}: {
  pct: number;
  color?: string;
  size?: number;
}) {
  const done = pct >= 100;
  const scale = 0.38 + 0.62 * Math.min(pct, 100) / 100;
  const strands = [
    "M25 48 q35 -22 70 0",
    "M21 66 q39 -18 78 -2",
    "M26 82 q34 16 66 2",
    "M38 96 q22 10 44 -2",
  ];
  const visible = Math.ceil((Math.min(pct, 100) / 100) * strands.length);
  const tint = `color-mix(in srgb, ${color} 26%, white)`;
  const deep = `color-mix(in srgb, ${color} 82%, black 6%)`;
  return (
    <div className="inline-flex flex-col items-center">
      <svg viewBox="0 0 120 124" width={size} height={size * 1.03} style={{ overflow: "visible" }}>
        {/* 완성될 타래의 자리 (점선 가이드) */}
        <circle cx="60" cy="62" r="41" fill="none" stroke="#d9d9de" strokeWidth="1.6" strokeDasharray="4 6" />
        {/* 감기는 중인 실 (위에서 흘러들어옴) */}
        {!done && pct > 0 && (
          <motion.path
            d="M112 8 q-18 14 -34 26 q-10 8 -18 15"
            fill="none"
            stroke={deep}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeDasharray="6 7"
            animate={{ strokeDashoffset: [0, -26] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          />
        )}
        {/* 자라는 타래 */}
        <motion.g
          style={{ originX: "60px", originY: "62px" }}
          initial={false}
          animate={done ? { scale: [scale, 1.12, 1] } : { scale }}
          transition={done ? { duration: 0.55, ease: "easeOut" } : { type: "spring", stiffness: 70, damping: 16 }}
        >
          <circle cx="60" cy="62" r="41" fill={tint} stroke={deep} strokeWidth="3" />
          <g stroke={deep} strokeWidth="2.4" fill="none" opacity="0.55" strokeLinecap="round">
            {strands.slice(0, Math.max(visible, 1)).map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <ellipse cx="45" cy="38" rx="10" ry="6" fill="white" opacity="0.5" transform="rotate(-24 45 38)" />
          {/* 완성되면 표정이 생긴다 */}
          {done && (
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
              <g stroke="#18181b" strokeWidth="3" strokeLinecap="round" fill="none">
                <path d="M42 57 q5 -5 10 0" />
                <path d="M68 57 q5 -5 10 0" />
              </g>
              <path d="M50 68 q10 12 20 0 z" fill="#18181b" />
            </motion.g>
          )}
        </motion.g>
      </svg>
      <div className="k-mono -mt-0.5 text-[12px] font-bold" style={done ? { color: deep } : undefined}>
        {Math.min(pct, 100)}%
      </div>
    </div>
  );
}

/** 타래 완성 시 펑 터지는 파티클. */
export function StarBurst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  const rays = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {rays.map((i) => {
        const angle = (i / rays.length) * Math.PI * 2;
        return (
          <motion.span
            key={`${trigger}-${i}`}
            className="absolute text-lg"
            initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
            animate={{
              x: Math.cos(angle) * 74,
              y: Math.sin(angle) * 58,
              opacity: 0,
              scale: 1.25,
            }}
            transition={{ duration: 0.95, ease: "easeOut" }}
          >
            {i % 3 === 0 ? "🧶" : i % 3 === 1 ? "✨" : "💛"}
          </motion.span>
        );
      })}
    </div>
  );
}
