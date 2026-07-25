import type { CreatorDiagnosis } from "@/lib/api/types";
import { usdc, percent } from "@/lib/format";

/**
 * PLACEHOLDER — creator diagnosis card.
 *
 * Currently fixture-fed; the real diagnosis (audience graph, engagement
 * trends, format performance, dynamic rate band) arrives with the signal
 * pipeline. Keep the prop shape stable: it mirrors CreatorDiagnosis.
 */
export function DiagnosisCard({
  audience,
  engagementRate,
  topFormats,
  rateBand,
}: CreatorDiagnosis) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Your diagnosis</h2>
        <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
          Preview
        </span>
      </div>

      <dl className="mt-4 flex flex-col gap-4">
        <div>
          <dt className="text-xs text-muted">Audience</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {audience.map((segment) => (
              <span
                key={segment}
                className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs"
              >
                {segment}
              </span>
            ))}
          </dd>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted">Engagement rate</dt>
            <dd className="mt-1 font-mono text-lg text-positive">
              {percent(engagementRate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Rate band</dt>
            <dd className="mt-1 font-mono text-lg">
              {usdc(rateBand.minUsdc)}
              <span className="text-muted"> – </span>
              {usdc(rateBand.maxUsdc)}
            </dd>
          </div>
        </div>

        <div>
          <dt className="text-xs text-muted">Top formats</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {topFormats.map((format, i) => (
              <span
                key={format}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${
                  i === 0
                    ? "border-accent/30 bg-accent/10 text-accent-strong"
                    : "border-border-subtle bg-surface-raised text-muted"
                }`}
              >
                {format}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted">
        Diagnosis preview from seed data — live signals land here.
      </p>
    </section>
  );
}
