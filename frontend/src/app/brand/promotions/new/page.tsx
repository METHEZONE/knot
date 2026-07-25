"use client";

/**
 * Promotion wizard: basics -> budget -> deliverables + window ->
 * rights + constraints -> autonomy dials.
 *
 * Validates against the API contract client-side (integer USDC amounts,
 * maxNegotiationRounds <= 5) and posts via the provider's createPromotion.
 * Server-side RFC 7807 violations are mapped back onto fields.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import type { PromotionCreateRequest, UsageRights } from "@/lib/api/types";
import { useToast } from "@/components/ToastProvider";

const STEPS = [
  "Basics",
  "Budget",
  "Deliverables & window",
  "Rights & constraints",
  "Autonomy",
] as const;

const FORMAT_OPTIONS = [
  "instagramReel",
  "instagramStory",
  "instagramPost",
  "tiktokVideo",
  "youtubeShort",
  "youtubeVideo",
] as const;

const RIGHTS_OPTIONS: {
  value: UsageRights;
  label: string;
  description: string;
}[] = [
  {
    value: "organicOnly",
    label: "Organic only",
    description:
      "The creator posts on their own channels. You may not re-run the content as paid ads.",
  },
  {
    value: "paidBoost30d",
    label: "Paid boost · 30 days",
    description:
      "You may boost the creator's posts as paid ads for 30 days after posting.",
  },
  {
    value: "fullLicense90d",
    label: "Full license · 90 days",
    description:
      "You may reuse the content across your own channels and ads for 90 days.",
  },
];

interface DeliverableDraft {
  format: string;
  count: string;
}

/** Strict non-negative integer parse: "650" -> 650, "6.5"/"-1"/"" -> null. */
function parseIntStrict(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Which wizard step owns a (violation) field path. */
function stepForField(field: string): number {
  if (field.startsWith("budget")) return 1;
  if (field.startsWith("deliverables") || field.startsWith("postingWindow"))
    return 2;
  if (field.startsWith("constraints") || field.startsWith("usageRights"))
    return 3;
  if (field.startsWith("autonomy")) return 4;
  return 0;
}

const inputCls =
  "w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export default function NewPromotionPage() {
  const router = useRouter();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 0 — basics
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");

  // Step 1 — budget
  const [totalUsdc, setTotalUsdc] = useState("");
  const [maxPerCreatorUsdc, setMaxPerCreatorUsdc] = useState("");

  // Step 2 — deliverables + window
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([
    { format: "instagramReel", count: "1" },
  ]);
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");

  // Step 3 — rights + constraints
  const [usageRights, setUsageRights] = useState<UsageRights>("organicOnly");
  const [requiredDisclosures, setRequiredDisclosures] = useState("#ad");
  const [prohibitedClaims, setProhibitedClaims] = useState("");
  const [requiredCategories, setRequiredCategories] = useState("");
  const [prohibitedCategories, setProhibitedCategories] = useState("");
  const [maxPerformancePct, setMaxPerformancePct] = useState("10");

  // Step 4 — autonomy
  const [maxRounds, setMaxRounds] = useState(3);
  const [autoEscrow, setAutoEscrow] = useState(true);
  const [autoRelease, setAutoRelease] = useState(false);

  function validateStep(s: number): Record<string, string> {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!title.trim()) errs["title"] = "Title is required.";
      if (!objective.trim()) errs["objective"] = "Objective is required.";
      if (!category.trim()) errs["category"] = "Category is required.";
      if (splitTags(audience).length === 0)
        errs["targetAudience"] = "Add at least one audience tag.";
    }
    if (s === 1) {
      const total = parseIntStrict(totalUsdc);
      const cap = parseIntStrict(maxPerCreatorUsdc);
      if (total === null || total < 1)
        errs["budget.totalUsdc"] =
          "Whole-number USDC amount, at least 1. No decimals — the contract takes integers only.";
      if (cap === null || cap < 1)
        errs["budget.maxPerCreatorUsdc"] =
          "Whole-number USDC amount, at least 1. No decimals — the contract takes integers only.";
      if (total !== null && cap !== null && cap > total)
        errs["budget.maxPerCreatorUsdc"] =
          "Per-creator cap cannot exceed the total budget.";
    }
    if (s === 2) {
      if (deliverables.length === 0)
        errs["deliverables"] = "Add at least one deliverable.";
      deliverables.forEach((d, i) => {
        if (!d.format.trim())
          errs[`deliverables.${i}.format`] = "Pick a format.";
        const count = parseIntStrict(d.count);
        if (count === null || count < 1)
          errs[`deliverables.${i}.count`] = "Whole number, at least 1.";
      });
      if (!windowStart) errs["postingWindow.start"] = "Start date is required.";
      if (!windowEnd) errs["postingWindow.end"] = "End date is required.";
      if (windowStart && windowEnd && windowStart >= windowEnd)
        errs["postingWindow.end"] = "End must be after start.";
    }
    if (s === 3) {
      const pct = parseIntStrict(maxPerformancePct);
      if (pct === null || pct > 100)
        errs["constraints.maxPerformancePct"] =
          "Whole percent between 0 and 100.";
    }
    if (s === 4) {
      if (!Number.isInteger(maxRounds) || maxRounds < 1 || maxRounds > 5)
        errs["autonomy.maxNegotiationRounds"] =
          "Between 1 and 5 rounds — the contract caps negotiation at 5.";
    }
    return errs;
  }

  function goNext() {
    const errs = validateStep(step);
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep((s) => s + 1);
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }

  function buildBody(): PromotionCreateRequest {
    return {
      title: title.trim(),
      objective: objective.trim(),
      category: category.trim().toLowerCase(),
      targetAudience: splitTags(audience),
      budget: {
        totalUsdc: parseIntStrict(totalUsdc) ?? 0,
        maxPerCreatorUsdc: parseIntStrict(maxPerCreatorUsdc) ?? 0,
      },
      deliverables: deliverables.map((d) => ({
        format: d.format,
        count: parseIntStrict(d.count) ?? 0,
      })),
      postingWindow: {
        start: `${windowStart}T00:00:00Z`,
        end: `${windowEnd}T23:59:59Z`,
      },
      usageRights,
      constraints: {
        requiredDisclosures: splitTags(requiredDisclosures),
        prohibitedClaims: splitTags(prohibitedClaims),
        requiredCategories: splitTags(requiredCategories),
        prohibitedCategories: splitTags(prohibitedCategories),
        maxPerformancePct: parseIntStrict(maxPerformancePct) ?? 0,
      },
      autonomy: {
        maxNegotiationRounds: maxRounds,
        autoEscrow,
        autoRelease,
      },
    };
  }

  async function handleSubmit() {
    for (let s = 0; s < STEPS.length; s++) {
      const errs = validateStep(s);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        setStep(s);
        return;
      }
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { promotion } = await knotProvider.createPromotion(buildBody());
      toast.push({
        title: "Promotion created",
        body: `${promotion.title} is in ${promotion.status}. Activate it to let your agent start matching.`,
        tone: "positive",
      });
      router.push(`/promotions/${promotion.promotionId}`);
    } catch (error) {
      toast.pushProblem(error, "Could not create promotion");
      if (error instanceof ProblemError && error.violations?.length) {
        const errs: Record<string, string> = {};
        for (const v of error.violations) errs[v.field] = v.rule;
        setErrors(errs);
        setStep(stepForField(error.violations[0].field));
      }
      setSubmitting(false);
    }
  }

  const err = (field: string) =>
    errors[field] ? (
      <p className="mt-1 text-[11px] text-negative">{errors[field]}</p>
    ) : null;

  const totalParsed = parseIntStrict(totalUsdc);
  const capParsed = parseIntStrict(maxPerCreatorUsdc);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/brand"
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          ← Brand dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New Promotion
        </h1>
        <p className="mt-1 text-sm text-muted">
          Define the brief once. Your agent matches, negotiates, and settles
          inside these boundaries.
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1 rounded-full ${
                i < step
                  ? "bg-accent"
                  : i === step
                    ? "bg-accent-strong"
                    : "bg-surface-raised"
              }`}
            />
            <span
              className={`text-[10px] ${
                i === step ? "text-foreground" : "text-muted"
              }`}
            >
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="title" className={labelCls}>
                Title
              </label>
              <input
                id="title"
                className={inputCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summer Skincare Launch"
              />
              {err("title")}
            </div>
            <div>
              <label htmlFor="objective" className={labelCls}>
                Objective
              </label>
              <textarea
                id="objective"
                className={`${inputCls} min-h-20 resize-y`}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="What should this Promotion achieve? Your agent uses this to brief creators."
              />
              {err("objective")}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="category" className={labelCls}>
                  Category
                </label>
                <input
                  id="category"
                  className={inputCls}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="beauty"
                />
                {err("category")}
              </div>
              <div>
                <label htmlFor="audience" className={labelCls}>
                  Target audience (comma-separated)
                </label>
                <input
                  id="audience"
                  className={inputCls}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="18-34, skincare enthusiasts, US"
                />
                {err("targetAudience")}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="totalUsdc" className={labelCls}>
                  Total budget (USDC, whole number)
                </label>
                <input
                  id="totalUsdc"
                  className={`${inputCls} font-mono`}
                  inputMode="numeric"
                  value={totalUsdc}
                  onChange={(e) => setTotalUsdc(e.target.value)}
                  placeholder="2000"
                />
                {err("budget.totalUsdc")}
              </div>
              <div>
                <label htmlFor="maxPerCreatorUsdc" className={labelCls}>
                  Max per creator (USDC, whole number)
                </label>
                <input
                  id="maxPerCreatorUsdc"
                  className={`${inputCls} font-mono`}
                  inputMode="numeric"
                  value={maxPerCreatorUsdc}
                  onChange={(e) => setMaxPerCreatorUsdc(e.target.value)}
                  placeholder="800"
                />
                {err("budget.maxPerCreatorUsdc")}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Amounts are integer USDC — the escrow contract has no fees and no
              decimals.
              {totalParsed !== null && capParsed !== null && capParsed <= totalParsed && (
                <>
                  {" "}
                  Your agent can engage up to{" "}
                  <span className="font-mono text-foreground">
                    {Math.floor(totalParsed / Math.max(capParsed, 1))}
                  </span>{" "}
                  creator{Math.floor(totalParsed / Math.max(capParsed, 1)) === 1 ? "" : "s"}{" "}
                  at the per-creator cap.
                </>
              )}
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={labelCls}>Deliverables</span>
                <button
                  type="button"
                  onClick={() =>
                    setDeliverables((prev) => [
                      ...prev,
                      { format: "instagramStory", count: "1" },
                    ])
                  }
                  className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-foreground"
                >
                  + Add deliverable
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {deliverables.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">
                      <select
                        aria-label={`Deliverable ${i + 1} format`}
                        className={inputCls}
                        value={d.format}
                        onChange={(e) =>
                          setDeliverables((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, format: e.target.value } : row,
                            ),
                          )
                        }
                      >
                        {FORMAT_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      {err(`deliverables.${i}.format`)}
                    </div>
                    <div className="w-24">
                      <input
                        aria-label={`Deliverable ${i + 1} count`}
                        className={`${inputCls} font-mono`}
                        inputMode="numeric"
                        value={d.count}
                        onChange={(e) =>
                          setDeliverables((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, count: e.target.value } : row,
                            ),
                          )
                        }
                        placeholder="1"
                      />
                      {err(`deliverables.${i}.count`)}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove deliverable ${i + 1}`}
                      disabled={deliverables.length === 1}
                      onClick={() =>
                        setDeliverables((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      className="mt-2 text-muted transition-colors hover:text-negative disabled:opacity-30"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {err("deliverables")}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="windowStart" className={labelCls}>
                  Posting window start
                </label>
                <input
                  id="windowStart"
                  type="date"
                  className={`${inputCls} font-mono [color-scheme:dark]`}
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                />
                {err("postingWindow.start")}
              </div>
              <div>
                <label htmlFor="windowEnd" className={labelCls}>
                  Posting window end
                </label>
                <input
                  id="windowEnd"
                  type="date"
                  className={`${inputCls} font-mono [color-scheme:dark]`}
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                />
                {err("postingWindow.end")}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <span className={labelCls}>Usage rights</span>
              <div className="mt-1 flex flex-col gap-2">
                {RIGHTS_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => setUsageRights(opt.value)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      usageRights === opt.value
                        ? "border-accent/60 bg-accent/10"
                        : "border-border-subtle bg-surface-raised hover:border-border-subtle/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="font-mono text-[10px] text-muted">
                        {opt.value}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{opt.description}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="requiredDisclosures" className={labelCls}>
                  Required disclosures (comma-separated)
                </label>
                <input
                  id="requiredDisclosures"
                  className={inputCls}
                  value={requiredDisclosures}
                  onChange={(e) => setRequiredDisclosures(e.target.value)}
                  placeholder="#ad, #sponsored"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Evidence verification fails posts missing these.
                </p>
              </div>
              <div>
                <label htmlFor="prohibitedClaims" className={labelCls}>
                  Prohibited claims (comma-separated)
                </label>
                <input
                  id="prohibitedClaims"
                  className={inputCls}
                  value={prohibitedClaims}
                  onChange={(e) => setProhibitedClaims(e.target.value)}
                  placeholder="treats skin conditions"
                />
              </div>
              <div>
                <label htmlFor="requiredCategories" className={labelCls}>
                  Required creator categories
                </label>
                <input
                  id="requiredCategories"
                  className={inputCls}
                  value={requiredCategories}
                  onChange={(e) => setRequiredCategories(e.target.value)}
                  placeholder="beauty"
                />
                <p className="mt-1 text-[11px] text-muted">
                  Hard filter — creators outside these are ineligible.
                </p>
              </div>
              <div>
                <label htmlFor="prohibitedCategories" className={labelCls}>
                  Prohibited creator categories
                </label>
                <input
                  id="prohibitedCategories"
                  className={inputCls}
                  value={prohibitedCategories}
                  onChange={(e) => setProhibitedCategories(e.target.value)}
                  placeholder="gambling, tobacco"
                />
              </div>
            </div>
            <div className="max-w-xs">
              <label htmlFor="maxPerformancePct" className={labelCls}>
                Max performance bonus (%)
              </label>
              <input
                id="maxPerformancePct"
                className={`${inputCls} font-mono`}
                inputMode="numeric"
                value={maxPerformancePct}
                onChange={(e) => setMaxPerformancePct(e.target.value)}
                placeholder="10"
              />
              {err("constraints.maxPerformancePct")}
              <p className="mt-1 text-[11px] text-muted">
                Ceiling on any performance-based component your agent may offer.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Max negotiation rounds
                </span>
                <span className="font-mono text-lg text-accent-strong">
                  {maxRounds}
                </span>
              </div>
              <input
                type="range"
                aria-label="Max negotiation rounds"
                min={1}
                max={5}
                step={1}
                value={maxRounds}
                onChange={(e) => setMaxRounds(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--accent)]"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Your agent can exchange up to {maxRounds} round
                {maxRounds === 1 ? "" : "s"} of offers and counters. If round{" "}
                {maxRounds} ends without agreement, the negotiation escalates to
                you instead of continuing. The contract hard-caps this at 5.
              </p>
              {err("autonomy.maxNegotiationRounds")}
            </div>

            <AutonomyDial
              label="Auto-escrow"
              checked={autoEscrow}
              onChange={setAutoEscrow}
              onText="The moment terms are agreed, USDC is locked into escrow automatically — funds are committed without a confirmation step from you."
              offText="You approve every escrow lock yourself. Nothing is committed until you press the button."
            />
            <AutonomyDial
              label="Auto-release"
              checked={autoRelease}
              onChange={setAutoRelease}
              onText="Milestone payments release to the creator automatically as soon as evidence passes verification — no manual review."
              offText="You review passed evidence and release each milestone payment yourself."
            />

            <div className="rounded-xl border border-dashed border-border-subtle p-4 text-xs leading-relaxed text-muted">
              <span className="font-medium text-foreground">Review:</span>{" "}
              {title.trim() || "Untitled"} ·{" "}
              <span className="font-mono">
                {totalParsed !== null ? totalParsed.toLocaleString("en-US") : "?"}{" "}
                USDC
              </span>{" "}
              total, max{" "}
              <span className="font-mono">
                {capParsed !== null ? capParsed.toLocaleString("en-US") : "?"} USDC
              </span>{" "}
              per creator · {deliverables.length} deliverable
              {deliverables.length === 1 ? "" : "s"} · {usageRights} ·{" "}
              {maxRounds} round{maxRounds === 1 ? "" : "s"} max ·{" "}
              {autoEscrow ? "auto-escrow" : "manual escrow"} ·{" "}
              {autoRelease ? "auto-release" : "manual release"}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || submitting}
          className="rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Promotion"}
          </button>
        )}
      </div>
    </div>
  );
}

function AutonomyDial({
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
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
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
