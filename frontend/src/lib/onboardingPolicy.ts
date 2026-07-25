/**
 * The autonomy mandate an agent signs at the end of the hatching ceremony.
 *
 * Field and rule names mirror the seeded `agentPolicies` docs and the checks in
 * backend/libs/policies/{creator,brand}.py, so the JSON the user watches get
 * signed is the same policy that later gates the agent. Nothing here is
 * cosmetic — if a field is shown, the engine reads it.
 */

import type {
  BrandOnboardRequest,
  CreatorOnboardRequest,
  UsageRights,
} from "@/lib/api/types";

/**
 * Usage-rights presets, least to most permissive. A creator who accepts a
 * preset implicitly accepts every more restrictive one, which is how the seeded
 * policies read (creator-001 chose paidBoost30d → ["organicOnly","paidBoost30d"]).
 */
export const USAGE_RIGHTS_LADDER: UsageRights[] = [
  "organicOnly",
  "paidBoost30d",
  "fullLicense90d",
];

export function allowedUsageRights(chosen: UsageRights): UsageRights[] {
  const index = USAGE_RIGHTS_LADDER.indexOf(chosen);
  return USAGE_RIGHTS_LADDER.slice(0, index + 1);
}

/**
 * Fields onboarding does not ask about (PRD v2 §4 step 3 collects five), kept
 * at the seeded defaults so a hatched agent matches creator-001's policy shape.
 */
const CREATOR_POLICY_DEFAULTS = {
  maxRevisionRounds: 1,
  maxExclusivityDays: 0,
} as const;

export interface CreatorAgentPolicy {
  agentId: string;
  policyVersion: 1;
  agentType: "CREATOR";
  creator: {
    minBaseUsdc: number;
    blockedIndustries: string[];
    maxDeliverablesPerMonth: number;
    minDaysToPost: number;
    allowedUsageRights: UsageRights[];
    maxRevisionRounds: number;
    maxExclusivityDays: number;
  };
  active: true;
}

export function creatorAgentPolicy(
  agentId: string,
  input: CreatorOnboardRequest,
): CreatorAgentPolicy {
  return {
    agentId,
    policyVersion: 1,
    agentType: "CREATOR",
    creator: {
      minBaseUsdc: input.rateCard.minUsdc,
      blockedIndustries: input.blockedIndustries,
      maxDeliverablesPerMonth: input.monthlyCapacity,
      minDaysToPost: input.leadTimeDays,
      allowedUsageRights: allowedUsageRights(input.usageRights),
      ...CREATOR_POLICY_DEFAULTS,
    },
    active: true,
  };
}

export interface BrandAgentPolicy {
  agentId: string;
  policyVersion: 1;
  agentType: "BRAND";
  brand: {
    /** Standing caps applied to every Promotion this agent runs. */
    budget: { totalUsdc: number; maxPerCreatorUsdc: number };
    /** Above this, the agent must ask a human before committing. */
    autoApproveCapUsdc: number;
    maxNegotiationRounds: number;
    autoEscrow: boolean;
    autoRelease: boolean;
    prohibitedCategories: string[];
    allowedUsageRights: UsageRights[];
  };
  active: true;
}

export function brandAgentPolicy(
  agentId: string,
  input: BrandOnboardRequest,
): BrandAgentPolicy {
  return {
    agentId,
    policyVersion: 1,
    agentType: "BRAND",
    brand: {
      budget: input.budget,
      autoApproveCapUsdc: input.autonomy.autoApproveCapUsdc,
      maxNegotiationRounds: input.autonomy.maxNegotiationRounds,
      autoEscrow: input.autonomy.autoEscrow,
      autoRelease: input.autonomy.autoRelease,
      prohibitedCategories: input.blockedCategories,
      allowedUsageRights: allowedUsageRights(input.usageRights),
    },
    active: true,
  };
}

/** Pretty-printed mandate for the signature scene. */
export function mandateJson(policy: CreatorAgentPolicy | BrandAgentPolicy): string {
  return JSON.stringify(policy, null, 2);
}
