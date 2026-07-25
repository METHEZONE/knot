/**
 * Backend seed identities (knot-api ships with these). The API has no
 * "list agreements/negotiations for creator" route yet, so creator-side
 * views resolve their working set from these well-known seed IDs.
 */
export const SEED = {
  brandId: "brand-001",
  brandAgentId: "brand-agent-001",
  creatorId: "creator-001",
  creatorAgentId: "creator-agent-001",
  negotiationId: "neg-001",
  agreementId: "agr-001",
  escrowId: "esc-001",
} as const;
