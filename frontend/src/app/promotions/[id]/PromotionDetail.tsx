"use client";

/**
 * Promotion detail: status header, budget bar, agent action rail,
 * timeline with type-specific icons, match candidates table, agreement
 * and escrow cards.
 *
 * All mutations go through the provider; buttons disable while a call is
 * in flight and failures surface as RFC 7807 toasts (code + violations).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { knotProvider } from "@/lib/api/provider";
import { ProblemError, explorerLink } from "@/lib/api/client";
import type {
  Agreement,
  Escrow,
  MatchCandidate,
  MatchRun,
  Promotion,
  TimelineEvent,
} from "@/lib/api/types";
import { usdc, formatDate, formatDateTime } from "@/lib/format";
import { deriveStage, splitMilestoneAmounts } from "@/lib/derive";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/ToastProvider";
import { PromotionSocietyMap } from "@/features/map";

/** Last event matching the type pattern that carries a string at data[key]. */
function findEventString(
  events: TimelineEvent[],
  typePattern: RegExp,
  key: string,
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (typePattern.test(event.type)) {
      const value = event.data[key];
      if (typeof value === "string") return value;
    }
  }
  return null;
}

function eventLabel(type: string): string {
  const words = type.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatEventValue(key: string, value: unknown): string {
  if (typeof value === "number" && /Usdc$/.test(key)) return usdc(value);
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > 30 ? `${s.slice(0, 27)}…` : s;
}

const COMPONENT_KEYS = [
  ["category", "cat"],
  ["budget", "bud"],
  ["schedule", "sch"],
  ["deliverable", "del"],
  ["reputation", "rep"],
] as const;

export function PromotionDetail({ promotionId }: { promotionId: string }) {
  const toast = useToast();

  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [matchRun, setMatchRun] = useState<MatchRun | null>(null);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const refreshTimeline = useCallback(async () => {
    try {
      const { events } = await knotProvider.getPromotionTimeline(promotionId);
      setEvents(events);
    } catch {
      // Timeline refresh is best-effort; the primary action already reported.
    }
  }, [promotionId]);

  // `loading` starts true; `load` runs once on mount and flips it off when done.
  const load = useCallback(async () => {
    try {
      const [promoRes, timelineRes] = await Promise.all([
        knotProvider.getPromotion(promotionId),
        knotProvider.getPromotionTimeline(promotionId),
      ]);
      setPromotion(promoRes.promotion);
      setEvents(timelineRes.events);

      const timeline = timelineRes.events;
      const matchRunId = findEventString(timeline, /MATCH_RUN/, "matchRunId");
      const agreementId = findEventString(timeline, /AGREEMENT/, "agreementId");
      const escrowId = findEventString(timeline, /ESCROW/, "escrowId");

      const [matchRunRes, candidatesRes, agreementRes, escrowRes] =
        await Promise.all([
          matchRunId
            ? knotProvider.getMatchRun(matchRunId).catch(() => null)
            : null,
          matchRunId
            ? knotProvider.getMatchCandidates(matchRunId).catch(() => null)
            : null,
          agreementId
            ? knotProvider.getAgreement(agreementId).catch(() => null)
            : null,
          escrowId ? knotProvider.getEscrow(escrowId).catch(() => null) : null,
        ]);
      if (matchRunRes) setMatchRun(matchRunRes.matchRun);
      if (candidatesRes) setCandidates(candidatesRes.candidates);
      if (agreementRes) setAgreement(agreementRes.agreement);
      if (escrowRes) setEscrow(escrowRes.escrow);
    } catch (error) {
      if (error instanceof ProblemError && error.status === 404) {
        setMissing(true);
      } else {
        toast.pushProblem(error, "Failed to load promotion");
      }
    } finally {
      setLoading(false);
    }
  }, [promotionId, toast]);

  useEffect(() => {
    // Initial data fetch: every setState in `load` happens after an await,
    // never synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const runAction = useCallback(
    async (key: string, fn: () => Promise<void>) => {
      setPending(key);
      try {
        await fn();
        void refreshTimeline();
      } catch (error) {
        toast.pushProblem(error);
      } finally {
        setPending(null);
      }
    },
    [refreshTimeline, toast],
  );

  const onActivate = () =>
    runAction("activate", async () => {
      const res = await knotProvider.activatePromotion(promotionId);
      setPromotion(res.promotion);
      toast.push({
        title: "Promotion activated",
        body: "Your agent can now run matching.",
        tone: "positive",
      });
    });

  const onRunMatching = () =>
    runAction("match", async () => {
      const res = await knotProvider.runMatches(promotionId);
      setMatchRun(res.matchRun);
      const { candidates } = await knotProvider.getMatchCandidates(
        res.matchRun.matchRunId,
      );
      setCandidates(candidates);
      toast.push({
        title: "Match run complete",
        body: `${candidates.length} candidates ranked with ${res.matchRun.weightsVersion}.`,
        tone: "positive",
      });
    });

  const onStartNegotiation = () => {
    if (!matchRun) return;
    void runAction("negotiate", async () => {
      const res = await knotProvider.startNegotiation(matchRun.matchRunId);
      if (res.agreement) setAgreement(res.agreement);
      toast.push({
        title: `Negotiation ${res.negotiation.status}`,
        body: `Settled in round ${res.negotiation.currentRound} of ${res.negotiation.maxRounds}.`,
        tone: res.negotiation.status === "AGREED" ? "positive" : "neutral",
      });
    });
  };

  const onLockEscrow = () => {
    if (!agreement) return;
    void runAction("lock", async () => {
      const res = await knotProvider.lockEscrow(agreement.agreementId);
      setEscrow(res.escrow);
      toast.push({
        title: "Escrow locked",
        body: `${usdc(res.escrow.amountUsdc)} committed. Receipt is ${res.escrow.receipt.status}.`,
        tone: "positive",
      });
    });
  };

  const onReleaseMilestone = (milestoneId: string) => {
    if (!escrow) return;
    void runAction(`release:${milestoneId}`, async () => {
      const res = await knotProvider.releaseMilestone(
        escrow.escrowId,
        milestoneId,
      );
      setEscrow(res.escrow);
      const released = res.escrow.milestones.find((m) => m.id === milestoneId);
      toast.push({
        title: "Milestone released",
        body: released
          ? `${usdc(released.amountUsdc)} released for "${milestoneId}".`
          : `Milestone "${milestoneId}" released.`,
        tone: "positive",
      });
    });
  };

  const stage = useMemo(
    () => (promotion ? deriveStage(promotion, events) : null),
    [promotion, events],
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4 py-8">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse sketch ink border border-border-subtle bg-surface"
          />
        ))}
      </div>
    );
  }

  if (missing || !promotion) {
    return (
      <div className="sketch ink border border-dashed border-border-subtle p-12 text-center">
        <p className="text-sm text-muted">Promotion not found.</p>
        <Link
          href="/brand"
          className="mt-3 inline-block text-sm text-accent-strong hover:underline"
        >
          Back to brand dashboard
        </Link>
      </div>
    );
  }

  const totalBudget = promotion.budget.totalUsdc;
  const committedUsdc = escrow?.amountUsdc ?? 0;
  const releasedUsdc = escrow
    ? escrow.milestones
        .filter((m) => m.released)
        .reduce((sum, m) => sum + m.amountUsdc, 0)
    : 0;
  const lockedUsdc = committedUsdc - releasedUsdc;
  const pct = (amount: number) =>
    totalBudget > 0 ? Math.min((amount / totalBudget) * 100, 100) : 0;

  const busy = pending !== null;
  const actions: {
    key: string;
    label: string;
    pendingLabel: string;
    enabled: boolean;
    hint: string;
    onClick: () => void;
  }[] = [
    {
      key: "activate",
      label: "Activate",
      pendingLabel: "Activating…",
      enabled: promotion.status === "DRAFT",
      hint:
        promotion.status === "DRAFT"
          ? "Open this Promotion so your agent can start matching."
          : "Only DRAFT promotions can be activated.",
      onClick: onActivate,
    },
    {
      key: "match",
      label: matchRun ? "Re-run matching" : "Run matching",
      pendingLabel: "Matching…",
      enabled: promotion.status !== "DRAFT",
      hint:
        promotion.status !== "DRAFT"
          ? "Rank creators against this Promotion with explainable scores."
          : "Activate the Promotion first.",
      onClick: onRunMatching,
    },
    {
      key: "negotiate",
      label: "Start negotiation",
      pendingLabel: "Negotiating…",
      enabled: Boolean(matchRun) && !agreement,
      hint: !matchRun
        ? "Run matching first."
        : agreement
          ? "An agreement is already in place."
          : "Let the agents exchange offers within your autonomy limits.",
      onClick: onStartNegotiation,
    },
    {
      key: "lock",
      label: escrow ? "Escrow locked" : "Lock escrow",
      pendingLabel: "Locking…",
      enabled: Boolean(agreement) && !escrow,
      hint: !agreement
        ? "Reach an agreement first."
        : escrow
          ? "Escrow is already locked for this agreement."
          : "Commit the agreed USDC into escrow.",
      onClick: onLockEscrow,
    },
  ];

  const rankedCandidates = [...candidates].sort((a, b) => a.rank - b.rank);
  const agreementAmounts = agreement
    ? splitMilestoneAmounts(
        agreement.terms.compensation.baseAmountUsdc,
        agreement.terms.milestones,
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      {/* Status header */}
      <div className="flex flex-col gap-4">
        <div>
          <Link
            href="/brand"
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            ← Brand dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {promotion.title}
            </h1>
            {stage && <StatusBadge status={stage} />}
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted">
              api:{promotion.status}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {promotion.objective}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span className="capitalize">{promotion.category}</span>
            <span>
              Window {formatDate(promotion.postingWindow.start)} –{" "}
              {formatDate(promotion.postingWindow.end)}
            </span>
            <span className="font-mono">{promotion.usageRights}</span>
            <span>
              {promotion.autonomy.maxNegotiationRounds} rounds max ·{" "}
              {promotion.autonomy.autoEscrow ? "auto-escrow" : "manual escrow"} ·{" "}
              {promotion.autonomy.autoRelease
                ? "auto-release"
                : "manual release"}
            </span>
          </div>
        </div>

        {/* Action rail */}
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={!action.enabled || busy}
              title={action.hint}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${
                action.key === "activate" || action.key === "lock"
                  ? "bg-accent text-background hover:opacity-90"
                  : "border border-border-subtle bg-surface text-foreground hover:bg-surface-raised"
              }`}
            >
              {pending === action.key ? action.pendingLabel : action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget bar */}
      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Budget</h2>
          <span className="font-mono text-xs text-muted">
            {usdc(totalBudget)} total · max {usdc(promotion.budget.maxPerCreatorUsdc)}{" "}
            per creator · 0 fees
          </span>
        </div>
        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full bg-positive"
            style={{ width: `${pct(releasedUsdc)}%` }}
            title={`Released ${usdc(releasedUsdc)}`}
          />
          <div
            className="h-full bg-accent"
            style={{ width: `${pct(lockedUsdc)}%` }}
            title={`Locked in escrow ${usdc(lockedUsdc)}`}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-positive" /> released{" "}
            <span className="font-mono text-foreground">{usdc(releasedUsdc)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" /> locked{" "}
            <span className="font-mono text-foreground">{usdc(lockedUsdc)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-surface-raised ring-1 ring-border-subtle" />{" "}
            uncommitted{" "}
            <span className="font-mono text-foreground">
              {usdc(Math.max(totalBudget - committedUsdc, 0))}
            </span>
          </span>
        </div>
      </section>

      {/* Agent society map */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Agent society</h2>
          <span className="text-[11px] text-muted">
            live audit of the agents working this Promotion
          </span>
        </div>
        <PromotionSocietyMap promotion={promotion} initialEvents={events} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Timeline */}
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-medium">Timeline</h2>
          <div className="sketch ink border border-border-subtle bg-surface">
            {events.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">
                Events will appear here as agents work this Promotion.
              </div>
            ) : (
              <ol className="divide-y divide-border-subtle">
                {events.map((event) => (
                  <li key={event.eventId} className="flex gap-3 px-4 py-3">
                    <EventIcon type={event.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {eventLabel(event.type)}
                        </span>
                        {event.data.receiptStatus === "SIMULATED" && (
                          <StatusBadge status="SIMULATED" />
                        )}
                        <span className="ml-auto shrink-0 text-[11px] text-muted">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(event.data)
                          .filter(([key]) => key !== "receiptStatus")
                          .map(([key, value]) => (
                            <span
                              key={key}
                              className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-muted"
                            >
                              {key}: {formatEventValue(key, value)}
                            </span>
                          ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Agreement + escrow */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-sm font-medium">Agreement</h2>
            {agreement ? (
              <div className="sketch ink border border-border-subtle bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted">
                    {agreement.agreementId}
                  </span>
                  <StatusBadge status={agreement.status} />
                </div>
                <div className="mt-3 text-xs text-muted">terms hash</div>
                <div className="mt-1 break-all rounded bg-surface-raised p-2 font-mono text-[10px] leading-relaxed text-accent-strong">
                  {agreement.termsHash}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    Base{" "}
                    <span className="font-mono text-foreground">
                      {usdc(agreement.terms.compensation.baseAmountUsdc)}
                    </span>
                  </span>
                  <span>
                    Performance{" "}
                    <span className="font-mono text-foreground">
                      {agreement.terms.compensation.performancePct}%
                    </span>
                  </span>
                  <span className="font-mono">
                    {agreement.terms.usageRights}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">
                  {agreement.terms.milestones.map((milestone, i) => (
                    <div
                      key={milestone.id}
                      className="flex items-center justify-between gap-2 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground">
                          {milestone.id}
                        </div>
                        <div className="truncate font-mono text-[10px] text-muted">
                          {milestone.trigger}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-foreground">
                          {usdc(agreementAmounts[i] ?? 0)}
                        </div>
                        <div className="text-[10px] text-muted">
                          {milestone.releasePct}% of base
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="sketch ink border border-dashed border-border-subtle p-6 text-center text-xs text-muted">
                No agreement yet. Run matching, then start negotiation.
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-medium">Escrow</h2>
            {escrow ? (
              <div className="sketch ink border border-border-subtle bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted">
                    {escrow.escrowId}
                  </span>
                  <StatusBadge status={escrow.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span>
                    Locked{" "}
                    <span className="font-mono text-foreground">
                      {usdc(escrow.amountUsdc)}
                    </span>
                  </span>
                  <span>
                    Fee{" "}
                    <span className="font-mono text-foreground">
                      {usdc(escrow.feeUsdc)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    receipt{" "}
                    <span className="font-mono">{escrow.receipt.receiptId}</span>
                    <StatusBadge status={escrow.receipt.status} />
                  </span>
                  {explorerLink(escrow.receipt.signature) ? (
                    <a
                      href={explorerLink(escrow.receipt.signature)!}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-strong hover:underline"
                    >
                      view on explorer ↗
                    </a>
                  ) : (
                    <span className="text-[10px]">
                      simulated — no on-chain signature
                    </span>
                  )}
                </div>
                <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">
                  {escrow.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center justify-between gap-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {milestone.id}
                          </span>
                          <span className="text-[10px] text-muted">
                            {milestone.releasePct}%
                          </span>
                        </div>
                        <div className="truncate font-mono text-[10px] text-muted">
                          {milestone.trigger}
                          {milestone.receiptId && ` · ${milestone.receiptId}`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-foreground">
                          {usdc(milestone.amountUsdc)}
                        </span>
                        {milestone.released ? (
                          <StatusBadge status="RELEASED" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onReleaseMilestone(milestone.id)}
                            disabled={busy}
                            className="sketch-pill bg-accent px-2.5 py-1 text-[11px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {pending === `release:${milestone.id}`
                              ? "Releasing…"
                              : "Release"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="sketch ink border border-dashed border-border-subtle p-6 text-center text-xs text-muted">
                No escrow yet. Lock it once an agreement is in place.
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Candidates */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Match candidates</h2>
          {matchRun && (
            <span className="font-mono text-[10px] text-muted">
              {matchRun.matchRunId} · {matchRun.weightsVersion} ·{" "}
              {matchRun.status}
            </span>
          )}
        </div>
        <div className="overflow-x-auto sketch ink border border-border-subtle bg-surface">
          {rankedCandidates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              No match run yet. Run matching to rank creators.
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Rank</th>
                  <th className="px-2 py-2.5 font-medium">Creator</th>
                  <th className="px-2 py-2.5 font-medium">Score</th>
                  <th className="px-2 py-2.5 font-medium">Components</th>
                  <th className="px-4 py-2.5 font-medium">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rankedCandidates.map((candidate) => (
                  <tr
                    key={candidate.creatorId}
                    className={candidate.eligible ? "" : "opacity-60"}
                  >
                    <td className="px-4 py-3 align-top font-mono text-muted">
                      #{candidate.rank}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        {candidate.creatorId}
                        {matchRun?.selectedCreatorId === candidate.creatorId && (
                          <span className="rounded-full border border-positive/30 bg-positive/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-positive">
                            selected
                          </span>
                        )}
                        {!candidate.eligible && (
                          <span className="rounded-full border border-negative/30 bg-negative/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-negative">
                            ineligible
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted">
                        {candidate.creatorAgentId}
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-raised">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${candidate.score * 100}%` }}
                          />
                        </div>
                        <span className="font-mono text-foreground">
                          {candidate.score.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top">
                      <div className="flex gap-2">
                        {COMPONENT_KEYS.map(([key, short]) => {
                          const value = candidate.componentScores[key];
                          return (
                            <div
                              key={key}
                              title={`${key}: ${value.toFixed(2)}`}
                              className="flex flex-col items-center gap-1"
                            >
                              <div className="h-1 w-8 overflow-hidden rounded-full bg-surface-raised">
                                <div
                                  className="h-full rounded-full bg-accent-strong"
                                  style={{ width: `${value * 100}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-muted">
                                {short}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="max-w-sm px-4 py-3 align-top">
                      {candidate.eligible ? (
                        <p className="text-[11px] leading-relaxed text-muted">
                          {candidate.explanation}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {candidate.hardFilterReasons.map((reason, i) => (
                            <li
                              key={i}
                              className="rounded bg-negative/10 px-2 py-1 font-mono text-[10px] text-negative"
                            >
                              {reason}
                            </li>
                          ))}
                        </ul>
                      )}
                      {candidate.negotiationId && (
                        <Link
                          href={`/replay/${candidate.negotiationId}`}
                          className="mt-1.5 inline-block text-[11px] text-accent-strong hover:underline"
                        >
                          negotiation replay →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline icons — one glyph per event family
// ---------------------------------------------------------------------------

function EventIcon({ type }: { type: string }) {
  let tone = "bg-accent/10 text-accent-strong";
  let glyph: React.ReactNode;

  if (/MATCH/.test(type)) {
    // target — match run
    glyph = (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
      </>
    );
  } else if (/OFFER|COUNTER|ACCEPT|REJECT|ESCALAT|NEGOTIATION/.test(type)) {
    // speech bubbles — negotiation decisions
    tone = "bg-caution/10 text-caution";
    glyph = (
      <>
        <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
        <path d="M8 11h8M8 14h5" />
      </>
    );
  } else if (/AGREEMENT/.test(type)) {
    // signed document — agreement
    tone = "bg-positive/10 text-positive";
    glyph = (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
        <path d="M14 3v5h5" />
        <path d="m9.5 14 1.8 1.8L15 12" />
      </>
    );
  } else if (/RELEAS/.test(type)) {
    // coin out — release
    tone = "bg-positive/10 text-positive";
    glyph = (
      <>
        <circle cx="9" cy="15" r="5" />
        <path d="M9 12.5v5M7 14h4" />
        <path d="M16 9V3m0 0-2.5 2.5M16 3l2.5 2.5" />
      </>
    );
  } else if (/ESCROW/.test(type)) {
    // padlock — escrow lock
    tone = "bg-caution/10 text-caution";
    glyph = (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        <circle cx="12" cy="15.5" r="1" fill="currentColor" />
      </>
    );
  } else if (/EVIDENCE/.test(type)) {
    // shield check — evidence
    tone = /FAILED/.test(type)
      ? "bg-negative/10 text-negative"
      : "bg-positive/10 text-positive";
    glyph = (
      <>
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" />
        {/FAILED/.test(type) ? (
          <path d="m9.5 9.5 5 5m0-5-5 5" />
        ) : (
          <path d="m9 12 2 2 4-4" />
        )}
      </>
    );
  } else if (/PROMOTION/.test(type)) {
    // flag — promotion lifecycle
    glyph = (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h13l-2.5 4L18 12H5" />
      </>
    );
  } else {
    glyph = <circle cx="12" cy="12" r="3" />;
  }

  return (
    <span
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {glyph}
      </svg>
    </span>
  );
}
