import Link from "next/link";
import type { Agreement, Escrow, Negotiation, Promotion } from "@/lib/api/types";
import { knotProvider } from "@/lib/api/provider";
import { SEED } from "@/lib/seeds";
import { demoCreatorDiagnosis } from "@/lib/fixtures";
import { usdc, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { DiagnosisCard } from "@/features/dashboard/DiagnosisCard";
import { deriveCreatorTasks } from "@/features/dashboard/tasks";

export const dynamic = "force-dynamic";

/**
 * The API has no creator-scoped list routes yet, so the working set resolves
 * from the well-known seed deal (agr-001 / neg-001 / esc-001). Each fetch
 * degrades to null independently so a missing seed never blanks the page.
 */
async function loadSeedDeal(): Promise<{
  agreement: Agreement | null;
  negotiation: Negotiation | null;
  escrow: Escrow | null;
}> {
  const [agreement, negotiation, escrow] = await Promise.all([
    knotProvider.getAgreement(SEED.agreementId).then(
      (r) => r.agreement,
      () => null,
    ),
    knotProvider.getNegotiation(SEED.negotiationId).then(
      (r) => r.negotiation,
      () => null,
    ),
    knotProvider.getEscrow(SEED.escrowId).then(
      (r) => r.escrow,
      () => null,
    ),
  ]);
  return { agreement, negotiation, escrow };
}

export default async function CreatorDashboardPage() {
  const [{ promotions }, { agreement, negotiation, escrow }] = await Promise.all([
    knotProvider.listPromotions().catch(() => ({ promotions: [] as Promotion[] })),
    loadSeedDeal(),
  ]);

  const dealEscrow =
    escrow && agreement && escrow.agreementId === agreement.agreementId
      ? escrow
      : null;

  const releasedUsdc = (dealEscrow?.milestones ?? [])
    .filter((m) => m.released)
    .reduce((sum, m) => sum + m.amountUsdc, 0);
  const pendingUsdc = (dealEscrow?.milestones ?? [])
    .filter((m) => !m.released)
    .reduce((sum, m) => sum + m.amountUsdc, 0);

  const tasks = agreement ? deriveCreatorTasks(agreement.terms, dealEscrow) : [];
  const openTasks = tasks.filter((t) => !t.done).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Creator dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Deals your agent negotiated, what you owe them, and what they owe you.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: deals inbox + tasks */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted">Deals inbox</h2>
            {agreement ? (
              <Link
                href={`/creator/deals/${agreement.agreementId}`}
                className="group sketch ink border border-border-subtle bg-surface p-5 transition-colors hover:bg-surface-raised"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-medium group-hover:text-accent-strong">
                      {promotions[0]?.title ?? "Promotion deal"}
                    </span>
                    <StatusBadge status={agreement.status} />
                  </div>
                  <span className="font-mono text-sm">
                    {usdc(agreement.terms.compensation.baseAmountUsdc)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                  <span className="font-mono">{agreement.agreementId}</span>
                  {negotiation && (
                    <span>
                      {negotiation.status.toLowerCase()} in round{" "}
                      {negotiation.currentRound}/{negotiation.maxRounds}
                    </span>
                  )}
                  <span>
                    {agreement.terms.deliverables
                      .map((d) => `${d.count}× ${d.format}`)
                      .join(", ")}
                  </span>
                  {dealEscrow && (
                    <span>
                      escrow {dealEscrow.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                  )}
                </div>
                {negotiation && (
                  <div className="mt-3 text-xs">
                    <span className="text-accent-strong group-hover:underline">
                      Watch the negotiation replay →
                    </span>
                  </div>
                )}
              </Link>
            ) : (
              <div className="sketch ink border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
                No deals yet — your agent will file negotiated agreements here.
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted">Tasks</h2>
              {tasks.length > 0 && (
                <span className="font-mono text-xs text-muted">
                  {openTasks} open
                </span>
              )}
            </div>
            {tasks.length > 0 ? (
              <ul className="overflow-hidden sketch ink border border-border-subtle bg-surface">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 border-b border-border-subtle px-5 py-3 last:border-b-0"
                  >
                    <span
                      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold ${
                        task.done
                          ? "border-positive/40 bg-positive/15 text-positive"
                          : "border-border-subtle bg-surface-raised text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span
                      className={`flex-1 text-sm ${task.done ? "text-muted line-through" : ""}`}
                    >
                      {task.label}
                    </span>
                    {task.hint && (
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        {task.hint}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="sketch ink border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
                Tasks derive from agreement deliverables and milestone triggers.
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted">Open promotions</h2>
            {promotions.length === 0 ? (
              <div className="sketch ink border border-dashed border-border-subtle p-8 text-center text-sm text-muted">
                No open promotions right now.
              </div>
            ) : (
              promotions.map((promotion) => (
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
                      <StatusBadge status={promotion.status} />
                    </div>
                    <span className="font-mono text-xs text-foreground">
                      up to {usdc(promotion.budget.maxPerCreatorUsdc)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
                    <span className="capitalize">{promotion.category}</span>
                    <span>
                      Post {formatDate(promotion.postingWindow.start)} –{" "}
                      {formatDate(promotion.postingWindow.end)}
                    </span>
                    <span>
                      {promotion.deliverables
                        .map((d) => `${d.count}× ${d.format}`)
                        .join(", ")}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </section>
        </div>

        {/* Right: earnings + diagnosis */}
        <div className="flex flex-col gap-6">
          <section className="sketch ink border border-border-subtle bg-surface p-5">
            <h2 className="text-sm font-medium">Earnings</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted">Released</div>
                <div className="mt-1 font-mono text-xl text-positive">
                  {usdc(releasedUsdc)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Pending in escrow</div>
                <div className="mt-1 font-mono text-xl text-caution">
                  {usdc(pendingUsdc)}
                </div>
              </div>
            </div>
            {dealEscrow ? (
              <div className="mt-4 border-t border-border-subtle pt-3">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>
                    Escrow <span className="font-mono">{dealEscrow.escrowId}</span>
                  </span>
                  <StatusBadge status={dealEscrow.status} />
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {dealEscrow.milestones.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-mono uppercase tracking-wide text-muted">
                        {m.id} · {m.releasePct}%
                      </span>
                      <span
                        className={`font-mono ${m.released ? "text-positive" : "text-muted"}`}
                      >
                        {usdc(m.amountUsdc)} {m.released ? "released" : "pending"}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted">
                  Fee 0 USDC · receipts{" "}
                  {dealEscrow.receipt.status === "SIMULATED"
                    ? "simulated (devnet dry-run)"
                    : "on-chain"}
                </p>
              </div>
            ) : (
              <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-muted">
                Earnings appear once an agreement locks escrow.
              </p>
            )}
          </section>

          {/* Fixture-fed placeholder until the signal pipeline ships. */}
          <DiagnosisCard {...demoCreatorDiagnosis} />
        </div>
      </div>
    </div>
  );
}
