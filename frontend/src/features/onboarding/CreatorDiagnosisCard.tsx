/**
 * Creator Diagnosis Card (PRD v2 §4 step 2).
 *
 * Every number here is read straight off `CreatorDiagnosisV1` — itself derived
 * deterministically from the cached ingest (PRD v2 §11). `narrative` is the one
 * field a model writes, so it gets its own visually distinct, attributed block
 * rather than blending into the numbers around it (17 §3 honesty rule).
 */

import type { CreatorDiagnosisV1 } from "@/lib/api/types";
import { formatDate, percent, usdc } from "@/lib/format";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

export function CreatorDiagnosisCard({
  diagnosis,
}: {
  diagnosis: CreatorDiagnosisV1;
}) {
  const isCachedReplay = diagnosis.source === "cachedReplay";

  return (
    <div className="flex flex-col gap-5 sketch ink border border-border-subtle bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Your diagnosis</h2>
        {isCachedReplay ? (
          <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted">
            captured {formatDate(diagnosis.capturedAt)}
          </span>
        ) : null}
      </div>

      {/* headline numbers */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted">Followers</div>
          <div className="mt-1 font-mono text-xl text-foreground">
            {diagnosis.followersTotal.toLocaleString("en-US")}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Engagement rate</div>
          <div className="mt-1 font-mono text-xl text-positive">
            {percent(diagnosis.engagementRate)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Posting cadence</div>
          <div className="mt-1 font-mono text-xl text-foreground">
            {diagnosis.postingCadencePerWeek.toFixed(1)} posts / week
          </div>
        </div>
      </div>

      {/* categories + tone */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted">Dominant categories</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {diagnosis.dominantCategories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs capitalize text-accent-strong"
              >
                {category}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Tone</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {diagnosis.toneKeywords.map((keyword) => (
              <span
                key={keyword}
                className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-xs"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* top formats as share bars */}
      <div>
        <div className="text-xs text-muted">What works</div>
        <div className="mt-2 flex flex-col gap-2">
          {diagnosis.topFormats.map((format) => (
            <div key={format.format} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate font-mono text-xs text-muted">
                {format.format}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${format.sharePct}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs text-foreground">
                {format.sharePct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* top posts */}
      <div>
        <div className="text-xs text-muted">Top posts</div>
        <div className="mt-2 flex flex-col gap-2">
          {diagnosis.topPosts.map((post) => (
            <a
              key={post.url}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-wrap items-center justify-between gap-2 sketch-alt ink border border-border-subtle bg-surface-raised px-3.5 py-2.5 text-xs transition-colors hover:border-accent/40"
            >
              <span>
                <span className="font-medium text-foreground">
                  {PLATFORM_LABEL[post.platform] ?? post.platform}
                </span>{" "}
                <span className="font-mono text-muted">{post.format}</span>
              </span>
              <span className="font-mono text-muted">
                {post.views.toLocaleString("en-US")} views ·{" "}
                {post.interactions.toLocaleString("en-US")} interactions
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* suggested rate band */}
      <div>
        <div className="text-xs text-muted">Suggested rate band</div>
        <div className="mt-1 font-mono text-lg">
          {usdc(diagnosis.suggestedRateBand.minUsdc)}
          <span className="text-muted"> – </span>
          {usdc(diagnosis.suggestedRateBand.maxUsdc)}
        </div>
      </div>

      {/* narrative — the one model-written field, clearly attributed */}
      <div className="sketch-alt ink border border-border-subtle bg-background px-4 py-3">
        <p className="text-sm italic leading-relaxed text-foreground">
          &ldquo;{diagnosis.narrative}&rdquo;
        </p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-muted">
          written by the model from the numbers above
        </p>
      </div>

      {isCachedReplay ? (
        <p className="text-[11px] leading-relaxed text-muted">
          Every number on this card comes from the capture above — nothing here
          is a live scrape.
        </p>
      ) : null}
    </div>
  );
}
