"use client";

/**
 * Creator "hatch your manager" onboarding (PRD v2 §4).
 *
 * Five screens, one decision each, staged inside `StepShell`'s warming-egg
 * frame: connect socials -> diagnosis -> rate card & rules -> hatching
 * ceremony -> wallet. The rate card step previews the exact mandate JSON the
 * agent signs in the next step, so nothing in the ceremony is a surprise.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepShell } from "@/features/onboarding/StepShell";
import { HatchingCeremony } from "@/features/onboarding/HatchingCeremony";
import { CreatorDiagnosisCard } from "@/features/onboarding/CreatorDiagnosisCard";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import { DEMO_SEEDS, persistDemoRole } from "@/lib/demoSession";
import {
  creatorAgentPolicy,
  mandateJson,
  USAGE_RIGHTS_LADDER,
} from "@/lib/onboardingPolicy";
import type {
  CreatorDiagnosisV1,
  CreatorOnboardRequest,
  CreatorOnboardResult,
  SocialHandle,
  SocialPlatform,
  UsageRights,
} from "@/lib/api/types";

const STEP_COUNT = 5;
const CREATOR_ID = DEMO_SEEDS.creator.creatorId;

const BLOCKED_INDUSTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "gambling", label: "Gambling" },
  { value: "cryptoTrading", label: "Crypto trading" },
  { value: "alcohol", label: "Alcohol" },
  { value: "tobacco", label: "Tobacco" },
  { value: "adult", label: "Adult" },
];

const USAGE_RIGHTS_LABEL: Record<UsageRights, string> = {
  organicOnly:
    "Organic only — the post stays on your feed, no ad spend behind it",
  paidBoost30d: "Paid boost, 30 days",
  fullLicense90d: "Full license, 90 days",
};

interface HandleInputs {
  instagram: string;
  youtube: string;
  x: string;
  tiktok: string;
}

interface WizardForm {
  handles: HandleInputs;
  minUsdc: string;
  maxUsdc: string;
  blockedIndustries: string[];
  monthlyCapacity: string;
  leadTimeDays: string;
  usageRights: UsageRights;
}

const INITIAL_FORM: WizardForm = {
  handles: { instagram: "@demobeauty", youtube: "", x: "", tiktok: "" },
  minUsdc: "",
  maxUsdc: "",
  blockedIndustries: ["gambling", "cryptoTrading"],
  monthlyCapacity: "4",
  leadTimeDays: "5",
  usageRights: "organicOnly",
};

/** Strict non-negative integer parse: "650" -> 650, "6.5"/"-1"/"" -> null. */
function parseIntStrict(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

function buildHandles(handles: HandleInputs): SocialHandle[] {
  const entries: [SocialPlatform, string][] = [
    ["instagram", handles.instagram],
    ["youtube", handles.youtube],
    ["x", handles.x],
    ["tiktok", handles.tiktok],
  ];
  return entries
    .filter(([, handle]) => handle.trim().length > 0)
    .map(([platform, handle]) => ({ platform, handle: handle.trim() }));
}

function buildOnboardRequest(form: WizardForm): CreatorOnboardRequest {
  return {
    handles: buildHandles(form.handles),
    rateCard: {
      minUsdc: parseIntStrict(form.minUsdc) ?? 0,
      maxUsdc: parseIntStrict(form.maxUsdc) ?? 0,
    },
    blockedIndustries: form.blockedIndustries,
    monthlyCapacity: parseIntStrict(form.monthlyCapacity) ?? 0,
    leadTimeDays: parseIntStrict(form.leadTimeDays) ?? 0,
    usageRights: form.usageRights,
    walletAddress: null,
  };
}

/** null when valid, otherwise the reason Continue is blocked. */
function rateCardIssue(form: WizardForm): string | null {
  const min = parseIntStrict(form.minUsdc);
  const max = parseIntStrict(form.maxUsdc);
  if (min === null || min <= 0) {
    return "Minimum rate must be a whole number greater than 0.";
  }
  if (max === null) return "Maximum rate must be a whole number.";
  if (min > max) return "Minimum rate cannot be greater than the maximum.";
  if (parseIntStrict(form.monthlyCapacity) === null) {
    return "Monthly capacity must be a whole number.";
  }
  if (parseIntStrict(form.leadTimeDays) === null) {
    return "Lead time must be a whole number of days.";
  }
  return null;
}

function problemMessage(error: unknown, fallback: string): string {
  return error instanceof ProblemError ? error.detail : fallback;
}

const inputCls =
  "w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-muted";

export default function CreatorOnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM);

  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<CreatorDiagnosisV1 | null>(null);

  const [hatchBusy, setHatchBusy] = useState(false);
  const [hatchError, setHatchError] = useState<string | null>(null);
  const [onboardResult, setOnboardResult] =
    useState<CreatorOnboardResult | null>(null);
  const onboardStartedRef = useRef(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    persistDemoRole("creator");
  }, []);

  const hasAtLeastOneHandle = buildHandles(form.handles).length > 0;

  async function handleConnectSocials() {
    const handles = buildHandles(form.handles);
    if (handles.length === 0) return;
    setIngestBusy(true);
    setIngestError(null);
    try {
      await knotProvider.submitCreatorIngest(CREATOR_ID, { handles });
      const { diagnosis: result } =
        await knotProvider.getCreatorDiagnosis(CREATOR_ID);
      setDiagnosis(result);
      setForm((f) => ({
        ...f,
        minUsdc: String(result.suggestedRateBand.minUsdc),
        maxUsdc: String(result.suggestedRateBand.maxUsdc),
      }));
      setStep(1);
    } catch (error) {
      setIngestError(
        problemMessage(
          error,
          "Couldn't reach your accounts just now. Try again.",
        ),
      );
    } finally {
      setIngestBusy(false);
    }
  }

  const startHatching = useCallback(() => {
    setHatchBusy(true);
    setHatchError(null);
    knotProvider
      .onboardCreator(buildOnboardRequest(form))
      .then((res) => setOnboardResult(res.creator))
      .catch((error) => {
        setHatchError(
          problemMessage(error, "Couldn't hatch your agent. Try again."),
        );
      })
      .finally(() => setHatchBusy(false));
  }, [form]);

  useEffect(() => {
    if (step !== 3 || onboardStartedRef.current) return;
    onboardStartedRef.current = true;
    startHatching();
  }, [step, startHatching]);

  function toggleBlockedIndustry(value: string) {
    setForm((f) => ({
      ...f,
      blockedIndustries: f.blockedIndustries.includes(value)
        ? f.blockedIndustries.filter((v) => v !== value)
        : [...f.blockedIndustries, value],
    }));
  }

  const issue = rateCardIssue(form);
  const previewJson = useMemo(
    () =>
      mandateJson(
        creatorAgentPolicy(DEMO_SEEDS.creator.agentId, buildOnboardRequest(form)),
      ),
    [form],
  );

  async function copyWallet() {
    if (!onboardResult?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(onboardResult.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denial is not worth surfacing — the address is
      // already visible to copy by hand.
    }
  }

  // -------------------------------------------------------------- step 1
  if (step === 0) {
    return (
      <StepShell
        stepIndex={0}
        stepCount={STEP_COUNT}
        eyebrow="Step 1 of 5"
        headline="Connect your socials"
        hint="Your manager studies these to figure out how you post, what works, and what to charge. Any one handle is enough to start."
        onNext={handleConnectSocials}
        nextLabel="Continue"
        nextDisabled={!hasAtLeastOneHandle}
        busy={ingestBusy}
        footerNote={
          ingestError ? <span className="text-negative">{ingestError}</span> : undefined
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="handle-instagram" className={labelCls}>
              Instagram
            </label>
            <input
              id="handle-instagram"
              className={inputCls}
              value={form.handles.instagram}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  handles: { ...f.handles, instagram: e.target.value },
                }))
              }
              placeholder="@yourhandle"
            />
          </div>
          <div>
            <label htmlFor="handle-youtube" className={labelCls}>
              YouTube
            </label>
            <input
              id="handle-youtube"
              className={inputCls}
              value={form.handles.youtube}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  handles: { ...f.handles, youtube: e.target.value },
                }))
              }
              placeholder="@yourhandle"
            />
          </div>
          <div>
            <label htmlFor="handle-x" className={labelCls}>
              X
            </label>
            <input
              id="handle-x"
              className={inputCls}
              value={form.handles.x}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  handles: { ...f.handles, x: e.target.value },
                }))
              }
              placeholder="@yourhandle"
            />
          </div>
          <div>
            <label htmlFor="handle-tiktok" className={labelCls}>
              TikTok
            </label>
            <input
              id="handle-tiktok"
              className={inputCls}
              value={form.handles.tiktok}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  handles: { ...f.handles, tiktok: e.target.value },
                }))
              }
              placeholder="@yourhandle"
            />
          </div>
        </div>
      </StepShell>
    );
  }

  // -------------------------------------------------------------- step 2
  if (step === 1) {
    return (
      <StepShell
        stepIndex={1}
        stepCount={STEP_COUNT}
        eyebrow="Step 2 of 5"
        headline="Here's what your agent found"
        hint="This is what it will use to negotiate on your behalf — check it before moving on."
        onBack={() => setStep(0)}
        onNext={() => setStep(2)}
        nextLabel="Looks right — continue"
      >
        {diagnosis ? <CreatorDiagnosisCard diagnosis={diagnosis} /> : null}
      </StepShell>
    );
  }

  // -------------------------------------------------------------- step 3
  if (step === 2) {
    return (
      <StepShell
        stepIndex={2}
        stepCount={STEP_COUNT}
        eyebrow="Step 3 of 5"
        headline="Confirm your rate card & rules"
        hint="These become the limits your agent negotiates inside — it will never go below your minimum or accept a blocked industry."
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
        nextDisabled={issue !== null}
        footerNote={issue ? <span className="text-negative">{issue}</span> : undefined}
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="minUsdc" className={labelCls}>
                Minimum rate (USDC)
              </label>
              <input
                id="minUsdc"
                className={`${inputCls} font-mono`}
                inputMode="numeric"
                value={form.minUsdc}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minUsdc: e.target.value }))
                }
                placeholder="650"
              />
            </div>
            <div>
              <label htmlFor="maxUsdc" className={labelCls}>
                Maximum rate (USDC)
              </label>
              <input
                id="maxUsdc"
                className={`${inputCls} font-mono`}
                inputMode="numeric"
                value={form.maxUsdc}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxUsdc: e.target.value }))
                }
                placeholder="900"
              />
            </div>
          </div>

          <div>
            <span className={labelCls}>Blocked industries</span>
            <div className="flex flex-wrap gap-2">
              {BLOCKED_INDUSTRY_OPTIONS.map((opt) => {
                const active = form.blockedIndustries.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleBlockedIndustry(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                      active
                        ? "border-negative/40 bg-negative/10 text-negative"
                        : "border-border-subtle bg-surface-raised text-muted hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Your agent will refuse offers from these categories outright.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="monthlyCapacity" className={labelCls}>
                Monthly capacity (deals)
              </label>
              <input
                id="monthlyCapacity"
                className={`${inputCls} font-mono`}
                inputMode="numeric"
                value={form.monthlyCapacity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monthlyCapacity: e.target.value }))
                }
                placeholder="4"
              />
            </div>
            <div>
              <label htmlFor="leadTimeDays" className={labelCls}>
                Lead time (days)
              </label>
              <input
                id="leadTimeDays"
                className={`${inputCls} font-mono`}
                inputMode="numeric"
                value={form.leadTimeDays}
                onChange={(e) =>
                  setForm((f) => ({ ...f, leadTimeDays: e.target.value }))
                }
                placeholder="5"
              />
            </div>
          </div>

          <div>
            <span className={labelCls}>Usage rights</span>
            <div className="mt-1 flex flex-col gap-2">
              {USAGE_RIGHTS_LADDER.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setForm((f) => ({ ...f, usageRights: value }))}
                  className={`sketch-alt ink border p-3 text-left text-sm transition-colors ${
                    form.usageRights === value
                      ? "border-accent/60 bg-accent/10"
                      : "border-border-subtle bg-surface-raised hover:border-border-subtle/80"
                  }`}
                >
                  {USAGE_RIGHTS_LABEL[value]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className={labelCls}>What your agent will sign</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
                live preview
              </span>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre sketch-alt ink border border-border-subtle bg-background px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
              {previewJson}
            </pre>
            <p className="mt-1.5 text-[11px] text-muted">
              This is the exact policy your agent is bound by once it signs —
              nothing here is decorative.
            </p>
          </div>
        </div>
      </StepShell>
    );
  }

  // -------------------------------------------------------------- step 4
  if (step === 3) {
    return (
      <StepShell
        stepIndex={3}
        stepCount={STEP_COUNT}
        eyebrow="Step 4 of 5"
        headline="Hatching your manager"
        hint="The policy you just confirmed is what it signs below — the mandate made visible."
      >
        {hatchError ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-negative">{hatchError}</p>
            <button
              type="button"
              onClick={startHatching}
              className="w-fit sketch-pill bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Try again
            </button>
          </div>
        ) : hatchBusy || !onboardResult ? (
          <p className="text-center text-sm text-muted">Warming the egg…</p>
        ) : (
          <HatchingCeremony
            agentId={onboardResult.agent.agentId}
            side="creator"
            category={diagnosis?.dominantCategories[0]}
            agentName={onboardResult.agent.name}
            policyJson={onboardResult.agent.policyJson}
            doneLabel="Attach my wallet"
            onDone={() => setStep(4)}
          />
        )}
      </StepShell>
    );
  }

  // -------------------------------------------------------------- step 5
  return (
    <StepShell
      stepIndex={4}
      stepCount={STEP_COUNT}
      eyebrow="Step 5 of 5"
      headline="Attach a wallet"
      hint="devnet · display only — KNOT never holds your keys."
      onNext={() => router.push("/creator")}
      nextLabel="Go to my dashboard"
    >
      <div className="flex flex-col gap-3 sketch ink border border-border-subtle bg-surface p-5">
        <span className={labelCls}>Devnet wallet</span>
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-sm text-foreground">
            {onboardResult?.walletAddress ?? "—"}
          </code>
          <button
            type="button"
            onClick={copyWallet}
            disabled={!onboardResult?.walletAddress}
            className="shrink-0 sketch-pill ink border border-border-subtle bg-surface-raised px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-muted">
          {onboardResult?.agent.name ?? "Your manager"} is already idling at
          its desk, ready for its first Promotion.
        </p>
      </div>
    </StepShell>
  );
}
