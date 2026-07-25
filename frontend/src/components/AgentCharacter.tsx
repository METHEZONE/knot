"use client";

/**
 * Parametric SVG agent character (PRD v2 §13).
 *
 * One component covers every scene the agent appears in — hatching ceremony,
 * expedition map, negotiation table — via `pose`. Look is derived from
 * `agentIdentity.agentTraits`, so the agent that hatches is visibly the same
 * agent that later knocks on a creator's door.
 *
 * Motion is decorative only: with prefers-reduced-motion the character renders
 * in a static version of the same pose (PRD v2 §13 reduced-motion rule).
 */

import { motion, useReducedMotion } from "framer-motion";
import {
  agentTraits,
  type AgentSide,
  type AgentTraits,
} from "@/lib/agentIdentity";

export type AgentPose = "idle" | "walk" | "knock" | "bow" | "greet" | "sit";

const BODY_PATH: Record<AgentTraits["body"], string> = {
  // Soft capsule.
  capsule: "M30 56 q0 -10 20 -10 q20 0 20 10 l0 34 q0 12 -20 12 q-20 0 -20 -12 Z",
  // Widening bell.
  bell: "M32 56 q0 -10 18 -10 q18 0 18 10 l6 40 q0 8 -24 8 q-24 0 -24 -8 Z",
  // Boxy, brand-manager silhouette.
  block: "M31 54 q0 -8 19 -8 q19 0 19 8 l0 40 q0 8 -19 8 q-19 0 -19 -8 Z",
};

/** Arm paths per pose: [left, right]. Shoulders sit at (32,62) / (68,62). */
const ARMS: Record<AgentPose, [string, string]> = {
  idle: ["M32 62 q-9 8 -8 20", "M68 62 q9 8 8 20"],
  walk: ["M32 62 q-11 5 -9 16", "M68 62 q6 11 3 21"],
  // Right arm up, fist at door height.
  knock: ["M32 62 q-9 8 -8 20", "M68 62 q12 -6 10 -19"],
  bow: ["M32 62 q-6 12 -2 22", "M68 62 q6 12 2 22"],
  // Right arm raised in greeting.
  greet: ["M32 62 q-9 8 -8 20", "M68 62 q14 -8 8 -22"],
  sit: ["M32 62 q-10 6 -10 15", "M68 62 q10 6 10 15"],
};

/** Leg paths per pose: [left, right]. Hips at (42,100) / (58,100). */
const LEGS: Record<AgentPose, [string, string]> = {
  idle: ["M43 100 l-2 22", "M57 100 l2 22"],
  walk: ["M43 100 l-9 19", "M57 100 l6 21"],
  knock: ["M43 100 l-3 22", "M57 100 l4 21"],
  bow: ["M43 100 l-2 22", "M57 100 l3 22"],
  greet: ["M43 100 l-3 22", "M57 100 l3 22"],
  sit: ["M43 100 l-13 8", "M57 100 l13 8"],
};

function Eyes({ traits }: { traits: AgentTraits }) {
  const light = "var(--foreground)";
  if (traits.eyes === "wide") {
    return (
      <>
        <circle cx="43" cy="30" r="4" fill={light} />
        <circle cx="57" cy="30" r="4" fill={light} />
      </>
    );
  }
  if (traits.eyes === "calm") {
    return (
      <>
        <path d="M39 31 q4 -4 8 0" stroke={light} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M53 31 q4 -4 8 0" stroke={light} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <circle cx="43.5" cy="30" r="2.8" fill={light} />
      <circle cx="56.5" cy="30" r="2.8" fill={light} />
    </>
  );
}

function Accessory({ traits }: { traits: AgentTraits }) {
  const { accessory, ink, tint } = traits;
  const stroke = { stroke: ink, strokeWidth: 2.4, fill: "none", strokeLinecap: "round" as const };

  switch (accessory) {
    case "sparkle":
      return (
        <g>
          <path d="M50 6 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill={tint} />
          <circle cx="64" cy="14" r="1.6" fill={tint} />
        </g>
      );
    case "headband":
      return <path d="M33 22 q17 -6 34 0" {...stroke} />;
    case "cap":
      return (
        <g>
          <path d="M34 20 q16 -12 32 0" fill={tint} opacity="0.9" />
          <path d="M66 20 q10 1 12 4 l-12 0 Z" fill={tint} opacity="0.7" />
        </g>
      );
    case "visor":
      return (
        <g>
          <rect x="34" y="25" width="32" height="10" rx="5" fill={tint} opacity="0.55" />
          <path d="M34 30 h32" stroke={ink} strokeWidth="1.2" opacity="0.9" />
        </g>
      );
    case "chefHat":
      return (
        <g fill={tint} opacity="0.9">
          <circle cx="42" cy="15" r="7" />
          <circle cx="52" cy="11" r="8" />
          <circle cx="61" cy="16" r="6.5" />
          <rect x="37" y="17" width="27" height="6" rx="2" />
        </g>
      );
    case "leaf":
      return <path d="M64 18 q10 -10 12 -2 q2 8 -12 8 Z" fill={tint} opacity="0.9" />;
    default:
      return (
        <g>
          <path d="M50 18 l0 -10" {...stroke} />
          <circle cx="50" cy="6" r="3" fill={tint} />
        </g>
      );
  }
}

function HeldProp({ traits, pose }: { traits: AgentTraits; pose: AgentPose }) {
  // Hidden while the hand is busy knocking or waving.
  if (pose === "knock" || pose === "greet") return null;
  const { prop, ink, inkSoft } = traits;

  switch (prop) {
    case "briefcase":
      return (
        <g>
          <rect x="68" y="80" width="16" height="12" rx="2.5" fill={inkSoft} stroke={ink} strokeWidth="2" />
          <path d="M73 80 q3 -4 6 0" stroke={ink} strokeWidth="1.8" fill="none" />
        </g>
      );
    case "clipboard":
      return (
        <g>
          <rect x="69" y="78" width="13" height="17" rx="2" fill={inkSoft} stroke={ink} strokeWidth="2" />
          <path d="M72 84 h7 M72 88 h7" stroke={ink} strokeWidth="1.4" />
        </g>
      );
    case "phone":
      return (
        <rect x="72" y="78" width="9" height="15" rx="2.5" fill={inkSoft} stroke={ink} strokeWidth="2" />
      );
    default:
      return (
        <g>
          <circle cx="76" cy="80" r="5" fill={inkSoft} stroke={ink} strokeWidth="2" />
          <path d="M76 85 l0 8" stroke={ink} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
  }
}

/** Whole-body transform per pose (bow tilts forward, sit drops down). */
const POSE_TRANSFORM: Record<AgentPose, { rotate: number; y: number }> = {
  idle: { rotate: 0, y: 0 },
  walk: { rotate: -1.5, y: 0 },
  knock: { rotate: 2, y: 0 },
  bow: { rotate: 16, y: 4 },
  greet: { rotate: -2, y: 0 },
  sit: { rotate: 0, y: 14 },
};

export function AgentCharacter({
  agentId,
  side,
  category,
  pose = "idle",
  size = 140,
  className,
}: {
  agentId: string;
  side: AgentSide;
  category?: string;
  pose?: AgentPose;
  size?: number;
  className?: string;
}) {
  const traits = agentTraits(agentId, side, category);
  const reduced = useReducedMotion();
  const [leftArm, rightArm] = ARMS[pose];
  const [leftLeg, rightLeg] = LEGS[pose];
  const transform = POSE_TRANSFORM[pose];

  // Idle breathing / walk bounce / knock jab — decorative, dropped when the
  // user asks for reduced motion.
  const loop =
    reduced || pose === "bow" || pose === "sit"
      ? undefined
      : pose === "walk"
        ? { y: [transform.y, transform.y - 4, transform.y], rotate: [-1.5, 1.5, -1.5] }
        : pose === "knock"
          ? { x: [0, 3, 0], rotate: [2, 4, 2] }
          : { y: [transform.y, transform.y - 2.5, transform.y], rotate: transform.rotate };

  const duration = pose === "walk" ? 0.6 : pose === "knock" ? 0.32 : 3;

  return (
    <svg
      viewBox="0 0 100 130"
      width={size}
      height={(size * 130) / 100}
      className={`squig-slow ${className ?? ""}`}
      role="img"
      aria-label={`${traits.name}, ${side} agent`}
    >
      <defs>
        <radialGradient id={`glow-${agentId}`} cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor={traits.tint} stopOpacity="0.30" />
          <stop offset="100%" stopColor={traits.tint} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="60" rx="46" ry="52" fill={`url(#glow-${agentId})`} />

      <motion.g
        style={{ transformOrigin: "50px 122px" }}
        initial={false}
        animate={loop ?? { y: transform.y, rotate: transform.rotate }}
        transition={
          loop
            ? { duration, repeat: Infinity, ease: "easeInOut" }
            : { type: "spring", stiffness: 120, damping: 14 }
        }
      >
        <g>
          {/* ground shadow */}
          <ellipse cx="50" cy="124" rx="18" ry="3.5" fill="var(--border)" opacity="0.16" />

          {/* legs, then body over them */}
          <path d={leftLeg} stroke={traits.ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d={rightLeg} stroke={traits.ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />

          <path d={BODY_PATH[traits.body]} fill={traits.inkSoft} stroke={traits.ink} strokeWidth="2.6" />

          {/* side badge: brand agents wear a tag, creators a knot loop */}
          {side === "brand" ? (
            <rect x="45" y="62" width="10" height="13" rx="2" fill={traits.tint} opacity="0.85" />
          ) : (
            <path
              d="M44 66 q6 -6 10 0 q4 5 -3 6 q-6 1 -3 -5"
              stroke={traits.tint}
              strokeWidth="2.4"
              fill="none"
              opacity="0.95"
            />
          )}

          <path d={leftArm} stroke={traits.ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d={rightArm} stroke={traits.ink} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <HeldProp traits={traits} pose={pose} />

          {/* head */}
          <rect x="31" y="17" width="38" height="30" rx="11" fill={traits.inkSoft} stroke={traits.ink} strokeWidth="2.6" />
          <Eyes traits={traits} />
          <path
            d={pose === "greet" || pose === "idle" ? "M45 38 q5 4 10 0" : "M46 38 h8"}
            stroke="var(--foreground)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          <Accessory traits={traits} />
        </g>
      </motion.g>
    </svg>
  );
}
