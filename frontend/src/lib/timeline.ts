/**
 * Human copy for timeline events, shared by the Agent Society Map and the
 * notification feed. Falls back to a prettified event type for unknown events.
 * User copy always says "Promotion", never "campaign".
 */

import type { TimelineEvent } from "@/lib/api/types";
import { usdc } from "@/lib/format";

function num(data: Record<string, unknown>, key: string): number | null {
  const value = data[key];
  return typeof value === "number" ? value : null;
}

function str(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" ? value : null;
}

function prettify(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** One-line human description of a timeline event. */
export function describeTimelineEvent(event: TimelineEvent): string {
  const d = event.data ?? {};
  switch (event.type) {
    case "PROMOTION_CREATED":
      return "Promotion created";
    case "PROMOTION_ACTIVATED":
      return "Promotion activated — agents may now match";
    case "MATCH_RUN_STARTED":
      return "Matching started — scoring creator agents";
    case "MATCH_RUN_COMPLETED": {
      const count = num(d, "candidateCount");
      const selected = str(d, "selectedCreatorId");
      const head = count !== null ? `Matching completed — ${count} candidates scored` : "Matching completed";
      return selected ? `${head}, ${selected} selected` : head;
    }
    case "NEGOTIATION_STARTED": {
      const agent = str(d, "creatorAgentId");
      return agent ? `Negotiation opened with ${agent}` : "Negotiation opened";
    }
    case "NEGOTIATION_AGREED": {
      const rounds = num(d, "rounds");
      const base = num(d, "baseAmountUsdc");
      const parts = ["Terms agreed"];
      if (rounds !== null) parts.push(`in ${rounds} rounds`);
      if (base !== null) parts.push(`at ${usdc(base)} base`);
      return parts.join(" ");
    }
    case "NEGOTIATION_REJECTED":
      return "Negotiation rejected — no agreement reached";
    case "NEGOTIATION_ESCALATED":
      return "Negotiation escalated for human review";
    case "AGREEMENT_CREATED":
      return "Agreement created — canonical terms hash locked";
    case "ESCROW_LOCKED": {
      const amount = num(d, "amountUsdc");
      const receipt = str(d, "receiptStatus");
      const head = amount !== null ? `Escrow locked — ${usdc(amount)}` : "Escrow locked";
      return receipt === "SIMULATED" ? `${head} (simulated)` : head;
    }
    case "MILESTONE_RELEASED": {
      const amount = num(d, "amountUsdc");
      const milestone = str(d, "milestoneId");
      const head = amount !== null ? `Milestone released — ${usdc(amount)}` : "Milestone released";
      return milestone ? `${head} (${milestone})` : head;
    }
    case "EVIDENCE_SUBMITTED":
      return "Evidence submitted for verification";
    case "EVIDENCE_PASSED":
      return "Evidence verified — policy checks passed";
    case "EVIDENCE_FAILED":
      return "Evidence verification failed";
    default:
      return prettify(event.type);
  }
}
