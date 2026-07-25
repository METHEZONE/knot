// KNOT feature module: map — Agent Society Map v1 (audit layer).
export { AgentSocietyMap } from "./AgentSocietyMap";
export { PromotionSocietyMap } from "./PromotionSocietyMap";
export { deriveMapState, PHASE_LABELS } from "./deriveMapState";
export { usePromotionMapData } from "./usePromotionMapData";
export type {
  CandidateNode,
  CandidateNodeState,
  MapInputs,
  MapPhase,
  MapState,
} from "./types";
