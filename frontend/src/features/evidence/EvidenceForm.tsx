"use client";

/**
 * Evidence flow on the creator deal page:
 *   URL input -> POST /agreements/{id}/evidence -> verify button ->
 *   POST /evidence/{id}:verify -> observations checklist + PASSED/FAILED.
 */

import { useState } from "react";
import type { Evidence } from "@/lib/api/types";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError } from "@/lib/api/client";
import { StatusBadge } from "@/components/StatusBadge";

type Phase = "idle" | "submitting" | "submitted" | "verifying" | "verified";

export function EvidenceForm({
  agreementId,
  submittedByAgentId,
  milestoneId,
}: {
  agreementId: string;
  submittedByAgentId: string;
  /** Milestone the evidence unblocks (e.g. the EVIDENCE_VERIFIED one). */
  milestoneId?: string;
}) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "submitting" || phase === "verifying";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || busy) return;
    setError(null);
    setPhase("submitting");
    try {
      const { evidence: created } = await knotProvider.submitEvidence(agreementId, {
        url: url.trim(),
        submittedByAgentId,
        ...(milestoneId ? { milestoneId } : {}),
      });
      setEvidence(created);
      setPhase("submitted");
    } catch (err) {
      setError(err instanceof ProblemError ? err.detail : "Evidence submission failed.");
      setPhase("idle");
    }
  }

  async function verify() {
    if (!evidence || busy) return;
    setError(null);
    setPhase("verifying");
    try {
      const { evidence: verified } = await knotProvider.verifyEvidence(
        evidence.evidenceId,
      );
      setEvidence(verified);
      setPhase("verified");
    } catch (err) {
      setError(err instanceof ProblemError ? err.detail : "Verification failed.");
      setPhase("submitted");
    }
  }

  function reset() {
    setUrl("");
    setEvidence(null);
    setError(null);
    setPhase("idle");
  }

  const observations = phase === "verified" ? evidence?.observations : null;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Submit evidence</h2>
        {evidence && <StatusBadge status={evidence.status} />}
      </div>
      <p className="mt-1 text-xs text-muted">
        Paste the live post URL{milestoneId ? ` for milestone “${milestoneId}”` : ""}.
        Verification checks reachability, brand mention, disclosures, and
        prohibited claims.
      </p>

      {phase === "idle" || phase === "submitting" ? (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/…"
            disabled={busy}
            className="w-full flex-1 rounded-xl border border-border-subtle bg-surface-raised px-3.5 py-2 font-mono text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="shrink-0 rounded-xl border border-accent/30 bg-accent/15 px-4 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "submitting" ? "Submitting…" : "Submit evidence"}
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised px-3.5 py-2.5">
            <span className="truncate font-mono text-xs text-foreground">
              {evidence?.url}
            </span>
            {phase !== "verified" ? (
              <button
                type="button"
                onClick={verify}
                disabled={busy}
                className="shrink-0 rounded-lg border border-positive/30 bg-positive/10 px-3.5 py-1.5 text-xs font-medium text-positive transition-colors hover:bg-positive/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === "verifying" ? "Verifying…" : "Verify"}
              </button>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="shrink-0 rounded-lg border border-border-subtle bg-surface px-3.5 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
              >
                Submit another
              </button>
            )}
          </div>

          {observations && (
            <ul className="flex flex-col gap-2">
              <ChecklistItem
                ok={observations.urlReachable}
                label="URL reachable"
                detail={observations.urlReachable ? "Post is live" : "Could not load the post"}
              />
              <ChecklistItem
                ok={observations.brandMentioned}
                label="Brand mentioned"
                detail={
                  observations.brandMentioned
                    ? "Brand reference found"
                    : "No brand reference found"
                }
              />
              <ChecklistItem
                ok={observations.disclosurePresent}
                label="Disclosure present"
                detail={
                  observations.disclosurePresent
                    ? "Required disclosure detected"
                    : "Missing required disclosure"
                }
              />
              <ChecklistItem
                ok={observations.prohibitedClaimsFound.length === 0}
                label="No prohibited claims"
                detail={
                  observations.prohibitedClaimsFound.length === 0
                    ? "Clean"
                    : `Found: ${observations.prohibitedClaimsFound.join(", ")}`
                }
              />
            </ul>
          )}

          {phase === "verified" && evidence?.policyDecision && (
            <p className="text-xs text-muted">
              Policy {evidence.policyDecision.allowed ? "allowed" : "blocked"} ·{" "}
              <span className="font-mono">{evidence.policyDecision.ruleVersion}</span>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-negative/30 bg-negative/10 px-3 py-2 text-xs text-negative">
          {error}
        </p>
      )}
    </section>
  );
}

function ChecklistItem({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-3.5 py-2.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
          ok
            ? "border-positive/40 bg-positive/15 text-positive"
            : "border-negative/40 bg-negative/15 text-negative"
        }`}
        aria-hidden="true"
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      <span className={`text-xs ${ok ? "text-muted" : "text-negative"}`}>{detail}</span>
    </li>
  );
}
