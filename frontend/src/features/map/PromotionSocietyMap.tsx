"use client";

/**
 * Promotion-page embed for the Agent Society Map: resolves live promotion
 * data (match run, candidates, negotiation, escrow) from the timeline and
 * projects it onto the map, with a phase strip and legend.
 */

import type { Promotion, TimelineEvent } from "@/lib/api/types";
import { AgentSocietyMap } from "./AgentSocietyMap";
import { deriveMapState, PHASE_LABELS } from "./deriveMapState";
import { usePromotionMapData } from "./usePromotionMapData";

export function PromotionSocietyMap({
  promotion,
  initialEvents,
}: {
  promotion: Promotion;
  initialEvents: TimelineEvent[];
}) {
  const data = usePromotionMapData(promotion.promotionId, initialEvents);

  const state = deriveMapState({
    events: data.events,
    matchRunWeightsVersion: data.matchRun?.weightsVersion ?? null,
    matchRunSelectedCreatorId: data.matchRun?.selectedCreatorId ?? null,
    candidates: data.candidates,
    negotiation: data.negotiation,
    escrow: data.escrow,
  });

  return (
    <div className="overflow-hidden sketch ink border border-border-subtle bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-subtle px-5 py-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              state.phase === "SETTLED" || state.phase === "AGREED"
                ? "bg-positive"
                : state.phase === "CREATED"
                  ? "bg-muted"
                  : "bg-accent"
            }`}
          />
          {PHASE_LABELS[state.phase]}
        </span>
        {state.negotiation && (
          <span className="font-mono text-[11px] text-muted">
            negotiation {state.negotiation.status.toLowerCase()} · round{" "}
            {state.negotiation.currentRound}/{state.negotiation.maxRounds}
          </span>
        )}
        {state.totalMilestones > 0 && (
          <span className="font-mono text-[11px] text-muted">
            milestones {state.releasedMilestones}/{state.totalMilestones} released
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-muted">
          {state.weightsVersion ?? (data.loading ? "syncing…" : "no match run yet")}
        </span>
      </div>

      <AgentSocietyMap state={state} />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border-subtle px-5 py-3 text-[11px] text-muted">
        <LegendDot className="border border-accent bg-accent/20" label="candidate (scored)" />
        <LegendDot className="border-2 border-positive bg-positive/20" label="selected / agreed" />
        <LegendDot className="border border-dashed border-border-subtle bg-transparent opacity-50" label="hard-filtered (hover for reason)" />
        <LegendDot className="border border-caution bg-caution/20" label="simulated escrow" />
        <LegendDot className="bg-caution" label="funds moving" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}
