"use client";

/**
 * Agent Society Map v1 — the audit layer.
 *
 * SVG node graph: the Brand Agent sits center, creator-agent candidates arc
 * above it, and the web3 gateway + pay.sh verification services anchor the
 * edges. Every visual state is driven by promotion data:
 *
 * - candidates light up while matching, with their score shown
 * - hard-filtered candidates render dimmed with a reason tooltip
 * - the selected creator gets an active edge to the brand agent
 * - the negotiation edge pulses while COUNTERED, turns solid green on AGREED
 * - a vault icon appears on escrow lock (SIMULATED watermark when the
 *   receipt signature is null)
 * - coin dots animate vault -> creator on milestone release
 *
 * Honors prefers-reduced-motion: static states, no pulses.
 */

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usdc } from "@/lib/format";
import type { NegotiationStatus } from "@/lib/api/types";
import type { MapState, CandidateNode } from "./types";

const VIEW_W = 800;
const VIEW_H = 480;

const BRAND = { x: 400, y: 258 };
const GATEWAY = { x: 692, y: 404 };
const PAYSH = { x: 108, y: 404 };
const VAULT = { x: 588, y: 322 };
const ARC_RADIUS = 186;

interface Point {
  x: number;
  y: number;
}

/** Candidates fan across the arc above the brand agent. */
function candidatePosition(index: number, count: number): Point {
  const start = count > 3 ? 160 : 150;
  const end = count > 3 ? 20 : 30;
  const deg = count === 1 ? 90 : start - (index * (start - end)) / (count - 1);
  const rad = (deg * Math.PI) / 180;
  return {
    x: BRAND.x + ARC_RADIUS * Math.cos(rad),
    y: BRAND.y - ARC_RADIUS * Math.sin(rad),
  };
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

interface Tooltip {
  x: number;
  y: number;
  title: string;
  lines: string[];
  tone: "filtered" | "info";
}

export function AgentSocietyMap({ state }: { state: MapState }) {
  const reducedMotion = useReducedMotion() ?? false;
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const count = state.candidates.length;
  const positioned = state.candidates.map((node, i) => ({
    node,
    pos: candidatePosition(i, count),
  }));
  const selected =
    positioned.find((p) => p.node.candidate.creatorId === state.selectedCreatorId) ??
    null;

  const negotiationStatus = state.negotiation?.status ?? null;
  const agreedOrLater =
    negotiationStatus === "AGREED" || state.escrow !== null;
  const showVault = state.escrow !== null;
  const coinsActive = state.releasedMilestones > 0 && selected !== null;

  const candidateTooltip = (node: CandidateNode, pos: Point): Tooltip => {
    const c = node.candidate;
    if (!c.eligible) {
      return {
        x: pos.x,
        y: pos.y,
        title: `${c.creatorId} — hard-filtered`,
        lines: c.hardFilterReasons.length > 0 ? c.hardFilterReasons : [c.explanation],
        tone: "filtered",
      };
    }
    const s = c.componentScores;
    return {
      x: pos.x,
      y: pos.y,
      title: `${c.creatorId} — score ${c.score.toFixed(2)}`,
      lines: [
        `category ${s.category.toFixed(2)} · budget ${s.budget.toFixed(2)} · schedule ${s.schedule.toFixed(2)}`,
        `deliverable ${s.deliverable.toFixed(2)} · reputation ${s.reputation.toFixed(2)}`,
        c.explanation,
      ],
      tone: "info",
    };
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="Agent society map: brand agent, creator agent candidates, web3 gateway, and pay.sh verification service"
        className="block h-auto w-full"
      >
        {/* ------------------------------------------------ infrastructure edges */}
        <line
          x1={BRAND.x}
          y1={BRAND.y}
          x2={GATEWAY.x}
          y2={GATEWAY.y}
          stroke="var(--border)"
          strokeWidth={1.25}
          strokeDasharray="3 7"
        />
        <line
          x1={BRAND.x}
          y1={BRAND.y}
          x2={PAYSH.x}
          y2={PAYSH.y}
          stroke="var(--border)"
          strokeWidth={1.25}
          strokeDasharray="3 7"
        />

        {/* ------------------------------------------------ candidate edges */}
        {positioned.map(({ node, pos }) => {
          const isSelected = node.candidate.creatorId === state.selectedCreatorId;
          if (isSelected) return null; // drawn as the negotiation edge below
          const lit = node.state === "lit";
          return (
            <line
              key={`edge-${node.candidate.creatorId}`}
              x1={BRAND.x}
              y1={BRAND.y}
              x2={pos.x}
              y2={pos.y}
              stroke={lit ? "var(--accent)" : "var(--border)"}
              strokeWidth={lit ? 1.5 : 1}
              opacity={node.state === "filtered" ? 0.3 : lit ? 0.55 : 0.5}
            />
          );
        })}

        {/* ------------------------------------------------ negotiation edge */}
        {selected && (
          <NegotiationEdge
            from={BRAND}
            to={selected.pos}
            status={negotiationStatus}
            round={state.negotiation?.currentRound ?? null}
            maxRounds={state.negotiation?.maxRounds ?? null}
            agreedOrLater={agreedOrLater}
            reducedMotion={reducedMotion}
          />
        )}

        {/* ------------------------------------------------ vault + coins */}
        <AnimatePresence>
          {showVault && (
            <motion.g
              key="vault"
              initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              style={{ transformOrigin: `${VAULT.x}px ${VAULT.y}px` }}
            >
              <line
                x1={GATEWAY.x}
                y1={GATEWAY.y}
                x2={VAULT.x}
                y2={VAULT.y}
                stroke="var(--accent)"
                strokeWidth={1.25}
                strokeDasharray="3 5"
                opacity={0.6}
              />
              <VaultIcon
                at={VAULT}
                simulated={state.escrowSimulated}
                amountUsdc={state.escrow?.amountUsdc ?? 0}
              />
            </motion.g>
          )}
        </AnimatePresence>

        {coinsActive && selected && (
          <CoinStream
            from={VAULT}
            to={selected.pos}
            reducedMotion={reducedMotion}
          />
        )}

        {/* ------------------------------------------------ service nodes */}
        <ServiceNode
          at={GATEWAY}
          glyph="WEB3"
          label="web3 gateway"
          active={showVault}
          tone={showVault ? "accent" : "muted"}
        />
        <ServiceNode
          at={PAYSH}
          glyph="PAY.SH"
          label="pay.sh verification"
          active={state.evidenceSubmitted}
          tone={
            state.evidencePassed
              ? "positive"
              : state.evidenceSubmitted
                ? "caution"
                : "muted"
          }
        />

        {/* ------------------------------------------------ brand agent node */}
        <g>
          <circle
            cx={BRAND.x}
            cy={BRAND.y}
            r={36}
            fill="var(--surface-raised)"
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
          <circle
            cx={BRAND.x}
            cy={BRAND.y}
            r={42}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1}
            opacity={0.3}
          />
          <text
            x={BRAND.x}
            y={BRAND.y + 4}
            textAnchor="middle"
            fill="var(--accent-strong)"
            fontSize={12}
            fontWeight={600}
          >
            BRAND
          </text>
          <text
            x={BRAND.x}
            y={BRAND.y + 60}
            textAnchor="middle"
            fill="var(--foreground)"
            fontSize={12}
            fontWeight={500}
          >
            Brand Agent
          </text>
        </g>

        {/* ------------------------------------------------ candidate nodes */}
        {count === 0
          ? [0, 1, 2].map((i) => {
              const pos = candidatePosition(i, 3);
              return (
                <g key={`ghost-${i}`} opacity={0.3}>
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={22}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontSize={11}
                  >
                    —
                  </text>
                </g>
              );
            })
          : positioned.map(({ node, pos }) => (
              <CandidateNodeView
                key={node.candidate.creatorId}
                node={node}
                pos={pos}
                phase={state.phase}
                agreedOrLater={agreedOrLater}
                reducedMotion={reducedMotion}
                onEnter={() => setTooltip(candidateTooltip(node, pos))}
                onLeave={() => setTooltip(null)}
              />
            ))}
      </svg>

      {/* ------------------------------------------------ tooltip overlay */}
      {tooltip && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-full sketch-alt ink border p-3 text-xs shadow-xl ${
            tooltip.tone === "filtered"
              ? "border-negative/40 bg-surface-raised"
              : "border-border-subtle bg-surface-raised"
          }`}
          style={{
            left: `${(tooltip.x / VIEW_W) * 100}%`,
            top: `${((tooltip.y - 34) / VIEW_H) * 100}%`,
          }}
        >
          <div
            className={`mb-1 font-mono text-[10px] uppercase tracking-wide ${
              tooltip.tone === "filtered" ? "text-negative" : "text-accent-strong"
            }`}
          >
            {tooltip.title}
          </div>
          <ul className="flex flex-col gap-1 text-muted">
            {tooltip.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate node
// ---------------------------------------------------------------------------

function CandidateNodeView({
  node,
  pos,
  phase,
  agreedOrLater,
  reducedMotion,
  onEnter,
  onLeave,
}: {
  node: CandidateNode;
  pos: Point;
  phase: MapState["phase"];
  agreedOrLater: boolean;
  reducedMotion: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { candidate, state } = node;
  const filtered = state === "filtered";
  const selectedStroke = agreedOrLater ? "var(--positive)" : "var(--accent)";

  const stroke =
    state === "selected"
      ? selectedStroke
      : state === "lit"
        ? "var(--accent)"
        : "var(--border)";

  return (
    <g
      opacity={filtered ? 0.35 : 1}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
      tabIndex={0}
      role="img"
      aria-label={
        filtered
          ? `${candidate.creatorId}: hard-filtered — ${candidate.hardFilterReasons.join("; ")}`
          : `${candidate.creatorId}: score ${candidate.score.toFixed(2)}${state === "selected" ? ", selected" : ""}`
      }
      style={{ cursor: filtered ? "help" : "default", outline: "none" }}
    >
      {/* matching ripple on lit candidates */}
      {state === "lit" && phase === "MATCHING" && !reducedMotion && (
        <motion.circle
          cx={pos.x}
          cy={pos.y}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          animate={{ r: [23, 34], opacity: [0.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {state === "selected" && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={28}
          fill="none"
          stroke={selectedStroke}
          strokeWidth={1}
          opacity={0.4}
        />
      )}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={22}
        fill="var(--surface-raised)"
        stroke={stroke}
        strokeWidth={state === "selected" ? 2 : 1.5}
        strokeDasharray={filtered ? "3 3" : undefined}
      />
      <text
        x={pos.x}
        y={pos.y + 4}
        textAnchor="middle"
        fill={filtered ? "var(--muted)" : "var(--foreground)"}
        fontSize={11}
        fontFamily="var(--font-geist-mono), monospace"
      >
        {filtered ? "–" : candidate.score.toFixed(2)}
      </text>
      <text
        x={pos.x}
        y={pos.y - 32}
        textAnchor="middle"
        fill={state === "selected" ? "var(--foreground)" : "var(--muted)"}
        fontSize={11}
        fontWeight={state === "selected" ? 600 : 400}
      >
        {candidate.creatorId}
      </text>
      <text
        x={pos.x}
        y={pos.y + 40}
        textAnchor="middle"
        fill="var(--muted)"
        fontSize={9}
        fontFamily="var(--font-geist-mono), monospace"
      >
        {filtered ? "hard-filtered" : `rank ${candidate.rank}`}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Edge service nodes (web3 gateway, pay.sh verification)
// ---------------------------------------------------------------------------

function ServiceNode({
  at,
  glyph,
  label,
  active,
  tone,
}: {
  at: Point;
  glyph: string;
  label: string;
  active: boolean;
  tone: "muted" | "accent" | "positive" | "caution";
}) {
  const stroke =
    tone === "positive"
      ? "var(--positive)"
      : tone === "caution"
        ? "var(--caution)"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--border)";
  const textFill =
    tone === "positive"
      ? "var(--positive)"
      : tone === "caution"
        ? "var(--caution)"
        : tone === "accent"
          ? "var(--accent-strong)"
          : "var(--muted)";

  return (
    <g opacity={active ? 1 : 0.65}>
      <rect
        x={at.x - 33}
        y={at.y - 19}
        width={66}
        height={38}
        rx={12}
        fill="var(--surface-raised)"
        stroke={stroke}
        strokeWidth={1.5}
      />
      <text
        x={at.x}
        y={at.y + 4}
        textAnchor="middle"
        fill={textFill}
        fontSize={10}
        fontWeight={600}
        fontFamily="var(--font-geist-mono), monospace"
        letterSpacing={1}
      >
        {glyph}
      </text>
      <text
        x={at.x}
        y={at.y + 35}
        textAnchor="middle"
        fill="var(--muted)"
        fontSize={9}
      >
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Negotiation edge (brand <-> selected creator)
// ---------------------------------------------------------------------------

function NegotiationEdge({
  from,
  to,
  status,
  round,
  maxRounds,
  agreedOrLater,
  reducedMotion,
}: {
  from: Point;
  to: Point;
  status: NegotiationStatus | null;
  round: number | null;
  maxRounds: number | null;
  agreedOrLater: boolean;
  reducedMotion: boolean;
}) {
  const mid = lerp(from, to, 0.5);

  let stroke = "var(--accent)";
  let dash: string | undefined;
  let label = "selected";
  let labelFill = "var(--accent-strong)";
  let pulse = false;

  if (agreedOrLater) {
    stroke = "var(--positive)";
    label = "agreed";
    labelFill = "var(--positive)";
  } else if (status === "COUNTERED") {
    pulse = true;
    label = round !== null && maxRounds !== null ? `round ${round}/${maxRounds}` : "countered";
  } else if (status === "ESCALATED") {
    stroke = "var(--caution)";
    dash = "6 5";
    pulse = true;
    label = "escalated";
    labelFill = "var(--caution)";
  } else if (status === "REJECTED") {
    stroke = "var(--negative)";
    dash = "6 5";
    label = "rejected";
    labelFill = "var(--negative)";
  }

  const lineProps = {
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    stroke,
    strokeWidth: 2.5,
    strokeDasharray: dash,
    strokeLinecap: "round" as const,
  };

  return (
    <g>
      {pulse && !reducedMotion ? (
        <motion.line
          {...lineProps}
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <line {...lineProps} opacity={0.95} />
      )}
      <text
        x={mid.x}
        y={mid.y - 7}
        textAnchor="middle"
        fill={labelFill}
        fontSize={10}
        fontFamily="var(--font-geist-mono), monospace"
        style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
        paintOrder="stroke"
        stroke="var(--background)"
        strokeWidth={5}
      >
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Escrow vault
// ---------------------------------------------------------------------------

function VaultIcon({
  at,
  simulated,
  amountUsdc,
}: {
  at: Point;
  simulated: boolean;
  amountUsdc: number;
}) {
  const stroke = simulated ? "var(--caution)" : "var(--positive)";
  return (
    <g>
      <rect
        x={at.x - 22}
        y={at.y - 17}
        width={44}
        height={34}
        rx={9}
        fill="var(--surface-raised)"
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={simulated ? "4 3" : undefined}
      />
      {/* lock glyph */}
      <path
        d={`M ${at.x - 5} ${at.y - 2} v -3 a 5 5 0 0 1 10 0 v 3`}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <rect
        x={at.x - 7}
        y={at.y - 2}
        width={14}
        height={10}
        rx={2}
        fill={stroke}
        opacity={0.85}
      />
      {simulated && (
        <text
          x={at.x}
          y={at.y + 2}
          textAnchor="middle"
          fill="var(--caution)"
          fontSize={9}
          fontWeight={700}
          letterSpacing={2}
          opacity={0.9}
          transform={`rotate(-16 ${at.x} ${at.y})`}
          paintOrder="stroke"
          stroke="var(--background)"
          strokeWidth={3}
        >
          SIMULATED
        </text>
      )}
      <text
        x={at.x}
        y={at.y + 31}
        textAnchor="middle"
        fill="var(--foreground)"
        fontSize={10}
        fontFamily="var(--font-geist-mono), monospace"
      >
        {usdc(amountUsdc)}
      </text>
      <text
        x={at.x}
        y={at.y + 43}
        textAnchor="middle"
        fill="var(--muted)"
        fontSize={9}
      >
        escrow vault{simulated ? " · simulated" : ""}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Coin stream (vault -> creator on milestone release)
// ---------------------------------------------------------------------------

function CoinStream({
  from,
  to,
  reducedMotion,
}: {
  from: Point;
  to: Point;
  reducedMotion: boolean;
}) {
  const coins = [0, 1, 2];

  return (
    <g>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="var(--positive)"
        strokeWidth={1}
        strokeDasharray="2 6"
        opacity={0.5}
      />
      {reducedMotion
        ? // static states: fixed coin dots along the path, no motion
          [0.3, 0.55, 0.8].map((t) => {
            const p = lerp(from, to, t);
            return (
              <circle
                key={t}
                cx={p.x}
                cy={p.y}
                r={4.5}
                fill="var(--caution)"
                stroke="var(--background)"
                strokeWidth={1}
              />
            );
          })
        : coins.map((i) => (
            <motion.circle
              key={i}
              r={4.5}
              fill="var(--caution)"
              stroke="var(--background)"
              strokeWidth={1}
              initial={{ x: from.x, y: from.y, opacity: 0 }}
              animate={{
                x: [from.x, to.x],
                y: [from.y, to.y],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 1.9,
                repeat: Infinity,
                repeatDelay: 0.5,
                delay: i * 0.55,
                ease: "easeInOut",
              }}
            />
          ))}
    </g>
  );
}
