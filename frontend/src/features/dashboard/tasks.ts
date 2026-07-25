import type { Escrow, NegotiationTerms } from "@/lib/api/types";
import { formatDate, usdc } from "@/lib/format";

/** A creator to-do derived from agreement terms + escrow milestone state. */
export interface CreatorTask {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

/**
 * Derive the creator task list for one deal:
 * - each deliverable -> "Submit {count}× {format} by {postWindow.end}"
 * - each EVIDENCE_VERIFIED milestone -> "Evidence needed for milestone {id}"
 * - other milestone triggers -> awaiting/released state lines
 */
export function deriveCreatorTasks(
  terms: NegotiationTerms,
  escrow: Escrow | null,
): CreatorTask[] {
  const releasedById = new Map(
    (escrow?.milestones ?? []).map((m) => [m.id, m.released] as const),
  );
  const amountById = new Map(
    (escrow?.milestones ?? []).map((m) => [m.id, m.amountUsdc] as const),
  );

  const evidenceDone = terms.milestones
    .filter((m) => m.trigger === "EVIDENCE_VERIFIED")
    .every((m) => releasedById.get(m.id) === true);

  const deliverableTasks: CreatorTask[] = terms.deliverables.map((d) => ({
    id: `deliver-${d.format}`,
    label: `Submit ${d.count}× ${d.format} by ${formatDate(d.postWindow.end)}`,
    done: evidenceDone,
    hint: `${d.revisionRounds} revision ${d.revisionRounds === 1 ? "round" : "rounds"}`,
  }));

  const milestoneTasks: CreatorTask[] = terms.milestones.map((m) => {
    const released = releasedById.get(m.id) === true;
    const amount = amountById.get(m.id);
    const hint =
      amount !== undefined
        ? `${m.releasePct}% · ${usdc(amount)}`
        : `${m.releasePct}%`;

    if (released) {
      return { id: `ms-${m.id}`, label: `Milestone “${m.id}” released`, done: true, hint };
    }
    if (m.trigger === "EVIDENCE_VERIFIED") {
      return {
        id: `ms-${m.id}`,
        label: `Evidence needed for milestone “${m.id}”`,
        done: false,
        hint,
      };
    }
    return {
      id: `ms-${m.id}`,
      label: `Awaiting release of milestone “${m.id}” (${m.trigger})`,
      done: false,
      hint,
    };
  });

  return [...deliverableTasks, ...sortUnreleasedFirst(milestoneTasks)];
}

/** Unreleased milestones first so the actionable items float up. */
function sortUnreleasedFirst(tasks: CreatorTask[]): CreatorTask[] {
  return [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
}
