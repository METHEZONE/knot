/**
 * Agent Society Map v1 — audit-layer state model.
 *
 * The map is a pure projection of promotion data (timeline + match run +
 * negotiation + escrow). No state is invented client-side; every visual
 * state traces back to an API field.
 */

import type {
  Escrow,
  MatchCandidate,
  Negotiation,
  TimelineEvent,
} from "@/lib/api/types";

/** Lifecycle phase of the promotion as seen by the map. */
export type MapPhase =
  | "CREATED"
  | "MATCHING"
  | "NEGOTIATING"
  | "AGREED"
  | "ESCROW_LOCKED"
  | "RELEASING"
  | "SETTLED";

/** Visual state of one creator-agent candidate node. */
export type CandidateNodeState =
  | "lit" // eligible, scored, lights up during matching
  | "selected" // the creator the brand agent picked
  | "idle" // eligible but not selected (post-selection fade)
  | "filtered"; // hard-filtered: dimmed, reason tooltip

export interface CandidateNode {
  candidate: MatchCandidate;
  state: CandidateNodeState;
}

export interface MapState {
  phase: MapPhase;
  candidates: CandidateNode[];
  selectedCreatorId: string | null;
  negotiation: Negotiation | null;
  escrow: Escrow | null;
  /** True when the escrow receipt is SIMULATED (signature: null). */
  escrowSimulated: boolean;
  releasedMilestones: number;
  totalMilestones: number;
  evidenceSubmitted: boolean;
  evidencePassed: boolean;
  weightsVersion: string | null;
}

export interface MapInputs {
  events: TimelineEvent[];
  matchRunWeightsVersion: string | null;
  matchRunSelectedCreatorId: string | null;
  candidates: MatchCandidate[];
  negotiation: Negotiation | null;
  escrow: Escrow | null;
}
