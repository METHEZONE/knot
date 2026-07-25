import { ImageResponse } from "next/og";
import { SEED } from "@/lib/seeds";
import { agentTraits, type AgentTraits } from "@/lib/agentIdentity";
import { demoBrand, demoCreators, demoNegotiation } from "@/lib/fixtures";

/**
 * Public replay OG card (PRD v2 §7): "both avatars + AGREED in N rounds".
 * This is the artifact people actually share — X unfurls this image, not the
 * page. Amounts never appear here; public replay links mask pricing by
 * default, and the card must honour that same rule.
 *
 * The round count and outcome come from `demoNegotiation` — the one
 * negotiation this demo has — never a made-up number. If KNOT ever tracks
 * more than one negotiation, this should read the real one via
 * `knotProvider.getNegotiation(negotiationId)` the way the page itself does.
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const rounds = demoNegotiation.currentRound;
const roundNoun = rounds === 1 ? "round" : "rounds";
const headline = `${demoNegotiation.status} in ${rounds} ${roundNoun}`;

export const alt = `${headline} — KNOT negotiation replay`;

const BACKGROUND = "#0a0b0f";
const FOREGROUND = "#e8eaf0";
const MUTED = "#8b91a5";
const ACCENT = "#7c8cff";
const POSITIVE = "#4ade80";

/**
 * Compact parametric face — the `next/og`-safe analogue of `AgentAvatar`
 * (which is a client component and can't render here). Same traits, same
 * markup shape, so the agent on the card matches the agent in the app.
 */
function AgentFace({ traits, size }: { traits: AgentTraits; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size / 2,
        border: `3px solid ${traits.ink}`,
        backgroundColor: traits.inkGlow,
      }}
    >
      <svg viewBox="28 4 44 46" width={size * 0.72} height={size * 0.72}>
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
          <>
            <circle cx="43" cy="30" r="4" fill={FOREGROUND} />
            <circle cx="57" cy="30" r="4" fill={FOREGROUND} />
          </>
        ) : traits.eyes === "calm" ? (
          <>
            <path d="M39 31 q4 -4 8 0" stroke={FOREGROUND} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M53 31 q4 -4 8 0" stroke={FOREGROUND} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="43.5" cy="30" r="2.8" fill={FOREGROUND} />
            <circle cx="56.5" cy="30" r="2.8" fill={FOREGROUND} />
          </>
        )}
        <path
          d="M45 38 q5 4 10 0"
          stroke={FOREGROUND}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />
        {traits.accessory === "sparkle" ? (
          <path d="M50 6 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill={traits.ink} />
        ) : traits.accessory === "headband" ? (
          <path d="M33 22 q17 -6 34 0" stroke={traits.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : traits.accessory === "cap" ? (
          <path d="M34 20 q16 -12 32 0" fill={traits.ink} opacity={0.9} />
        ) : traits.accessory === "visor" ? (
          <rect x="34" y="25" width="32" height="10" rx="5" fill={traits.ink} opacity={0.55} />
        ) : traits.accessory === "chefHat" ? (
          <>
            <circle cx="43" cy="14" r="6" fill={traits.ink} opacity={0.9} />
            <circle cx="52" cy="11" r="7" fill={traits.ink} opacity={0.9} />
            <circle cx="60" cy="15" r="5.5" fill={traits.ink} opacity={0.9} />
          </>
        ) : traits.accessory === "leaf" ? (
          <path d="M64 18 q10 -10 12 -2 q2 8 -12 8 Z" fill={traits.ink} opacity={0.9} />
        ) : (
          <>
            <path d="M50 18 l0 -9" stroke={traits.ink} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="50" cy="7" r="3" fill={traits.ink} />
          </>
        )}
      </svg>
    </div>
  );
}

/** The knot: two interlocking loops sitting between the two agents. */
function KnotMotif() {
  return (
    <svg width="150" height="90" viewBox="0 0 150 90">
      <g transform="rotate(14 50 45)">
        <rect x="16" y="22" width="66" height="44" rx="22" fill="none" stroke={ACCENT} strokeWidth="7" />
      </g>
      <g transform="rotate(-14 100 45)">
        <rect x="68" y="22" width="66" height="44" rx="22" fill="none" stroke={ACCENT} strokeWidth="7" />
      </g>
    </svg>
  );
}

export default function Image() {
  const brandTraits = agentTraits(SEED.brandAgentId, "brand", demoBrand.category);
  const creatorTraits = agentTraits(
    SEED.creatorAgentId,
    "creator",
    demoCreators[0].category,
  );

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "56px 72px",
          backgroundColor: BACKGROUND,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex" }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: ACCENT, letterSpacing: "-0.02em" }}>
              KNOT
            </span>
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ fontSize: 20, color: MUTED }}>
              creator × brand · agent-to-agent
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 44,
            }}
          >
            <div style={{ display: "flex", marginRight: 30 }}>
              <AgentFace traits={brandTraits} size={200} />
            </div>
            <div style={{ display: "flex", marginRight: 30 }}>
              <KnotMotif />
            </div>
            <div style={{ display: "flex" }}>
              <AgentFace traits={creatorTraits} size={200} />
            </div>
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ fontSize: 68, fontWeight: 800, color: POSITIVE, letterSpacing: "-0.01em" }}>
              {headline}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "row", justifyContent: "center", width: "100%" }}>
          <span style={{ fontSize: 18, color: MUTED }}>
            Solana devnet · simulated receipts
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
