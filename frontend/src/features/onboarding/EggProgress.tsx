"use client";

/**
 * Onboarding progress shown as an egg warming up (PRD v2 §4).
 *
 * The fill rises with each completed step and hairline cracks appear on the
 * last one, so the hatching ceremony reads as the payoff of the form rather
 * than a separate screen. Decorative only — the step counter underneath is the
 * accessible progress signal.
 */

import { motion, useReducedMotion } from "framer-motion";

export function EggProgress({
  stepIndex,
  stepCount,
}: {
  stepIndex: number;
  stepCount: number;
}) {
  const reduced = useReducedMotion();
  const ratio = stepCount > 1 ? Math.min(1, stepIndex / (stepCount - 1)) : 1;
  const nearlyThere = ratio > 0.6;

  return (
    <div
      className="flex flex-col items-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={stepIndex + 1}
      aria-label="Onboarding progress"
    >
      <svg viewBox="0 0 64 84" width="64" height="84" aria-hidden="true" className="squig">
        <defs>
          <clipPath id="egg-clip">
            <path d="M32 4 C46 4 58 26 58 48 C58 68 46 80 32 80 C18 80 6 68 6 48 C6 26 18 4 32 4 Z" />
          </clipPath>
        </defs>

        {/* shell */}
        <path
          d="M32 4 C46 4 58 26 58 48 C58 68 46 80 32 80 C18 80 6 68 6 48 C6 26 18 4 32 4 Z"
          fill="var(--surface-raised)"
          stroke="var(--border)"
          strokeWidth="2.5"
        />

        {/* warmth rising inside */}
        <g clipPath="url(#egg-clip)">
          <motion.rect
            x="0"
            width="64"
            initial={false}
            animate={{ y: 80 - 76 * ratio, height: 76 * ratio + 4 }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            fill="var(--caution)"
            opacity="0.30"
          />
          <motion.rect
            x="0"
            width="64"
            height="3"
            initial={false}
            animate={{ y: 80 - 76 * ratio }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
            fill="var(--caution)"
            opacity="0.75"
          />
        </g>

        {/* hairline cracks on the home stretch */}
        {nearlyThere ? (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            stroke="var(--border)"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          >
            <path d="M24 34 l5 6 -4 5 6 4" />
            <path d="M40 46 l-4 5 5 5" />
          </motion.g>
        ) : null}

        {/* faint glow once the egg is basically ready */}
        {ratio >= 1 && !reduced ? (
          <motion.ellipse
            cx="32"
            cy="46"
            rx="14"
            ry="16"
            fill="var(--caution)"
            initial={{ opacity: 0.1 }}
            animate={{ opacity: [0.1, 0.32, 0.1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}
      </svg>

      <span className="font-mono text-[11px] text-muted">
        {stepIndex + 1} / {stepCount}
      </span>
    </div>
  );
}
