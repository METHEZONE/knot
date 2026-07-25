/**
 * Brand Profile Card (PRD v2 §5 step 1) — what the ingest found, rendered
 * before the brand ever talks to a human at KNOT. Every field except
 * `narrative` is deterministic; the capture-honesty badge (17 §3) makes clear
 * this is a cached read of the site, never a live scrape.
 */

import type { BrandIngestV1 } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

const chipCls =
  "sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs";

export function BrandProfileCard({ ingest }: { ingest: BrandIngestV1 }) {
  return (
    <section className="sketch ink border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{ingest.name}</h2>
          <p className="mt-0.5 text-xs capitalize text-muted">{ingest.category}</p>
        </div>
        {ingest.source === "cachedReplay" ? (
          <span className="shrink-0 sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted">
            captured {formatDateTime(ingest.capturedAt)}
          </span>
        ) : null}
      </div>

      {ingest.source === "cachedReplay" ? (
        <p className="mt-2 text-[11px] text-muted">
          This is a cached read of {ingest.website} from the capture above —
          not a live crawl.
        </p>
      ) : null}

      <dl className="mt-4 flex flex-col gap-4">
        <div>
          <dt className="text-xs text-muted">Product lines</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {ingest.productLines.map((line) => (
              <span key={line} className={chipCls}>
                {line}
              </span>
            ))}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted">Tone</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {ingest.toneKeywords.map((keyword) => (
              <span key={keyword} className={chipCls}>
                {keyword}
              </span>
            ))}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-muted">Suggested target audience</dt>
          <dd className="mt-1.5 flex flex-wrap gap-1.5">
            {ingest.suggestedAudience.map((segment) => (
              <span key={segment} className={chipCls}>
                {segment}
              </span>
            ))}
          </dd>
        </div>

        {ingest.foundCollabs.length > 0 ? (
          <div>
            <dt className="text-xs text-muted">Creator collabs found</dt>
            <dd className="mt-1.5 flex flex-col gap-1">
              {ingest.foundCollabs.map((collab) => (
                <a
                  key={collab.url}
                  href={collab.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-strong transition-colors hover:underline"
                >
                  {collab.handle} · {collab.platform}
                </a>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4 border-t border-border-subtle pt-3">
        <p className="text-[10px] uppercase tracking-wide text-muted">
          Model-written summary — not a verified claim
        </p>
        <blockquote className="mt-1.5 border-l-2 border-accent/40 pl-3 text-sm italic leading-relaxed text-foreground">
          “{ingest.narrative}”
        </blockquote>
      </div>
    </section>
  );
}
