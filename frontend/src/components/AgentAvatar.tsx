/**
 * 작은 에이전트 얼굴 — `AgentCharacter`의 압축판.
 *
 * 채팅 말풍선 옆에 붙는 용도라 전신 캐릭터를 쓰기엔 크고, 모노그램을 쓰면
 * 부화한 매니저와 다른 사람처럼 보인다. 같은 `agentTraits`에서 파생시키므로
 * 얼굴·색·액세서리가 전신 캐릭터와 일치한다.
 */

import { agentTraits, type AgentSide } from "@/lib/agentIdentity";

const SIZE_PX = { sm: 26, md: 34, lg: 46 } as const;

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
  const ink = "var(--foreground)";

  return (
    <span
      title={traits.name}
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${className ?? ""}`}
      style={{ width: px, height: px, borderColor: traits.ink, background: traits.inkGlow }}
    >
      <svg viewBox="28 8 44 42" width={px} height={px}>
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
        {traits.eyes === "wide" ? (
          <g>
            <circle cx="43" cy="30" r="4" fill={ink} />
            <circle cx="57" cy="30" r="4" fill={ink} />
          </g>
        ) : traits.eyes === "calm" ? (
          <g>
            <path d="M39 31 q4 -4 8 0" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M53 31 q4 -4 8 0" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            <circle cx="43.5" cy="30" r="2.8" fill={ink} />
            <circle cx="56.5" cy="30" r="2.8" fill={ink} />
          </g>
        )}
        <path
          d="M45 38 q5 4 10 0"
          stroke={ink}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        {traits.accessory === "sparkle" ? (
          <path
            d="M50 11 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2 Z"
            fill={traits.tint}
          />
        ) : traits.accessory === "headband" ? (
          <path d="M33 22 q17 -6 34 0" stroke={traits.tint} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M34 20 q16 -11 32 0" fill={traits.tint} opacity="0.9" />
        )}
      </svg>
    </span>
  );
}
