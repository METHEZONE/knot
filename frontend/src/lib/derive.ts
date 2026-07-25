/**
 * Pure derivations over API data.
 *
 * - deriveStage: promotion lifecycle stage from status + timeline events.
 * - computeKpis: brand dashboard KPIs from timelines.
 * - splitMilestoneAmounts: contract money rule — floor base units per
 *   milestone, fold the remainder into the LAST milestone.
 */

import type { Milestone, Promotion, TimelineEvent } from "@/lib/api/types";

export type PromotionStage =
  | "DRAFT"
  | "ACTIVE"
  | "MATCHING"
  | "NEGOTIATING"
  | "AGREED"
  | "LOCKED"
  | "RELEASED"
  | "IN_FLIGHT"
  | "COMPLETED"
  | "CANCELLED";

/**
 * Derive the display stage of a promotion from its raw status plus what the
 * timeline proves has already happened. Later lifecycle evidence wins.
 */
export function deriveStage(
  promotion: Promotion,
  events: TimelineEvent[],
): PromotionStage {
  if (promotion.status === "CANCELLED" || promotion.status === "COMPLETED") {
    return promotion.status;
  }
  const has = (pattern: RegExp) => events.some((e) => pattern.test(e.type));

  if (has(/RELEAS/)) return "RELEASED";
  if (has(/ESCROW_LOCKED/)) return "LOCKED";
  if (has(/AGREEMENT_CREATED|NEGOTIATION_AGREED/)) return "AGREED";
  if (has(/NEGOTIATION|OFFER|COUNTER/)) return "NEGOTIATING";
  if (has(/MATCH_RUN/)) return "MATCHING";
  return promotion.status;
}

export interface BrandKpis {
  /** USDC locked into escrow across all promotions. */
  committedUsdc: number;
  /** USDC released to creators across all promotions. */
  releasedUsdc: number;
  /** Agreements reached. */
  agreements: number;
  /** Average negotiation rounds to agreement; null when none agreed yet. */
  avgRounds: number | null;
}

export function computeKpis(timelines: TimelineEvent[][]): BrandKpis {
  let committedUsdc = 0;
  let releasedUsdc = 0;
  let agreements = 0;
  const rounds: number[] = [];

  for (const events of timelines) {
    for (const e of events) {
      const amount =
        typeof e.data.amountUsdc === "number" ? e.data.amountUsdc : 0;
      if (e.type === "ESCROW_LOCKED") committedUsdc += amount;
      if (/RELEAS/.test(e.type)) releasedUsdc += amount;
      if (e.type === "AGREEMENT_CREATED") agreements += 1;
      if (e.type === "NEGOTIATION_AGREED" && typeof e.data.rounds === "number") {
        rounds.push(e.data.rounds);
      }
    }
  }

  return {
    committedUsdc,
    releasedUsdc,
    agreements,
    avgRounds: rounds.length
      ? rounds.reduce((a, b) => a + b, 0) / rounds.length
      : null,
  };
}

/**
 * Split an integer USDC total across milestones by releasePct.
 * Every milestone except the last gets floor(total * pct / 100);
 * the LAST milestone absorbs the remainder (contract rule).
 * Example: 650 at 30/70 -> [195, 455].
 */
export function splitMilestoneAmounts(
  totalUsdc: number,
  milestones: Pick<Milestone, "releasePct">[],
): number[] {
  if (milestones.length === 0) return [];
  const amounts = milestones.map((m) =>
    Math.floor((totalUsdc * m.releasePct) / 100),
  );
  const allocated = amounts
    .slice(0, -1)
    .reduce((sum, amount) => sum + amount, 0);
  amounts[amounts.length - 1] = totalUsdc - allocated;
  return amounts;
}
