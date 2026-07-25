/**
 * Deterministic avatar for negotiation agents: brand agents render in the
 * accent hue, creator agents in the positive hue, with a two-letter monogram
 * derived from the agent id (e.g. "brand-agent-001" -> "BA").
 */

export type AgentSide = "brand" | "creator";

const SIDE_STYLE: Record<AgentSide, string> = {
  brand: "border-accent/40 bg-accent/15 text-accent-strong",
  creator: "border-positive/40 bg-positive/15 text-positive",
};

const SIZE_STYLE = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
} as const;

function monogram(agentId: string): string {
  const parts = agentId.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return agentId.slice(0, 2).toUpperCase() || "??";
}

export function AgentAvatar({
  agentId,
  side,
  size = "md",
}: {
  agentId: string;
  side: AgentSide;
  size?: keyof typeof SIZE_STYLE;
}) {
  return (
    <span
      title={agentId}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-mono font-semibold uppercase ${SIDE_STYLE[side]} ${SIZE_STYLE[size]}`}
    >
      {monogram(agentId)}
    </span>
  );
}
