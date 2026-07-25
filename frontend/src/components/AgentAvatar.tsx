/**
 * Small parametric agent face — the compact form of AgentCharacter.
 *
 * Look is derived from `agentIdentity.agentTraits`, so the face here is the
 * same face that hatched in onboarding and that walks the expedition map.
 * Props are unchanged from the monogram version this replaces; `category`
 * (from the creator diagnosis) is optional and only sharpens the palette.
 */

import { agentTraits, type AgentSide } from "@/lib/agentIdentity";

export type { AgentSide };

const SIZE_PX = { sm: 28, md: 36, lg: 48 } as const;

export function AgentAvatar({
  agentId,
  side,
  category,
  size = "md",
  className,
}: {
  agentId: string;
  side: AgentSide;
  category?: string;
  size?: keyof typeof SIZE_PX;
  className?: string;
}) {
  const traits = agentTraits(agentId, side, category);
  const px = SIZE_PX[size];
  const light = "var(--foreground)";

  return (
    <span
      title={`${traits.name} · ${agentId}`}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border ${className ?? ""}`}
      style={{
        width: px,
        height: px,
        borderColor: traits.ink,
        background: traits.inkGlow,
      }}
    >
      <svg viewBox="28 4 44 46" width={px} height={px} role="img" aria-label={`${traits.name}, ${side} agent`}>
        {/* head */}
        <rect
          x="31"
          y="17"
          width="38"
          height="30"
          rx="11"
          fill={traits.inkSoft}
          stroke={traits.ink}
          strokeWidth="2.6"
        />
        {/* eyes */}
        {traits.eyes === "wide" ? (
          <>
            <circle cx="43" cy="30" r="4" fill={light} />
            <circle cx="57" cy="30" r="4" fill={light} />
          </>
        ) : traits.eyes === "calm" ? (
          <>
            <path d="M39 31 q4 -4 8 0" stroke={light} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M53 31 q4 -4 8 0" stroke={light} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="43.5" cy="30" r="2.8" fill={light} />
            <circle cx="56.5" cy="30" r="2.8" fill={light} />
          </>
        )}
        <path
          d="M45 38 q5 4 10 0"
          stroke={light}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        {/* accessory — compact echo of the full character's */}
        {traits.accessory === "sparkle" ? (
          <path d="M50 6 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill={traits.tint} />
        ) : traits.accessory === "headband" ? (
          <path d="M33 22 q17 -6 34 0" stroke={traits.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : traits.accessory === "cap" ? (
          <path d="M34 20 q16 -12 32 0" fill={traits.tint} opacity="0.9" />
        ) : traits.accessory === "visor" ? (
          <rect x="34" y="25" width="32" height="10" rx="5" fill={traits.tint} opacity="0.55" />
        ) : traits.accessory === "chefHat" ? (
          <g fill={traits.tint} opacity="0.9">
            <circle cx="43" cy="14" r="6" />
            <circle cx="52" cy="11" r="7" />
            <circle cx="60" cy="15" r="5.5" />
          </g>
        ) : traits.accessory === "leaf" ? (
          <path d="M64 18 q10 -10 12 -2 q2 8 -12 8 Z" fill={traits.tint} opacity="0.9" />
        ) : (
          <g>
            <path d="M50 18 l0 -9" stroke={traits.ink} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="50" cy="7" r="3" fill={traits.tint} />
          </g>
        )}
      </svg>
    </span>
  );
}
