/**
 * KNOT API v1 types.
 *
 * Mirrors the knot-api (FastAPI) contract exactly. All JSON is camelCase.
 * Money is integer USDC amounts; fee is always 0. Milestone splits floor
 * base units and fold the remainder into the LAST milestone.
 */

// ---------------------------------------------------------------------------
// Envelope & errors
// ---------------------------------------------------------------------------

export interface EnvelopeMeta {
  requestId: string;
  timestamp: string;
  schemaVersion: "v1";
}

/** Every successful response: {"data": {...}, "meta": {...}} */
export interface Envelope<T> {
  data: T;
  meta: EnvelopeMeta;
}

export interface ProblemViolation {
  field: string;
  rule: string;
}

/** RFC 7807 problem details returned on errors. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  violations?: ProblemViolation[];
}

// ---------------------------------------------------------------------------
// Shared value objects
// ---------------------------------------------------------------------------

export type UsageRights = "organicOnly" | "paidBoost30d" | "fullLicense90d";

export interface Budget {
  /** Integer USDC. */
  totalUsdc: number;
  /** Integer USDC. */
  maxPerCreatorUsdc: number;
}

export interface Deliverable {
  format: string;
  count: number;
}

export interface PostingWindow {
  start: string;
  end: string;
}

export interface PromotionConstraints {
  requiredDisclosures: string[];
  prohibitedClaims: string[];
  requiredCategories: string[];
  prohibitedCategories: string[];
  maxPerformancePct: number;
}

export interface PromotionAutonomy {
  /** Must be <= 5. */
  maxNegotiationRounds: number;
  autoEscrow: boolean;
  autoRelease: boolean;
}

// ---------------------------------------------------------------------------
// Promotion
// ---------------------------------------------------------------------------

export type PromotionStatus =
  | "DRAFT"
  | "ACTIVE"
  | "MATCHING"
  | "NEGOTIATING"
  | "AGREED"
  | "IN_FLIGHT"
  | "COMPLETED"
  | "CANCELLED";

export interface PromotionCreateRequest {
  title: string;
  objective: string;
  category: string;
  targetAudience: string[];
  budget: Budget;
  deliverables: Deliverable[];
  postingWindow: PostingWindow;
  usageRights: UsageRights;
  constraints: PromotionConstraints;
  autonomy: PromotionAutonomy;
}

export interface Promotion extends PromotionCreateRequest {
  promotionId: string;
  brandId: string;
  status: PromotionStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface MatchRun {
  matchRunId: string;
  promotionId: string;
  status: MatchRunStatus;
  selectedCreatorId: string | null;
  selectedCreatorAgentId: string | null;
  weightsVersion: string;
  createdAt: string;
}

export interface ComponentScores {
  category: number;
  budget: number;
  schedule: number;
  deliverable: number;
  reputation: number;
}

export interface MatchCandidate {
  creatorId: string;
  creatorAgentId: string;
  eligible: boolean;
  score: number;
  componentScores: ComponentScores;
  hardFilterReasons: string[];
  rank: number;
  explanation: string;
  negotiationId: string | null;
}

// ---------------------------------------------------------------------------
// Negotiation
// ---------------------------------------------------------------------------

export type NegotiationStatus = "AGREED" | "REJECTED" | "COUNTERED" | "ESCALATED";

export type NegotiationMessageType =
  | "OFFER"
  | "COUNTER"
  | "ACCEPT"
  | "REJECT"
  | "ESCALATE";

export type NegotiationRole = "ROLE_USER" | "ROLE_AGENT";

export interface Compensation {
  structure: string;
  /** Integer USDC. */
  baseAmountUsdc: number;
  performancePct: number;
}

export interface NegotiationDeliverable {
  format: string;
  count: number;
  postWindow: PostingWindow;
  revisionRounds: number;
}

export interface Milestone {
  id: string;
  trigger: string;
  releasePct: number;
}

export interface NegotiationTerms {
  compensation: Compensation;
  deliverables: NegotiationDeliverable[];
  usageRights: UsageRights;
  milestones: Milestone[];
}

export interface NegotiationPayload {
  schema: "knot.negotiation.v1";
  type: NegotiationMessageType;
  round: number;
  terms: NegotiationTerms;
  changedFields: string[];
  rationale: string;
  /** Present on ACCEPT: hash of the accepted canonical terms. */
  termsHash?: string;
}

export interface NegotiationMessage {
  messageId: string;
  role: NegotiationRole;
  sequence: number;
  payload: NegotiationPayload;
  createdAt: string;
}

export interface Negotiation {
  negotiationId: string;
  status: NegotiationStatus;
  currentRound: number;
  maxRounds: number;
  currentTerms: NegotiationTerms;
  contextId: string;
  taskId: string;
}

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export type AgreementStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELLED";

export interface Agreement {
  agreementId: string;
  terms: NegotiationTerms;
  canonicalTermsJson: string;
  termsHash: string;
  status: AgreementStatus;
}

// ---------------------------------------------------------------------------
// Escrow & payments
// ---------------------------------------------------------------------------

export type EscrowStatus = "LOCKED" | "PARTIALLY_RELEASED" | "RELEASED";

export type ReceiptStatus = "SIMULATED" | "CONFIRMED";

/**
 * Transaction receipt. SIMULATED receipts always have signature: null —
 * render them as a "simulated" state; NEVER fabricate explorer links.
 * Only when signature is non-null link to:
 *   https://explorer.solana.com/tx/{signature}?cluster=devnet
 */
export interface Receipt {
  receiptId: string;
  status: ReceiptStatus;
  signature: string | null;
  /** Integer USDC. */
  amountUsdc: number;
  createdAt: string;
}

export interface EscrowMilestoneState {
  id: string;
  trigger: string;
  releasePct: number;
  /** Integer USDC (floored; remainder folded into the LAST milestone). */
  amountUsdc: number;
  released: boolean;
  receiptId: string | null;
}

export interface Escrow {
  escrowId: string;
  agreementId: string;
  status: EscrowStatus;
  /** Integer USDC. */
  amountUsdc: number;
  /** Always 0. */
  feeUsdc: number;
  milestones: EscrowMilestoneState[];
  receipt: Receipt;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export type EvidenceStatus = "PENDING" | "PASSED" | "FAILED";

export interface EvidenceObservations {
  urlReachable: boolean;
  brandMentioned: boolean;
  disclosurePresent: boolean;
  prohibitedClaimsFound: string[];
}

export interface PolicyDecision {
  allowed: boolean;
  ruleVersion: string;
}

export interface EvidenceSubmitRequest {
  url: string;
  submittedByAgentId: string;
  milestoneId?: string;
}

export interface Evidence {
  evidenceId: string;
  agreementId: string;
  url: string;
  submittedByAgentId: string;
  milestoneId: string | null;
  status: EvidenceStatus;
  observations: EvidenceObservations | null;
  policyDecision: PolicyDecision | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  eventId: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Directory entities (used by fixtures / dashboards; not part of API routes)
// ---------------------------------------------------------------------------

export interface RateCard {
  /** Integer USDC. */
  minUsdc: number;
  /** Integer USDC. */
  maxUsdc: number;
}

export interface Brand {
  brandId: string;
  brandAgentId: string;
  name: string;
  category: string;
}

export interface Creator {
  creatorId: string;
  creatorAgentId: string;
  name: string;
  category: string;
  rateCard: RateCard;
  audience: string[];
}

/**
 * Creator diagnosis snapshot (fixture-fed placeholder; the real signal
 * pipeline lands later). Powers the creator dashboard diagnosis card.
 */
export interface CreatorDiagnosis {
  audience: string[];
  /** e.g. 0.048 = 4.8% */
  engagementRate: number;
  topFormats: string[];
  rateBand: RateCard;
}

// ---------------------------------------------------------------------------
// Response data shapes (the `data` half of the envelope, per route)
// ---------------------------------------------------------------------------

export interface PromotionResponse {
  promotion: Promotion;
}

export interface PromotionListResponse {
  promotions: Promotion[];
}

export interface MatchRunResponse {
  matchRun: MatchRun;
}

export interface CandidateListResponse {
  candidates: MatchCandidate[];
}

export interface TimelineResponse {
  events: TimelineEvent[];
}

export interface StartNegotiationResponse {
  negotiation: Negotiation;
  agreement: Agreement | null;
}

export interface NegotiationResponse {
  negotiation: Negotiation;
}

export interface NegotiationMessagesResponse {
  messages: NegotiationMessage[];
}

export interface AgreementResponse {
  agreement: Agreement;
}

export interface EscrowResponse {
  escrow: Escrow;
}

export interface ReceiptResponse {
  receipt: Receipt;
}

export interface EvidenceResponse {
  evidence: Evidence;
}

// ---------------------------------------------------------------------------
// Onboarding — PRD v2 §4/§5, contract deltas in PRD v2 §12
//
// Additive only; nothing above changes. The frontend builds against fixtures
// with these exact shapes so the backend implementation can land behind them.
// ---------------------------------------------------------------------------

export type SocialPlatform = "instagram" | "youtube" | "x" | "tiktok";

export interface SocialHandle {
  platform: SocialPlatform;
  handle: string;
}

export interface PlatformStats {
  platform: SocialPlatform;
  handle: string;
  followers: number;
  postsAnalyzed: number;
}

export interface IngestedPost {
  platform: SocialPlatform;
  url: string;
  format: string;
  views: number;
  interactions: number;
  postedAt: string;
}

/**
 * Cached SNS ingest. Collection happens out of band (aside-browser collector
 * on the operator machine); Cloud Run never scrapes. `source: "cachedReplay"`
 * MUST render as "captured {capturedAt}" per the 17 §3 honesty rule.
 */
export interface CreatorIngest {
  creatorId: string;
  source: "cachedReplay" | "live";
  capturedAt: string;
  platforms: PlatformStats[];
  recentPosts: IngestedPost[];
}

export interface FormatShare {
  format: string;
  sharePct: number;
}

/**
 * diagnosis-v1. Every number is derived deterministically from the ingest —
 * `narrative` is the ONLY model-written field, and it may never contradict the
 * numbers beside it.
 */
export interface CreatorDiagnosisV1 {
  version: "diagnosis-v1";
  creatorId: string;
  source: "cachedReplay" | "live";
  capturedAt: string;
  followersTotal: number;
  /** interactions / followers, e.g. 0.048 = 4.8% */
  engagementRate: number;
  dominantCategories: string[];
  topFormats: FormatShare[];
  topPosts: IngestedPost[];
  postingCadencePerWeek: number;
  toneKeywords: string[];
  suggestedRateBand: RateCard;
  narrative: string;
}

/** Persists as creatorProfiles/{creatorId} + agentPolicies/{creatorAgentId}. */
export interface CreatorOnboardRequest {
  handles: SocialHandle[];
  rateCard: RateCard;
  blockedIndustries: string[];
  monthlyCapacity: number;
  leadTimeDays: number;
  usageRights: UsageRights;
  /** Frontend only ever handles the pubkey; keys never touch the browser. */
  walletAddress: string | null;
}

export interface HatchedAgent {
  agentId: string;
  /** Display name the agent greets with during the hatching ceremony. */
  name: string;
  /** Canonical policy JSON the agent "signs" — the autonomy mandate. */
  policyJson: string;
}

export interface CreatorOnboardResult {
  creatorId: string;
  agent: HatchedAgent;
  walletAddress: string | null;
}

/** Brand-side ingest from the website URL (+ optional socials). */
export interface BrandIngestV1 {
  version: "brandIngest-v1";
  source: "cachedReplay" | "live";
  capturedAt: string;
  website: string;
  name: string;
  category: string;
  productLines: string[];
  toneKeywords: string[];
  foundCollabs: { handle: string; platform: SocialPlatform; url: string }[];
  suggestedAudience: string[];
  narrative: string;
}

/** Promotion autonomy plus the standing auto-approve cap set at onboarding. */
export interface BrandAutonomy extends PromotionAutonomy {
  /** Max USDC the agent may commit on one deal without asking a human. */
  autoApproveCapUsdc: number;
}

export interface BrandOnboardRequest {
  website: string;
  handles: SocialHandle[];
  name: string;
  category: string;
  budget: Budget;
  autonomy: BrandAutonomy;
  usageRights: UsageRights;
  blockedCategories: string[];
  walletAddress: string | null;
}

export interface BrandOnboardResult {
  brandId: string;
  agent: HatchedAgent;
  walletAddress: string | null;
}

export interface CreatorIngestRequest {
  handles: SocialHandle[];
}

export interface BrandIngestRequest {
  website: string;
  handles: SocialHandle[];
}

export interface CreatorIngestResponse {
  ingest: CreatorIngest;
}

export interface CreatorDiagnosisResponse {
  diagnosis: CreatorDiagnosisV1;
}

export interface CreatorOnboardResponse {
  creator: CreatorOnboardResult;
}

export interface BrandIngestResponse {
  ingest: BrandIngestV1;
}

export interface BrandOnboardResponse {
  brand: BrandOnboardResult;
}
