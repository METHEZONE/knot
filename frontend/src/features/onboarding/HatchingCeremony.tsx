"use client";

/**
 * The hatching ceremony (PRD v2 §4 step 4 / §5 step 3).
 *
 * Scripted beats: the egg cracks, the manager walks up to the door, knocks,
 * steps in, bows, greets by name, then signs the policy mandate while the
 * policy JSON scrolls behind the signature line. That last beat is the point of
 * the whole scene — it is the autonomy mandate made visible, so the JSON shown
 * is the real policy the engine will enforce, not decoration.
 *
 * Skippable, and with prefers-reduced-motion the same beats play compressed
 * with no walking (PRD v2 §13).
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AgentCharacter, type AgentPose } from "@/components/AgentCharacter";
import { agentRoleLine, agentTraits, type AgentSide } from "@/lib/agentIdentity";

type Beat =
  | "egg"
  | "crack"
  | "emerge"
  | "walk"
  | "knock"
  | "enter"
  | "bow"
  | "greet"
  | "sign"
  | "done";

const SCRIPT: { beat: Beat; ms: number }[] = [
  { beat: "egg", ms: 900 },
  { beat: "crack", ms: 700 },
  { beat: "emerge", ms: 700 },
  { beat: "walk", ms: 1400 },
  { beat: "knock", ms: 1000 },
  { beat: "enter", ms: 700 },
  { beat: "bow", ms: 700 },
  { beat: "greet", ms: 1600 },
  { beat: "sign", ms: 2400 },
  { beat: "done", ms: 0 },
];

const POSE_FOR: Partial<Record<Beat, AgentPose>> = {
  emerge: "idle",
  walk: "walk",
  knock: "knock",
  enter: "idle",
  bow: "bow",
  greet: "greet",
  sign: "idle",
  done: "idle",
};

/** Where the character stands, as a % of the stage width, per beat. */
const X_FOR: Partial<Record<Beat, number>> = {
  emerge: 8,
  walk: 52,
  knock: 58,
  enter: 62,
  bow: 62,
  greet: 62,
  sign: 62,
  done: 62,
};

export function HatchingCeremony({
  agentId,
  side,
  category,
  agentName,
  policyJson,
  onDone,
  doneLabel = "Continue",
}: {
  agentId: string;
  side: AgentSide;
  category?: string;
  agentName: string;
  policyJson: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const reduced = useReducedMotion();
  const traits = useMemo(() => agentTraits(agentId, side, category), [agentId, side, category]);
  const [index, setIndex] = useState(0);
  const beat = SCRIPT[index].beat;

  useEffect(() => {
    if (beat === "done") return;
    // Reduced motion keeps the narrative but compresses it and skips the walk.
    const scale = reduced ? 0.35 : 1;
    const ms = SCRIPT[index].ms * scale;
    const timer = window.setTimeout(
      () => setIndex((i) => Math.min(i + 1, SCRIPT.length - 1)),
      Math.max(120, ms),
    );
    return () => window.clearTimeout(timer);
  }, [index, beat, reduced]);

  const visible = beat !== "egg" && beat !== "crack";
  const atDoor = beat === "knock" || beat === "enter";
  const doorOpen = beat === "enter" || beat === "bow" || beat === "greet" || beat === "sign" || beat === "done";
  const signing = beat === "sign" || beat === "done";

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------------------------------------------------------- stage */}
      <div className="sketch ink relative h-[260px] overflow-hidden border border-border-subtle bg-surface sm:h-[300px]">
        {/* floor */}
        <div className="absolute inset-x-0 bottom-14 h-px bg-border-subtle" />

        {/* door on the right */}
        <div className="absolute bottom-14 right-[10%] flex flex-col items-center">
          <motion.div
            className="relative h-[120px] w-[74px] origin-left rounded-t-md border-2 border-b-0"
            style={{ borderColor: traits.ink, background: "var(--surface-raised)" }}
            initial={false}
            animate={{ rotateY: doorOpen ? -62 : 0, opacity: doorOpen ? 0.55 : 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <span
              className="absolute right-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
              style={{ background: traits.ink }}
            />
          </motion.div>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted">
            {side === "brand" ? "your brand" : "your studio"}
          </span>
        </div>

        {/* knock ripples */}
        <AnimatePresence>
          {atDoor && !reduced ? (
            <motion.div
              key="knock-ripple"
              className="absolute bottom-[128px] right-[19%] h-8 w-8 rounded-full border-2"
              style={{ borderColor: traits.ink }}
              initial={{ opacity: 0.7, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.8 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, repeat: Infinity }}
            />
          ) : null}
        </AnimatePresence>

        {/* the egg, until it cracks */}
        <AnimatePresence>
          {!visible ? (
            <motion.div
              key="egg"
              className="absolute bottom-14 left-[8%] -translate-x-1/2"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={
                beat === "crack"
                  ? { opacity: [1, 1, 0], scale: [1, 1.14, 1.3], rotate: 0 }
                  : { opacity: 1, scale: 1, rotate: reduced ? 0 : [-4, 4, -4] }
              }
              exit={{ opacity: 0, scale: 1.4 }}
              transition={
                beat === "crack"
                  ? { duration: 0.6 }
                  : { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <svg viewBox="0 0 64 84" width="76" height="100" aria-hidden="true" className="squig">
                <path
                  d="M32 4 C46 4 58 26 58 48 C58 68 46 80 32 80 C18 80 6 68 6 48 C6 26 18 4 32 4 Z"
                  fill="var(--surface-raised)"
                  stroke={traits.ink}
                  strokeWidth="2.4"
                />
                {beat === "crack" ? (
                  <g stroke={traits.ink} strokeWidth="2" fill="none" strokeLinecap="round">
                    <path d="M18 40 l8 8 -6 8 9 7" />
                    <path d="M44 34 l-7 9 6 7 -8 8" />
                  </g>
                ) : null}
              </svg>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* the manager */}
        <AnimatePresence>
          {visible ? (
            <motion.div
              key="agent"
              className="absolute bottom-8"
              initial={{ opacity: 0, scale: 0.7, left: `${X_FOR.emerge}%` }}
              animate={{
                opacity: 1,
                scale: 1,
                left: `${(reduced && beat === "walk" ? X_FOR.knock : X_FOR[beat]) ?? 62}%`,
              }}
              transition={{
                left: { duration: reduced ? 0.2 : beat === "walk" ? 1.3 : 0.5, ease: "easeInOut" },
                opacity: { duration: 0.4 },
                scale: { type: "spring", stiffness: 150, damping: 14 },
              }}
              style={{ translateX: "-50%" }}
            >
              <AgentCharacter
                agentId={agentId}
                side={side}
                category={category}
                pose={POSE_FOR[beat] ?? "idle"}
                size={112}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* greeting bubble */}
        <AnimatePresence>
          {beat === "greet" || beat === "sign" || beat === "done" ? (
            <motion.div
              key="greeting"
              className="sketch-alt ink absolute left-1/2 top-6 max-w-[280px] -translate-x-1/2 border px-4 py-2.5 text-center text-sm"
              style={{ borderColor: traits.ink, background: "var(--surface-raised)" }}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 16 }}
            >
              <span className="font-medium">Hi — I&apos;m {agentName}.</span>{" "}
              <span className="text-muted">
                {side === "brand"
                  ? "I'll find creators and close deals inside the limits you set."
                  : "I'll screen offers and negotiate for you inside the limits you set."}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {beat !== "done" ? (
          <button
            type="button"
            onClick={() => setIndex(SCRIPT.length - 1)}
            className="absolute bottom-3 right-3 sketch-pill ink border border-border-subtle bg-surface-raised px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            Skip
          </button>
        ) : null}
      </div>

      {/* ------------------------------------------------------- signing beat */}
      <AnimatePresence>
        {signing ? (
          <motion.div
            key="mandate"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="sketch ink border border-border-subtle bg-surface p-5"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold">Autonomy mandate</h2>
              <span className="font-mono text-[11px] text-muted">
                {agentName} signs · policyVersion 1
              </span>
            </div>

            {/* policy JSON scrolling behind the signature line */}
            <div className="sketch-alt relative h-[132px] overflow-hidden border-2 border-border-subtle bg-surface-raised px-4 py-3">
              <motion.pre
                className="whitespace-pre font-mono text-[11px] leading-[1.45] text-muted"
                initial={{ y: 0 }}
                animate={{ y: reduced ? 0 : -120 }}
                transition={{ duration: reduced ? 0 : 5, ease: "linear" }}
              >
                {policyJson}
              </motion.pre>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface-raised to-transparent" />

              {/* signature line + signature */}
              <div className="absolute inset-x-4 bottom-4">
                <svg viewBox="0 0 240 34" className="h-9 w-full" aria-hidden="true">
                  <path d="M4 30 H236" stroke="var(--border)" strokeWidth="1.5" />
                  <motion.path
                    d="M14 26 C26 8 34 30 44 18 C52 8 58 28 70 20 C82 12 88 30 102 22 C112 16 118 26 132 18"
                    stroke={traits.ink}
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: reduced ? 0.3 : 1.5, ease: "easeInOut", delay: 0.3 }}
                  />
                </svg>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <motion.span
                initial={{ opacity: 0, scale: 1.8, rotate: 12 }}
                animate={{ opacity: 1, scale: 1, rotate: -3 }}
                transition={{ delay: reduced ? 0.2 : 1.6, type: "spring", stiffness: 220, damping: 14 }}
                className="sketch-pill border-2 border-positive px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-positive"
              >
                signed
              </motion.span>
              <p className="text-xs text-muted">
                Your agent may act on its own only inside these limits. Change them
                any time — the agent re-signs.
              </p>
            </div>

            {beat === "done" ? (
              <motion.button
                type="button"
                onClick={onDone}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 sketch-pill bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {doneLabel}
              </motion.button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!signing ? (
        <p className="text-center text-sm text-muted">
          {beat === "egg" || beat === "crack"
            ? "Your manager is hatching…"
            : beat === "walk"
              ? `${agentRoleLine(traits)} is on the way.`
              : beat === "knock"
                ? "Knock, knock."
                : "Say hello."}
        </p>
      ) : null}
    </div>
  );
}
