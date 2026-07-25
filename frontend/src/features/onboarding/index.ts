// KNOT feature module: onboarding (PRD v2 §4/§5)
// Shared shell + ceremony used by both /onboarding/creator and /onboarding/brand.
export const featureName = "onboarding" as const;

export { EggProgress } from "./EggProgress";
export { StepShell } from "./StepShell";
export { HatchingCeremony } from "./HatchingCeremony";
