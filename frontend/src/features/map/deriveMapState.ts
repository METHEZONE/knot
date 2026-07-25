/**
 * Pure derivation: promotion data -> MapState.
 *
 * Ordering rule: the most advanced verifiable artifact wins. Escrow trumps
 * negotiation trumps match run trumps bare promotion. Nothing here guesses —
 * every phase and node state is backed by an API field or timeline event.
 */

import type { MapInputs, MapPhase, MapState, CandidateNodeState } from "./types";

function derivePhase(inputs: MapInputs): MapPhase {
  const { escrow, negotiation, candidates } = inputs;

  if (escrow) {
    if (escrow.status === "RELEASED") return "SETTLED";
    if (escrow.status === "PARTIALLY_RELEASED") return "RELEASING";
    return "ESCROW_LOCKED";
  }
  if (negotiation) {
    return negotiation.status === "AGREED" ? "AGREED" : "NEGOTIATING";
  }
  if (candidates.length > 0) return "MATCHING";
  return "CREATED";
}

function deriveCandidateState(
  eligible: boolean,
  isSelected: boolean,
  phase: MapPhase,
): CandidateNodeState {
  if (!eligible) return "filtered";
  if (isSelected) return "selected";
  // Before a selection exists every eligible candidate is lit; afterwards the
  // unselected ones settle back to idle.
  return phase === "MATCHING" ? "lit" : "idle";
}

export function deriveMapState(inputs: MapInputs): MapState {
  const phase = derivePhase(inputs);

  const selectedCreatorId =
    inputs.matchRunSelectedCreatorId ??
    inputs.candidates.find((c) => c.negotiationId !== null)?.creatorId ??
    null;

  const candidates = [...inputs.candidates]
    .sort((a, b) => a.rank - b.rank)
    .map((candidate) => ({
      candidate,
      state: deriveCandidateState(
        candidate.eligible,
        candidate.creatorId === selectedCreatorId,
        phase,
      ),
    }));

  const escrow = inputs.escrow;
  const milestones = escrow?.milestones ?? [];

  return {
    phase,
    candidates,
    selectedCreatorId,
    negotiation: inputs.negotiation,
    escrow,
    escrowSimulated: escrow !== null && escrow.receipt.signature === null,
    releasedMilestones: milestones.filter((m) => m.released).length,
    totalMilestones: milestones.length,
    evidenceSubmitted: inputs.events.some((e) => e.type.startsWith("EVIDENCE")),
    evidencePassed: inputs.events.some((e) => e.type === "EVIDENCE_PASSED"),
    weightsVersion: inputs.matchRunWeightsVersion,
  };
}

export const PHASE_LABELS: Record<MapPhase, string> = {
  CREATED: "Awaiting matching",
  MATCHING: "Matching candidates",
  NEGOTIATING: "Negotiation in progress",
  AGREED: "Terms agreed",
  ESCROW_LOCKED: "Escrow locked",
  RELEASING: "Releasing funds",
  SETTLED: "Settled",
};
