"use client";

/**
 * Brand onboarding (PRD v2 §5) — connect the brand, show what the ingest
 * found, hand over spending authority one dial at a time, watch the manager
 * hatch and sign the mandate it will actually be bound by, then attach a
 * wallet and hand off to the first Promotion.
 *
 * Same ceremony beat as the creator side; the inputs here are the business
 * ones. Every step lives inside `StepShell` so only one decision is on
 * screen at a time.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StepShell } from "@/features/onboarding/StepShell";
import { HatchingCeremony } from "@/features/onboarding/HatchingCeremony";
import { BrandProfileCard } from "@/features/onboarding/BrandProfileCard";
import {
  AutonomyDials,
  AUTONOMY_DIALS_DEFAULT,
  parseAutonomyDials,
  validateAutonomyDials,
  type AutonomyDialsValue,
} from "@/features/onboarding/AutonomyDials";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import { DEMO_SEEDS, persistDemoRole } from "@/lib/demoSession";
import { brandAgentPolicy, mandateJson } from "@/lib/onboardingPolicy";
import type {
  BrandIngestV1,
  BrandOnboardRequest,
  BrandOnboardResult,
  SocialHandle,
} from "@/lib/api/types";

const STEP_COUNT = 5;

const inputCls =
  "w-full rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-xs font-medium text-muted";

/** Loose but real URL check: needs a scheme and a dotted host. */
function isPlausibleUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

export default function BrandOnboardingPage() {
  const router = useRouter();
  const seed = DEMO_SEEDS.brand;

  useEffect(() => {
    persistDemoRole("brand");
  }, []);

  const [step, setStep] = useState(0);

  // ---- Step 1: connect --------------------------------------------------
  const [website, setWebsite] = useState("https://demo-skincare.example.com");
  const [instagram, setInstagram] = useState("");
  const [x, setX] = useState("");
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ---- Step 2: ingest result ---------------------------------------------
  const [ingest, setIngest] = useState<BrandIngestV1 | null>(null);

  // ---- Step 3: autonomy dials --------------------------------------------
  const [dials, setDials] = useState<AutonomyDialsValue>(AUTONOMY_DIALS_DEFAULT);

  // ---- Step 4: hatching ---------------------------------------------------
  const [onboardResult, setOnboardResult] = useState<BrandOnboardResult | null>(
    null,
  );
  const [hatchError, setHatchError] = useState<string | null>(null);
  const onboardStarted = useRef(false);

  function handles(): SocialHandle[] {
    const list: SocialHandle[] = [];
    if (instagram.trim()) list.push({ platform: "instagram", handle: instagram.trim() });
    if (x.trim()) list.push({ platform: "x", handle: x.trim() });
    return list;
  }

  async function handleConnect() {
    if (!isPlausibleUrl(website)) {
      setConnectError("Enter a full URL, like https://yourbrand.com.");
      return;
    }
    setConnectError(null);
    setConnectBusy(true);
    try {
      const { ingest: result } = await knotProvider.ingestBrand({
        website: website.trim(),
        handles: handles(),
      });
      setIngest(result);
      setStep(1);
    } catch (error) {
      setConnectError(
        error instanceof ProblemError
          ? error.detail
          : "Could not reach that site. Try again.",
      );
    } finally {
      setConnectBusy(false);
    }
  }

  const dialErrors = validateAutonomyDials(dials);
  const dialsValid = Object.keys(dialErrors).length === 0;

  function buildOnboardRequest(): BrandOnboardRequest | null {
    if (!ingest) return null;
    const parsed = parseAutonomyDials(dials);
    return {
      website: website.trim(),
      handles: handles(),
      name: ingest.name,
      category: ingest.category,
      budget: parsed.budget,
      autonomy: parsed.autonomy,
      usageRights: parsed.usageRights,
      blockedCategories: parsed.blockedCategories,
      walletAddress: null,
    };
  }

  function startHatching() {
    const request = buildOnboardRequest();
    if (!request || onboardStarted.current) return;
    onboardStarted.current = true;
    setHatchError(null);
    knotProvider
      .onboardBrand(request)
      .then(({ brand }) => setOnboardResult(brand))
      .catch((error) => {
        onboardStarted.current = false;
        setHatchError(
          error instanceof ProblemError
            ? error.detail
            : "Could not hatch your agent. Try again.",
        );
      });
  }

  // Guarded: fires once when the hatching step is entered.
  useEffect(() => {
    if (step === 3) startHatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const previewRequest = buildOnboardRequest();

  const [copied, setCopied] = useState(false);
  async function copyWallet() {
    if (!onboardResult?.walletAddress) return;
    try {
      await navigator.clipboard.writeText(onboardResult.walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access denied — not worth surfacing.
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {step === 0 && (
        <StepShell
          stepIndex={0}
          stepCount={STEP_COUNT}
          eyebrow="Brand onboarding"
          headline="Connect your brand"
          hint="We read your site and public socials once — then hand it to your agent to run with."
          onNext={handleConnect}
          nextDisabled={!website.trim()}
          busy={connectBusy}
          nextLabel="Continue"
        >
          <div>
            <label htmlFor="website" className={labelCls}>
              Website URL
            </label>
            <input
              id="website"
              className={inputCls}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourbrand.com"
              inputMode="url"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="instagram" className={labelCls}>
                Instagram handle (optional)
              </label>
              <input
                id="instagram"
                className={inputCls}
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@yourbrand"
              />
            </div>
            <div>
              <label htmlFor="x" className={labelCls}>
                X handle (optional)
              </label>
              <input
                id="x"
                className={inputCls}
                value={x}
                onChange={(e) => setX(e.target.value)}
                placeholder="@yourbrand"
              />
            </div>
          </div>
          {connectError && (
            <p className="text-sm text-negative">{connectError}</p>
          )}
        </StepShell>
      )}

      {step === 1 && ingest && (
        <StepShell
          stepIndex={1}
          stepCount={STEP_COUNT}
          eyebrow="Brand profile"
          headline="Here's what we found"
          hint="Every number below comes from the capture above. Only the summary at the bottom is model-written."
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
          nextLabel="Looks right, continue"
        >
          <BrandProfileCard ingest={ingest} />
        </StepShell>
      )}

      {step === 2 && (
        <StepShell
          stepIndex={2}
          stepCount={STEP_COUNT}
          eyebrow="Autonomy"
          headline="Set what your agent can do on its own"
          hint="This is where you hand over spending authority. Every dial says exactly what it lets your agent do without you."
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          nextDisabled={!dialsValid}
          nextLabel="Continue to hatching"
        >
          <AutonomyDials value={dials} onChange={setDials} />

          <div className="sketch ink border border-border-subtle bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-medium text-muted">
                Mandate preview
              </h2>
              <span className="font-mono text-[10px] text-muted">
                live · not yet signed
              </span>
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre sketch-alt ink border border-border-subtle bg-background px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
              {previewRequest
                ? mandateJson(brandAgentPolicy(seed.agentId, previewRequest))
                : ""}
            </pre>
            <p className="mt-2 text-[11px] text-muted">
              This is the exact policy your agent signs on the next screen —
              nothing here is decorative.
            </p>
          </div>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell
          stepIndex={3}
          stepCount={STEP_COUNT}
          eyebrow="Hatching"
          headline="Meet your brand manager"
        >
          {!onboardResult && !hatchError && (
            <p className="text-center text-sm text-muted">Warming the egg…</p>
          )}
          {hatchError && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-negative">{hatchError}</p>
              <button
                type="button"
                onClick={startHatching}
                className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
              >
                Try again
              </button>
            </div>
          )}
          {onboardResult && (
            <HatchingCeremony
              agentId={onboardResult.agent.agentId}
              side="brand"
              category={ingest?.category}
              agentName={onboardResult.agent.name}
              policyJson={onboardResult.agent.policyJson}
              onDone={() => setStep(4)}
              doneLabel="Attach my wallet"
            />
          )}
        </StepShell>
      )}

      {step === 4 && onboardResult && (
        <StepShell
          stepIndex={4}
          stepCount={STEP_COUNT}
          eyebrow="Wallet"
          headline="Attach your wallet"
          hint="devnet · display only — KNOT never holds your keys."
        >
          <div className="sketch ink border border-border-subtle bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="break-all font-mono text-sm text-foreground">
                {onboardResult.walletAddress}
              </span>
              <button
                type="button"
                onClick={copyWallet}
                className="shrink-0 sketch-pill ink border border-border-subtle bg-surface-raised px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-muted">
            {onboardResult.agent.name} is standing by and will start matching
            creators as soon as you activate a Promotion.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/brand/promotions/new")}
              className="sketch-pill bg-accent px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Create your first Promotion
            </button>
            <button
              type="button"
              onClick={() => router.push("/brand")}
              className="sketch-pill ink border border-border-subtle bg-surface px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              Go to dashboard
            </button>
          </div>
        </StepShell>
      )}
    </div>
  );
}
