"use client";

/**
 * One decision per screen (PRD v2 §4: game-tutorial pacing).
 *
 * Every onboarding step renders inside this frame: the warming egg on the left
 * as progress, a single headline + one input group, and a footer that only ever
 * offers back and one way forward. Nothing else competes for attention.
 */

import { motion } from "framer-motion";
import { EggProgress } from "./EggProgress";

export function StepShell({
  stepIndex,
  stepCount,
  eyebrow,
  headline,
  hint,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  busy,
  footerNote,
}: {
  stepIndex: number;
  stepCount: number;
  eyebrow: string;
  headline: string;
  hint?: string;
  children: React.ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  footerNote?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-8 py-6 sm:grid-cols-[104px_1fr] sm:gap-10">
      <div className="flex justify-center sm:justify-start">
        <EggProgress stepIndex={stepIndex} stepCount={stepCount} />
      </div>

      <motion.div
        key={stepIndex}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="flex min-w-0 flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-wide text-accent">
            {eyebrow}
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {headline}
          </h1>
          {hint ? <p className="text-sm leading-relaxed text-muted">{hint}</p> : null}
        </div>

        <div className="flex flex-col gap-4">{children}</div>

        {(onBack || onNext) && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {onNext ? (
              <button
                type="button"
                onClick={onNext}
                disabled={nextDisabled || busy}
                className="sketch-pill bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Working…" : nextLabel}
              </button>
            ) : null}
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                disabled={busy}
                className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40"
              >
                Back
              </button>
            ) : null}
            {footerNote ? (
              <div className="w-full text-xs text-muted sm:w-auto">{footerNote}</div>
            ) : null}
          </div>
        )}
      </motion.div>
    </div>
  );
}
