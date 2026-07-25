"use client";

/**
 * Negotiation theater — chat-bubble replay of agent-to-agent negotiation
 * messages. Brand agent speaks on the left, creator agent on the right.
 * Messages auto-advance with typing pacing; skip reveals everything at once.
 * When the replay finishes on an AGREED negotiation, the final term sheet
 * (with termsHash) slides in.
 *
 * `maskable` puts the theater in public-replay mode: amounts blur by
 * default with a reveal toggle.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type {
  Negotiation,
  NegotiationMessage,
  NegotiationMessageType,
} from "@/lib/api/types";
import { usdc, formatDateTime } from "@/lib/format";
import { AgentAvatar, type AgentSide } from "@/components/AgentAvatar";
import { MaskedAmount } from "./MaskedAmount";
import { TermSheetCard } from "./TermSheetCard";

const TYPE_BADGE: Record<NegotiationMessageType, string> = {
  OFFER: "border-accent/30 bg-accent/10 text-accent-strong",
  COUNTER: "border-caution/30 bg-caution/10 text-caution",
  ACCEPT: "border-positive/30 bg-positive/10 text-positive",
  REJECT: "border-negative/30 bg-negative/10 text-negative",
  ESCALATE: "border-negative/30 bg-negative/10 text-negative",
};

const GAP_MS = 550;

/** ROLE_USER = brand agent (left); ROLE_AGENT = creator agent (right). */
function sideOf(message: NegotiationMessage): AgentSide {
  return message.role === "ROLE_USER" ? "brand" : "creator";
}

function typingMsFor(message: NegotiationMessage): number {
  return Math.min(2400, 700 + message.payload.rationale.length * 5);
}

export function NegotiationTheater({
  negotiation,
  messages,
  brandAgentId,
  creatorAgentId,
  maskable = false,
}: {
  negotiation: Negotiation;
  messages: NegotiationMessage[];
  brandAgentId: string;
  creatorAgentId: string;
  maskable?: boolean;
}) {
  const ordered = useMemo(
    () => [...messages].sort((a, b) => a.sequence - b.sequence),
    [messages],
  );

  const [revealed, setRevealed] = useState(0);
  const [typing, setTyping] = useState(false);
  const [masked, setMasked] = useState(maskable);

  const done = revealed >= ordered.length;
  const next = done ? null : ordered[revealed];

  useEffect(() => {
    if (!next) return;
    const gapTimer = setTimeout(() => setTyping(true), GAP_MS);
    const revealTimer = setTimeout(() => {
      setTyping(false);
      setRevealed((r) => r + 1);
    }, GAP_MS + typingMsFor(next));
    return () => {
      clearTimeout(gapTimer);
      clearTimeout(revealTimer);
    };
  }, [next]);

  const skip = () => {
    setTyping(false);
    setRevealed(ordered.length);
  };

  const currentRound = done
    ? negotiation.currentRound
    : Math.max(1, ordered[Math.max(0, revealed - 1)]?.payload.round ?? 1);

  const acceptHash =
    ordered.find((m) => m.payload.type === "ACCEPT")?.payload.termsHash ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Control strip: round counter, mask toggle, skip */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted">
          Round <span className="text-foreground">{currentRound}</span> /{" "}
          {negotiation.maxRounds}
        </span>
        <div className="flex items-center gap-2">
          {maskable && (
            <button
              type="button"
              onClick={() => setMasked((m) => !m)}
              className="sketch-pill ink border border-border-subtle bg-surface px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
            >
              {masked ? "Reveal amounts" : "Mask amounts"}
            </button>
          )}
          {!done && (
            <button
              type="button"
              onClick={skip}
              className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-strong transition-colors hover:bg-accent/20"
            >
              Skip to result
            </button>
          )}
        </div>
      </div>

      {/* Bubbles */}
      <div className="flex flex-col gap-4">
        {ordered.slice(0, revealed).map((message) => (
          <Bubble
            key={message.messageId}
            message={message}
            masked={masked}
            brandAgentId={brandAgentId}
            creatorAgentId={creatorAgentId}
          />
        ))}

        <AnimatePresence>
          {typing && next && (
            <TypingIndicator
              key={`typing-${next.messageId}`}
              side={sideOf(next)}
              agentId={sideOf(next) === "brand" ? brandAgentId : creatorAgentId}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Outcome */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {negotiation.status === "AGREED" ? (
              <TermSheetCard
                terms={negotiation.currentTerms}
                termsHash={acceptHash}
                masked={masked}
              />
            ) : (
              <section className="sketch ink border border-border-subtle bg-surface p-5 text-sm text-muted">
                Negotiation ended{" "}
                <span className="font-mono text-xs uppercase text-negative">
                  {negotiation.status}
                </span>{" "}
                after round {negotiation.currentRound} of {negotiation.maxRounds}.
                No term sheet was produced.
              </section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Bubble({
  message,
  masked,
  brandAgentId,
  creatorAgentId,
}: {
  message: NegotiationMessage;
  masked: boolean;
  brandAgentId: string;
  creatorAgentId: string;
}) {
  const side = sideOf(message);
  const brandSide = side === "brand";
  const { payload } = message;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex items-end gap-2.5 ${brandSide ? "justify-start" : "flex-row-reverse justify-start"}`}
    >
      <AgentAvatar
        agentId={brandSide ? brandAgentId : creatorAgentId}
        side={side}
        size="sm"
      />
      <div
        className={`max-w-[82%] sketch ink border border-border-subtle p-4 ${
          brandSide
            ? "rounded-bl-md bg-surface"
            : "rounded-br-md bg-surface-raised"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-muted">
            {brandSide ? "Brand agent" : "Creator agent"}
          </span>
          <span
            className={`rounded-full border px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wide ${TYPE_BADGE[payload.type]}`}
          >
            {payload.type}
          </span>
          <span className="font-mono text-muted">round {payload.round}</span>
        </div>

        {/* The offer on the table */}
        <div className="font-mono text-sm">
          <MaskedAmount masked={masked}>
            {usdc(payload.terms.compensation.baseAmountUsdc)}
          </MaskedAmount>{" "}
          base
          {payload.terms.compensation.performancePct > 0 && (
            <span className="text-muted">
              {" "}
              + {payload.terms.compensation.performancePct}% performance
            </span>
          )}
        </div>

        {/* Rationale is the spoken line */}
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">
          &ldquo;{payload.rationale}&rdquo;
        </p>

        {/* Terms-diff chips */}
        {payload.changedFields.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {payload.changedFields.map((field) => (
              <span
                key={field}
                className="rounded border border-caution/20 bg-caution/10 px-1.5 py-0.5 font-mono text-[10px] text-caution"
              >
                Δ {field}
              </span>
            ))}
          </div>
        )}

        {payload.termsHash && (
          <div className="mt-2.5 truncate font-mono text-[10px] text-positive">
            {payload.termsHash}
          </div>
        )}

        <div
          className={`mt-2 text-[10px] text-muted ${brandSide ? "text-left" : "text-right"}`}
        >
          {formatDateTime(message.createdAt)}
        </div>
      </div>
    </motion.div>
  );
}

function TypingIndicator({ side, agentId }: { side: AgentSide; agentId: string }) {
  const brandSide = side === "brand";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      className={`flex items-end gap-2.5 ${brandSide ? "justify-start" : "flex-row-reverse justify-start"}`}
    >
      <AgentAvatar agentId={agentId} side={side} size="sm" />
      <div
        className={`flex items-center gap-1 sketch ink border border-border-subtle px-4 py-3 ${
          brandSide
            ? "rounded-bl-md bg-surface"
            : "rounded-br-md bg-surface-raised"
        }`}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </div>
    </motion.div>
  );
}
