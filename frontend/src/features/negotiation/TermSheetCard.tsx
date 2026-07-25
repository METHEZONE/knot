import type { NegotiationTerms } from "@/lib/api/types";
import { usdc, formatDate, splitMilestoneAmounts } from "@/lib/format";
import { MaskedAmount } from "./MaskedAmount";

/**
 * Final term-sheet card shown when a negotiation replay completes.
 * Milestone amounts follow the KNOT money rule (floor + fold remainder
 * into the LAST milestone). All amounts respect the mask flag.
 */
export function TermSheetCard({
  terms,
  termsHash,
  masked = false,
}: {
  terms: NegotiationTerms;
  termsHash: string | null;
  masked?: boolean;
}) {
  const milestoneAmounts = splitMilestoneAmounts(
    terms.compensation.baseAmountUsdc,
    terms.milestones.map((m) => m.releasePct),
  );

  return (
    <section className="sketch ink border border-positive/30 bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Final term sheet</h2>
        <span className="rounded-full border border-positive/30 bg-positive/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-positive">
          Agreed
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Compensation</dt>
          <dd className="mt-1 font-mono text-sm">
            <MaskedAmount masked={masked}>
              {usdc(terms.compensation.baseAmountUsdc)}
            </MaskedAmount>{" "}
            base
            {terms.compensation.performancePct > 0 && (
              <span className="text-muted">
                {" "}
                + {terms.compensation.performancePct}% performance
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Usage rights</dt>
          <dd className="mt-1 font-mono text-sm">{terms.usageRights}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="text-xs text-muted">Deliverables</div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {terms.deliverables.map((d, i) => (
            <li
              key={`${d.format}-${i}`}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
            >
              <span>
                {d.count}× {d.format}
              </span>
              <span className="text-xs text-muted">
                post {formatDate(d.postWindow.start)} – {formatDate(d.postWindow.end)}{" "}
                · {d.revisionRounds} revision {d.revisionRounds === 1 ? "round" : "rounds"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <div className="text-xs text-muted">Milestones</div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {terms.milestones.map((m, i) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
            >
              <span className="font-mono text-xs uppercase tracking-wide text-accent-strong">
                {m.id} · {m.trigger}
              </span>
              <span className="font-mono text-xs">
                {m.releasePct}% ·{" "}
                <MaskedAmount masked={masked}>
                  {usdc(milestoneAmounts[i])}
                </MaskedAmount>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {termsHash && (
        <div className="mt-4 border-t border-border-subtle pt-3">
          <div className="text-xs text-muted">Terms hash</div>
          <div className="mt-1 truncate font-mono text-[11px] text-positive">
            {termsHash}
          </div>
        </div>
      )}
    </section>
  );
}
