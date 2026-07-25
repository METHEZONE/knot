/**
 * KNOT demo fixtures.
 *
 * Realistic seed data matching the knot-api v1 contracts. Served by the data
 * provider when NEXT_PUBLIC_KNOT_DEMO=1 or when the API is unreachable.
 *
 * Seed IDs follow the backend convention: brand-001/brand-agent-001,
 * creator-001..003 (creator-agent-00N). Money is integer USDC; fee is 0;
 * milestone splits floor base units and fold the remainder into the LAST
 * milestone (650 → 30% = 195, last milestone gets 455).
 */

import type {
  Agreement,
  Brand,
  Creator,
  CreatorDiagnosis,
  Escrow,
  Evidence,
  MatchCandidate,
  MatchRun,
  Negotiation,
  NegotiationMessage,
  NegotiationTerms,
  Promotion,
  TimelineEvent,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Brand & creators
// ---------------------------------------------------------------------------

export const demoBrand: Brand = {
  brandId: "brand-001",
  brandAgentId: "brand-agent-001",
  name: "Demo Skincare Co.",
  category: "beauty",
};

export const demoCreators: Creator[] = [
  {
    creatorId: "creator-001",
    creatorAgentId: "creator-agent-001",
    name: "Demo Beauty",
    category: "beauty",
    rateCard: { minUsdc: 650, maxUsdc: 900 },
    audience: ["18-34", "skincare", "beauty routines"],
  },
  {
    creatorId: "creator-002",
    creatorAgentId: "creator-agent-002",
    name: "Demo Fitness",
    category: "fitness",
    rateCard: { minUsdc: 500, maxUsdc: 750 },
    audience: ["18-44", "home workouts", "wellness"],
  },
  {
    creatorId: "creator-003",
    creatorAgentId: "creator-agent-003",
    name: "Demo Lifestyle",
    category: "lifestyle",
    rateCard: { minUsdc: 400, maxUsdc: 600 },
    audience: ["25-44", "daily routines", "product hauls"],
  },
];

/**
 * Fixture-only diagnosis snapshot for creator-001. Feeds the placeholder
 * diagnosis card on the creator dashboard until the signal pipeline ships.
 */
export const demoCreatorDiagnosis: CreatorDiagnosis = {
  audience: ["18-34", "skincare", "beauty routines"],
  engagementRate: 0.048,
  topFormats: ["instagramReel", "instagramStory", "tiktokVideo"],
  rateBand: { minUsdc: 650, maxUsdc: 900 },
};

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export const demoPromotion: Promotion = {
  promotionId: "promo-001",
  brandId: "brand-001",
  title: "Summer Skincare Launch",
  objective:
    "Drive awareness and first purchases for the new SPF daily moisturizer ahead of peak summer.",
  category: "beauty",
  targetAudience: ["18-34", "skincare enthusiasts", "US"],
  budget: { totalUsdc: 2000, maxPerCreatorUsdc: 800 },
  deliverables: [
    { format: "instagramReel", count: 1 },
    { format: "instagramStory", count: 2 },
  ],
  postingWindow: { start: "2026-08-03T00:00:00Z", end: "2026-08-21T23:59:59Z" },
  usageRights: "organicOnly",
  constraints: {
    requiredDisclosures: ["#ad", "#sponsored"],
    prohibitedClaims: ["treats skin conditions", "dermatologist approved"],
    requiredCategories: ["beauty"],
    prohibitedCategories: ["gambling", "tobacco"],
    maxPerformancePct: 10,
  },
  autonomy: { maxNegotiationRounds: 5, autoEscrow: true, autoRelease: false },
  status: "ACTIVE",
  createdAt: "2026-07-20T09:00:00Z",
};

// ---------------------------------------------------------------------------
// Match run & candidates
// ---------------------------------------------------------------------------

export const demoMatchRun: MatchRun = {
  matchRunId: "mr-001",
  promotionId: "promo-001",
  status: "COMPLETED",
  selectedCreatorId: "creator-001",
  selectedCreatorAgentId: "creator-agent-001",
  weightsVersion: "weights-2026.07",
  createdAt: "2026-07-20T09:05:12Z",
};

export const demoCandidates: MatchCandidate[] = [
  {
    creatorId: "creator-001",
    creatorAgentId: "creator-agent-001",
    eligible: true,
    score: 0.87,
    componentScores: {
      category: 1.0,
      budget: 0.78,
      schedule: 0.92,
      deliverable: 1.0,
      reputation: 0.81,
    },
    hardFilterReasons: [],
    rank: 1,
    explanation:
      "Exact category match (beauty). Rate card floor of 650 USDC fits under the 800 USDC per-creator cap. Fully available inside the posting window and covers both requested formats.",
    negotiationId: "neg-001",
  },
  {
    creatorId: "creator-003",
    creatorAgentId: "creator-agent-003",
    eligible: true,
    score: 0.64,
    componentScores: {
      category: 0.55,
      budget: 1.0,
      schedule: 0.85,
      deliverable: 0.67,
      reputation: 0.62,
    },
    hardFilterReasons: [],
    rank: 2,
    explanation:
      "Adjacent category (lifestyle) with partial audience overlap. Entire rate card (400-600 USDC) sits under the cap, but reel production track record is thinner than rank 1.",
    negotiationId: null,
  },
  {
    creatorId: "creator-002",
    creatorAgentId: "creator-agent-002",
    eligible: false,
    score: 0,
    componentScores: {
      category: 0,
      budget: 0.9,
      schedule: 0.7,
      deliverable: 1.0,
      reputation: 0.74,
    },
    hardFilterReasons: [
      "requiredCategories: creator category 'fitness' is not in required categories ['beauty']",
    ],
    rank: 3,
    explanation:
      "Excluded by hard filter: the promotion requires the beauty category and this creator publishes fitness content. Soft scores are shown for transparency but the candidate cannot be selected.",
    negotiationId: null,
  },
];

// ---------------------------------------------------------------------------
// Negotiation (3 rounds: OFFER 500 → COUNTER 650 → ACCEPT)
// ---------------------------------------------------------------------------

const sharedPostWindow = {
  start: "2026-08-03T00:00:00Z",
  end: "2026-08-21T23:59:59Z",
};

const baseDeliverables = [
  { format: "instagramReel", count: 1, postWindow: sharedPostWindow, revisionRounds: 2 },
  { format: "instagramStory", count: 2, postWindow: sharedPostWindow, revisionRounds: 1 },
];

const baseMilestones = [
  { id: "contract", trigger: "AGREEMENT_SIGNED", releasePct: 30 },
  { id: "content", trigger: "EVIDENCE_VERIFIED", releasePct: 70 },
];

const offerTerms: NegotiationTerms = {
  compensation: { structure: "fixedPlusPerformance", baseAmountUsdc: 500, performancePct: 5 },
  deliverables: baseDeliverables,
  usageRights: "organicOnly",
  milestones: baseMilestones,
};

const counterTerms: NegotiationTerms = {
  ...offerTerms,
  compensation: { structure: "fixedPlusPerformance", baseAmountUsdc: 650, performancePct: 5 },
};

export const demoTermsHash =
  "sha256:9c4f1e2ab07d5386c1e94fd2a0b7355e8d21c6a4f0e9b8d3175a2c40e6f81b9d";

export const demoNegotiation: Negotiation = {
  negotiationId: "neg-001",
  status: "AGREED",
  currentRound: 3,
  maxRounds: 5,
  currentTerms: counterTerms,
  contextId: "ctx-3f8a52d1",
  taskId: "task-b64c9e07",
};

export const demoNegotiationMessages: NegotiationMessage[] = [
  {
    messageId: "msg-001",
    role: "ROLE_USER",
    sequence: 1,
    payload: {
      schema: "knot.negotiation.v1",
      type: "OFFER",
      round: 1,
      terms: offerTerms,
      changedFields: [],
      rationale:
        "Opening at 500 USDC base plus a 5% performance bonus for one reel and two stories with organic-only usage. This sits mid-market for beauty content of this scope and leaves headroom under the 800 USDC per-creator cap.",
    },
    createdAt: "2026-07-20T09:06:02Z",
  },
  {
    messageId: "msg-002",
    role: "ROLE_AGENT",
    sequence: 2,
    payload: {
      schema: "knot.negotiation.v1",
      type: "COUNTER",
      round: 2,
      terms: counterTerms,
      changedFields: ["compensation.baseAmountUsdc"],
      rationale:
        "500 USDC is below this creator's published rate-card floor of 650 USDC for beauty content. Countering at the floor — 650 USDC base — with deliverables, usage rights, and milestone split unchanged. This still fits within the promotion's 800 USDC per-creator cap.",
    },
    createdAt: "2026-07-20T09:06:41Z",
  },
  {
    messageId: "msg-003",
    role: "ROLE_USER",
    sequence: 3,
    payload: {
      schema: "knot.negotiation.v1",
      type: "ACCEPT",
      round: 3,
      terms: counterTerms,
      changedFields: [],
      rationale:
        "650 USDC clears the rate-card floor, stays under the 800 USDC per-creator cap, and keeps total spend within the 2000 USDC budget. Accepting the counter and locking the terms hash for the agreement.",
      termsHash: demoTermsHash,
    },
    createdAt: "2026-07-20T09:07:15Z",
  },
];

// ---------------------------------------------------------------------------
// Agreement (milestones: contract 30% / content 70%)
// ---------------------------------------------------------------------------

export const demoAgreement: Agreement = {
  agreementId: "agr-001",
  terms: counterTerms,
  canonicalTermsJson: JSON.stringify(counterTerms),
  termsHash: demoTermsHash,
  status: "ACTIVE",
};

// ---------------------------------------------------------------------------
// Escrow (SIMULATED receipt — signature is null, never link an explorer)
// ---------------------------------------------------------------------------

export const demoEscrow: Escrow = {
  escrowId: "esc-001",
  agreementId: "agr-001",
  status: "LOCKED",
  amountUsdc: 650,
  feeUsdc: 0,
  milestones: [
    {
      id: "contract",
      trigger: "AGREEMENT_SIGNED",
      releasePct: 30,
      amountUsdc: 195, // floor(650 * 0.30)
      released: false,
      receiptId: null,
    },
    {
      id: "content",
      trigger: "EVIDENCE_VERIFIED",
      releasePct: 70,
      amountUsdc: 455, // remainder folds into the LAST milestone
      released: false,
      receiptId: null,
    },
  ],
  receipt: {
    receiptId: "rcpt-001",
    status: "SIMULATED",
    signature: null,
    amountUsdc: 650,
    createdAt: "2026-07-20T09:07:32Z",
  },
};

// ---------------------------------------------------------------------------
// Evidence (PASSED)
// ---------------------------------------------------------------------------

export const demoEvidence: Evidence = {
  evidenceId: "evd-001",
  agreementId: "agr-001",
  url: "https://www.instagram.com/reel/DEMO-summer-skincare/",
  submittedByAgentId: "creator-agent-001",
  milestoneId: "content",
  status: "PASSED",
  observations: {
    urlReachable: true,
    brandMentioned: true,
    disclosurePresent: true,
    prohibitedClaimsFound: [],
  },
  policyDecision: { allowed: true, ruleVersion: "policy-v1" },
  createdAt: "2026-08-05T14:22:10Z",
};

// ---------------------------------------------------------------------------
// Timelines
// ---------------------------------------------------------------------------

export const demoPromotionTimeline: TimelineEvent[] = [
  {
    eventId: "evt-001",
    type: "PROMOTION_CREATED",
    data: { promotionId: "promo-001", title: "Summer Skincare Launch" },
    createdAt: "2026-07-20T09:00:00Z",
  },
  {
    eventId: "evt-002",
    type: "PROMOTION_ACTIVATED",
    data: { promotionId: "promo-001" },
    createdAt: "2026-07-20T09:02:30Z",
  },
  {
    eventId: "evt-003",
    type: "MATCH_RUN_COMPLETED",
    data: { matchRunId: "mr-001", candidateCount: 3, selectedCreatorId: "creator-001" },
    createdAt: "2026-07-20T09:05:12Z",
  },
  {
    eventId: "evt-004",
    type: "NEGOTIATION_STARTED",
    data: { negotiationId: "neg-001", creatorAgentId: "creator-agent-001", maxRounds: 5 },
    createdAt: "2026-07-20T09:06:02Z",
  },
  {
    eventId: "evt-005",
    type: "NEGOTIATION_AGREED",
    data: { negotiationId: "neg-001", rounds: 3, baseAmountUsdc: 650 },
    createdAt: "2026-07-20T09:07:15Z",
  },
  {
    eventId: "evt-006",
    type: "AGREEMENT_CREATED",
    data: { agreementId: "agr-001", termsHash: demoTermsHash },
    createdAt: "2026-07-20T09:07:20Z",
  },
  {
    eventId: "evt-007",
    type: "ESCROW_LOCKED",
    data: { escrowId: "esc-001", amountUsdc: 650, receiptStatus: "SIMULATED" },
    createdAt: "2026-07-20T09:07:32Z",
  },
  {
    eventId: "evt-008",
    type: "EVIDENCE_SUBMITTED",
    data: { evidenceId: "evd-001", milestoneId: "content" },
    createdAt: "2026-08-05T14:22:10Z",
  },
  {
    eventId: "evt-009",
    type: "EVIDENCE_PASSED",
    data: { evidenceId: "evd-001", ruleVersion: "policy-v1" },
    createdAt: "2026-08-05T14:23:05Z",
  },
];

// Onboarding fixtures (cached SNS/website ingest + diagnosis-v1) live in a
// sibling module; re-exported so `@/lib/fixtures` stays the single entry point.
export * from "./onboarding";

export const demoNegotiationEvents: TimelineEvent[] = [
  {
    eventId: "nevt-001",
    type: "OFFER_SENT",
    data: { round: 1, baseAmountUsdc: 500, by: "brand-agent-001" },
    createdAt: "2026-07-20T09:06:02Z",
  },
  {
    eventId: "nevt-002",
    type: "COUNTER_SENT",
    data: {
      round: 2,
      baseAmountUsdc: 650,
      by: "creator-agent-001",
      changedFields: ["compensation.baseAmountUsdc"],
    },
    createdAt: "2026-07-20T09:06:41Z",
  },
  {
    eventId: "nevt-003",
    type: "ACCEPTED",
    data: { round: 3, baseAmountUsdc: 650, by: "brand-agent-001", termsHash: demoTermsHash },
    createdAt: "2026-07-20T09:07:15Z",
  },
];
