"use client";

/**
 * Autonomy dials (PRD v2 §5 step 3) — the screen where a human hands spending
 * authority to their brand agent. Every dial carries a plain-language
 * consequence line, written in second person and driven by the live value,
 * directly underneath it. These are the exact fields `brandAgentPolicy` reads
 * into the signed mandate — nothing here is decorative.
 */

import type { UsageRights } from "@/lib/api/types";
import { USAGE_RIGHTS_LADDER } from "@/lib/onboardingPolicy";
import { usdc } from "@/lib/format";

export interface AutonomyDialsValue {
  totalUsdc: string;
  maxPerCreatorUsdc: string;
  autoApproveCapUsdc: string;
  maxNegotiationRounds: number;
  autoEscrow: boolean;
  autoRelease: boolean;
  usageRights: UsageRights;
  blockedCategories: string[];
}

export const AUTONOMY_DIALS_DEFAULT: AutonomyDialsValue = {
  totalUsdc: "2000",
  maxPerCreatorUsdc: "800",
  autoApproveCapUsdc: "800",
  maxNegotiationRounds: 5,
  autoEscrow: true,
  autoRelease: false,
  usageRights: "organicOnly",
  blockedCategories: ["gambling", "tobacco"],
};

const BLOCKED_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "gambling", label: "Gambling" },
  { value: "tobacco", label: "Tobacco" },
  { value: "alcohol", label: "Alcohol" },
  { value: "adult", label: "Adult content" },
  { value: "cryptoTrading", label: "Crypto trading" },
];

const USAGE_RIGHTS_COPY: Record<
  UsageRights,
  { label: string; description: string }
> = {
  organicOnly: {
    label: "Organic only",
    description:
      "Creators post on their own channels. Your agent may not re-run the content as paid ads.",
  },
  paidBoost30d: {
    label: "Paid boost · 30 days",
    description:
      "Your agent may boost creator posts as paid ads for 30 days after they go live.",
  },
  fullLicense90d: {
    label: "Full license · 90 days",
    description:
      "Your agent may reuse creator content across your own channels and ads for 90 days.",
  },
};

/** Strict non-negative integer parse: "800" -> 800, "8.0"/"-1"/"" -> null. */
function parseIntStrict(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function validateAutonomyDials(
  value: AutonomyDialsValue,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const total = parseIntStrict(value.totalUsdc);
  const perCreator = parseIntStrict(value.maxPerCreatorUsdc);
  const autoApprove = parseIntStrict(value.autoApproveCapUsdc);

  if (total === null || total < 1) {
    errors.totalUsdc = "Whole-number USDC, at least 1. No decimals.";
  }
  if (perCreator === null || perCreator < 1) {
    errors.maxPerCreatorUsdc = "Whole-number USDC, at least 1. No decimals.";
  }
  if (autoApprove === null || autoApprove < 1) {
    errors.autoApproveCapUsdc = "Whole-number USDC, at least 1. No decimals.";
  }
  if (
    total !== null &&
    perCreator !== null &&
    perCreator > total &&
    !errors.maxPerCreatorUsdc
  ) {
    errors.maxPerCreatorUsdc = "Per-creator cap cannot exceed the total budget.";
  }
  if (
    perCreator !== null &&
    autoApprove !== null &&
    autoApprove > perCreator &&
    !errors.autoApproveCapUsdc
  ) {
    errors.autoApproveCapUsdc =
      "Auto-approve cap cannot exceed the per-creator cap.";
  }
  if (
    !Number.isInteger(value.maxNegotiationRounds) ||
    value.maxNegotiationRounds < 1 ||
    value.maxNegotiationRounds > 5
  ) {
    errors.maxNegotiationRounds =
      "Between 1 and 5 rounds — the contract caps negotiation at 5.";
  }
  return errors;
}

/** The request fields these dials feed, parsed to the contract's integer shape. */
export function parseAutonomyDials(value: AutonomyDialsValue) {
  return {
    budget: {
      totalUsdc: parseIntStrict(value.totalUsdc) ?? 0,
      maxPerCreatorUsdc: parseIntStrict(value.maxPerCreatorUsdc) ?? 0,
    },
    autonomy: {
      maxNegotiationRounds: value.maxNegotiationRounds,
      autoEscrow: value.autoEscrow,
      autoRelease: value.autoRelease,
      autoApproveCapUsdc: parseIntStrict(value.autoApproveCapUsdc) ?? 0,
    },
    usageRights: value.usageRights,
    blockedCategories: value.blockedCategories,
  };
}

const inputCls =
  "w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export function AutonomyDials({
  value,
  onChange,
}: {
  value: AutonomyDialsValue;
  onChange: (next: AutonomyDialsValue) => void;
}) {
  const errors = validateAutonomyDials(value);
  const total = parseIntStrict(value.totalUsdc);
  const perCreator = parseIntStrict(value.maxPerCreatorUsdc);
  const autoApprove = parseIntStrict(value.autoApproveCapUsdc);

  function set<K extends keyof AutonomyDialsValue>(
    key: K,
    next: AutonomyDialsValue[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  function toggleBlockedCategory(category: string) {
    const has = value.blockedCategories.includes(category);
    set(
      "blockedCategories",
      has
        ? value.blockedCategories.filter((c) => c !== category)
        : [...value.blockedCategories, category],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dial-total" className={labelCls}>
            Total budget (USDC)
          </label>
          <input
            id="dial-total"
            className={`${inputCls} font-mono`}
            inputMode="numeric"
            value={value.totalUsdc}
            onChange={(e) => set("totalUsdc", e.target.value)}
            placeholder="2000"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Across all deals in one Promotion your agent may commit at most{" "}
            <span className="font-mono text-foreground">
              {total !== null ? usdc(total) : value.totalUsdc || "?"}
            </span>
            .
          </p>
          {errors.totalUsdc && (
            <p className="mt-1 text-[11px] text-negative">{errors.totalUsdc}</p>
          )}
        </div>

        <div>
          <label htmlFor="dial-per-creator" className={labelCls}>
            Max per creator (USDC)
          </label>
          <input
            id="dial-per-creator"
            className={`${inputCls} font-mono`}
            inputMode="numeric"
            value={value.maxPerCreatorUsdc}
            onChange={(e) => set("maxPerCreatorUsdc", e.target.value)}
            placeholder="800"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            No single creator can be paid more than{" "}
            <span className="font-mono text-foreground">
              {perCreator !== null ? usdc(perCreator) : value.maxPerCreatorUsdc || "?"}
            </span>
            .
          </p>
          {errors.maxPerCreatorUsdc && (
            <p className="mt-1 text-[11px] text-negative">
              {errors.maxPerCreatorUsdc}
            </p>
          )}
        </div>
      </div>

      <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
        <label htmlFor="dial-auto-approve" className={labelCls}>
          Auto-approve cap (USDC)
        </label>
        <input
          id="dial-auto-approve"
          className={`${inputCls} font-mono`}
          inputMode="numeric"
          value={value.autoApproveCapUsdc}
          onChange={(e) => set("autoApproveCapUsdc", e.target.value)}
          placeholder="800"
        />
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Your agent may commit up to{" "}
          <span className="font-mono text-foreground">
            {autoApprove !== null ? usdc(autoApprove) : value.autoApproveCapUsdc || "?"}
          </span>{" "}
          on one deal <strong className="text-foreground">without asking you</strong>.
          Above that it stops and waits for you.
        </p>
        {errors.autoApproveCapUsdc && (
          <p className="mt-1 text-[11px] text-negative">
            {errors.autoApproveCapUsdc}
          </p>
        )}
      </div>

      <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Max negotiation rounds</span>
          <span className="font-mono text-lg text-accent-strong">
            {value.maxNegotiationRounds}
          </span>
        </div>
        <input
          type="range"
          aria-label="Max negotiation rounds"
          min={1}
          max={5}
          step={1}
          value={value.maxNegotiationRounds}
          onChange={(e) => set("maxNegotiationRounds", Number(e.target.value))}
          className="mt-3 w-full accent-[var(--accent)]"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Your agent will walk away after {value.maxNegotiationRounds} round
          {value.maxNegotiationRounds === 1 ? "" : "s"} rather than keep
          bidding.
        </p>
        {errors.maxNegotiationRounds && (
          <p className="mt-1 text-[11px] text-negative">
            {errors.maxNegotiationRounds}
          </p>
        )}
      </div>

      <Toggle
        label="Auto-escrow"
        checked={value.autoEscrow}
        onChange={(next) => set("autoEscrow", next)}
        onText="When terms are agreed, your agent locks the USDC in escrow on its own."
        offText="You approve every escrow lock yourself — nothing is committed until you press the button."
      />
      <Toggle
        label="Auto-release"
        checked={value.autoRelease}
        onChange={(next) => set("autoRelease", next)}
        onText="Verified milestones pay out with no click from you."
        offText="Milestone payouts still wait for your approval."
      />

      <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
        <span className={labelCls}>Usage rights</span>
        <div className="mt-1 flex flex-col gap-2">
          {USAGE_RIGHTS_LADDER.map((right) => (
            <button
              type="button"
              key={right}
              onClick={() => set("usageRights", right)}
              className={`sketch-alt ink border p-3 text-left transition-colors ${
                value.usageRights === right
                  ? "border-accent/60 bg-accent/10"
                  : "border-border-subtle bg-surface hover:border-border-subtle/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {USAGE_RIGHTS_COPY[right].label}
                </span>
                <span className="font-mono text-[10px] text-muted">{right}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {USAGE_RIGHTS_COPY[right].description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
        <span className={labelCls}>Blocked categories</span>
        <p className="mt-0.5 text-xs text-muted">
          Your agent will never match with or negotiate for creators in these
          categories.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BLOCKED_CATEGORY_OPTIONS.map((opt) => {
            const active = value.blockedCategories.includes(opt.value);
            return (
              <button
                type="button"
                key={opt.value}
                aria-pressed={active}
                onClick={() => toggleBlockedCategory(opt.value)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-accent/60 bg-accent/10 text-accent-strong"
                    : "border-border-subtle bg-surface text-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  onText,
  offText,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  onText: string;
  offText: string;
}) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            checked ? "bg-accent" : "bg-border-subtle"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${
              checked ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        {checked ? onText : offText}
      </p>
    </div>
  );
}
