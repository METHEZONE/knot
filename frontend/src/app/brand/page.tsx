import Link from "next/link";
import { knotProvider } from "@/lib/api/provider";
import { usdc, formatDate } from "@/lib/format";
import { computeKpis, deriveStage } from "@/lib/derive";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function BrandDashboardPage() {
  const { promotions } = await knotProvider.listPromotions();
  const timelines = await Promise.all(
    promotions.map((p) =>
      knotProvider
        .getPromotionTimeline(p.promotionId)
        .then((r) => r.events)
        .catch(() => []),
    ),
  );
  const kpis = computeKpis(timelines);
  const stages = promotions.map((p, i) => deriveStage(p, timelines[i]));
  const releasedPct =
    kpis.committedUsdc > 0
      ? Math.round((kpis.releasedUsdc / kpis.committedUsdc) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Brand dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your promotions and what your agent is doing about them.
          </p>
        </div>
        <Link
          href="/brand/promotions/new"
          className="shrink-0 sketch-pill bg-accent px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          New Promotion
        </Link>
      </div>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="sketch ink border border-border-subtle bg-surface p-4">
          <div className="text-xs text-muted">Committed to escrow</div>
          <div className="mt-1 font-mono text-lg text-foreground">
            {usdc(kpis.committedUsdc)}
          </div>
          <div className="mt-1 text-[11px] text-muted">locked, zero fees</div>
        </div>
        <div className="sketch ink border border-border-subtle bg-surface p-4">
          <div className="text-xs text-muted">Released to creators</div>
          <div className="mt-1 font-mono text-lg text-foreground">
            {usdc(kpis.releasedUsdc)}
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-positive"
              style={{ width: `${Math.min(releasedPct, 100)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {releasedPct}% of committed
          </div>
        </div>
        <div className="sketch ink border border-border-subtle bg-surface p-4">
          <div className="text-xs text-muted">Agreements</div>
          <div className="mt-1 font-mono text-lg text-foreground">
            {kpis.agreements}
          </div>
          <div className="mt-1 text-[11px] text-muted">terms hashed & signed</div>
        </div>
        <div className="sketch ink border border-border-subtle bg-surface p-4">
          <div className="text-xs text-muted">Avg negotiation rounds</div>
          <div className="mt-1 font-mono text-lg text-foreground">
            {kpis.avgRounds === null ? "—" : kpis.avgRounds.toFixed(1)}
          </div>
          <div className="mt-1 text-[11px] text-muted">contract cap 5</div>
        </div>
      </section>

      {/* Promotions list */}
      <section className="flex flex-col gap-3">
        {promotions.map((promotion, i) => (
          <Link
            key={promotion.promotionId}
            href={`/promotions/${promotion.promotionId}`}
            className="group sketch ink border border-border-subtle bg-surface p-5 transition-colors hover:bg-surface-raised"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-base font-medium group-hover:text-accent-strong">
                  {promotion.title}
                </span>
                <StatusBadge status={stages[i]} />
              </div>
              <span className="text-xs text-muted">
                created {formatDate(promotion.createdAt)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
              <span>
                Budget{" "}
                <span className="font-mono text-foreground">
                  {usdc(promotion.budget.totalUsdc)}
                </span>{" "}
                · max{" "}
                <span className="font-mono text-foreground">
                  {usdc(promotion.budget.maxPerCreatorUsdc)}
                </span>{" "}
                per creator
              </span>
              <span>
                Window {formatDate(promotion.postingWindow.start)} –{" "}
                {formatDate(promotion.postingWindow.end)}
              </span>
              <span className="capitalize">{promotion.category}</span>
              <span>
                up to {promotion.autonomy.maxNegotiationRounds} rounds ·{" "}
                {promotion.autonomy.autoEscrow ? "auto-escrow" : "manual escrow"}{" "}
                ·{" "}
                {promotion.autonomy.autoRelease
                  ? "auto-release"
                  : "manual release"}
              </span>
            </div>
          </Link>
        ))}
        {promotions.length === 0 && (
          <div className="sketch ink border border-dashed border-border-subtle p-10 text-center text-sm text-muted">
            No promotions yet. Create one and let your agent take it from there.
          </div>
        )}
      </section>
    </div>
  );
}
