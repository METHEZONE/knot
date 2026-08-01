type ApiEnvelope<T> = {
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    schemaVersion?: string;
  };
};

export type ApiPromotion = {
  promotionId: string;
  brandId: string;
  brandAgentId: string;
  title: string;
  objective: string;
  category: string;
  targetAudience: string[];
  budget: {
    totalUsdc: number;
    maxPerCreatorUsdc: number;
  };
  deliverables: Array<{
    format: string;
    count: number;
  }>;
  postingWindow: {
    start: string;
    end: string;
  };
  usageRights: string;
  constraints?: {
    requiredDisclosures?: string[];
    prohibitedClaims?: string[];
    requiredCategories?: string[];
    prohibitedCategories?: string[];
  };
  autonomy?: {
    maxNegotiationRounds?: number;
    autoEscrow?: boolean;
    autoRelease?: boolean;
  };
  status: string;
  productName?: string;
  deliverableSummary?: string;
  workItems?: Array<Record<string, unknown>>;
};

export type ApiUser = {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
  activeRole: "brand" | "creator";
  brandId?: string;
  brandAgentId?: string;
  creatorId?: string;
  creatorAgentId?: string;
};

export type CurrentAccount = {
  uid: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  role: "BRAND" | "CREATOR" | null;
  onboardingStatus: "ROLE_REQUIRED" | "PROFILE_REQUIRED" | "COMPLETED";
  status: "ACTIVE" | "DISABLED" | "DELETION_PENDING" | "DELETED";
  brandId?: string | null;
  creatorId?: string | null;
  agentId?: string | null;
  /** 유저 지갑(Phantom, 비수탁) — POST /me/wallet 으로 저장된 주소 */
  walletAddress?: string | null;
  /** 에이전트 지갑(수탁, Secret Manager) 공개키 — read-only 표시용 */
  agentWalletPubkey?: string | null;
  schemaVersion: number;
};

export type ApiUserNotification = {
  notificationId: string;
  type: string;
  createdAt?: string;
  data?: Record<string, unknown>;
};

export type CurrentUserContext = {
  account: CurrentAccount;
  profileSummary: Record<string, unknown> | null;
  dashboardTarget: string;
};

export type ApiRoleSession = {
  role: "brand" | "creator";
  userLabel: string;
  organizationLabel: string;
  agentId: string;
  agentLabel: string;
  profileSummary: string;
  walletAddress: string;
};

export type BootstrapUserInput = {
  email: string;
  displayName: string;
  role: "brand" | "creator";
};

export type BrandOnboardingInput = {
  userId?: string;
  brandName: string;
  websiteUrl: string;
  category: string;
  targetAudience: string[];
  restrictedClaims: string[];
};

export type CreatorOnboardingInput = {
  userId?: string;
  creatorName: string;
  snsUrl: string;
  primaryCategory: string;
};

export type CurrentBrandProfileInput = {
  brandName: string;
  websiteUrl: string;
  categories: string[];
  customCategory?: string;
  targetAudience: string;
  description?: string;
  restrictedClaims: string[];
};

export type CurrentCreatorProfileInput = {
  creatorName: string;
  snsUrl: string;
  categories: string[];
  customCategory?: string;
  minimumUsdc: number;
  blockedDomains: string[];
  preferredContent: string[];
  walletAddress?: string;
};

export type CreatorCriteriaInput = {
  minimumUsdc: number;
  blockedDomains: string[];
  preferredContent: string[];
  usageRights: string;
  notes: string;
};

export type PromotionCreateInput = Omit<ApiPromotion, "promotionId" | "status"> & {
  promotionId?: string;
  status?: string;
};

export type BrandPromotionCreateInput = {
  promotionId?: string;
  productName: string;
  title: string;
  objective: string;
  categories: string[];
  targetAudience: string;
  totalBudget: number;
  initialOffer: number;
  maximumPerCreator: number;
  autoAcceptCeiling: number;
  maximumRounds: number;
  deliverables: Array<{ format: string; count: number }>;
  usageRights: string;
  deadline: string;
  prohibitedClaims: string[];
  /** cap(autoAcceptCeiling) 이내에서 에이전트가 사람 승인 없이 에스크로 락/릴리즈 */
  autoEscrow?: boolean;
  autoRelease?: boolean;
};

export type BrandSourceAnalysisInput = {
  websiteUrl?: string;
  productUrl?: string;
  pdfFileRef?: string;
};

export type BrandSourceField<T> = {
  value: T;
  source: "WEBSITE" | "PRODUCT_URL" | "PDF" | "USER_INPUT" | "AI_INFERENCE" | "DEMO_FIXTURE";
  confidence: number;
};

export type BrandSourceAnalysisDraft = {
  mode: "api" | "demo";
  brand: {
    name: BrandSourceField<string>;
  };
  product: {
    name: BrandSourceField<string>;
    category: BrandSourceField<string>;
    summary: BrandSourceField<string>;
    price?: BrandSourceField<string>;
    features: Array<BrandSourceField<string>>;
    targetAudience: Array<BrandSourceField<string>>;
    keywords: Array<BrandSourceField<string>>;
  };
  recommendations: {
    objectives: string[];
    channels: string[];
    deliverables: string[];
  };
};

export type AnalysisJob = {
  analysisId: string;
  ownerUid: string;
  role: "BRAND" | "CREATOR";
  analysisType: "PRODUCT" | "CREATOR_PROFILE";
  status: "READY_FOR_CONFIRMATION" | "CONFIRMED" | string;
  sourceUrl: string;
  sourceDigest: string;
  provider: string;
  model: string | null;
  fallbackReason: string | null;
  draft: Record<string, unknown>;
  confirmedFields: string[];
};

export type OnboardingSession = {
  ownerUid: string;
  role: "BRAND" | "CREATOR" | null;
  status: "IN_PROGRESS" | "COMPLETED" | string;
  currentCard: string;
  completedCards: string[];
  analysisJobId: string | null;
  draft: Record<string, unknown>;
  draftVersion: number;
};

export type CreatorAgentControl = {
  agentId: string;
  creatorId: string;
  publicationStatus: "DRAFT" | "PUBLISHED" | "PAUSED" | "SUSPENDED" | string;
  acceptingOffers: boolean;
  availability: "AVAILABLE" | "RESERVED" | "NEGOTIATING" | "AT_CAPACITY" | "UNAVAILABLE" | string;
  activeNegotiations: number;
  maxConcurrentNegotiations: number;
  activeCollaborations: number;
  maxActiveCollaborations: number;
  capacityAvailable: boolean;
  updatedAt?: string;
};

export type ApiMatchRun = {
  matchRunId: string;
  promotionId: string;
  brandAgentId: string;
  status: string;
  selectedCreatorId: string | null;
  selectedCreatorAgentId: string | null;
};

export type ApiCandidate = {
  creatorId: string;
  creatorAgentId: string;
  rank?: number;
  eligible: boolean;
  overallScore?: number;
  hardFilterReasons?: string[];
  explanation?: string;
  negotiationId?: string | null;
  negotiationStatus?: string | null;
};

export type ApiAgreementTerms = {
  compensation: {
    structure: string;
    baseAmountUsdc: number;
    performancePct?: number;
  };
  deliverables: Array<{
    format: string;
    count: number;
    postWindow: {
      start: string;
      end: string;
    };
    revisionRounds?: number;
  }>;
  usageRights: string;
  milestones: Array<{
    id: string;
    trigger: string;
    releasePct: number;
  }>;
  constraints?: {
    requiredDisclosures?: string[];
    prohibitedClaims?: string[];
    exclusivityDays?: number;
  };
};

export type ApiNegotiation = {
  negotiationId: string;
  matchRunId: string;
  matchCandidateId: string;
  promotionId: string;
  promotionTitle?: string;
  productName?: string;
  brandId?: string;
  brandAgentId: string;
  creatorId?: string;
  creatorAgentId: string;
  creatorDisplayName?: string;
  contextId: string;
  taskId: string;
  status:
    | "CREATED"
    | "OFFERED"
    | "AGREED"
    | "REJECTED"
    | "COUNTERED"
    | "ESCALATED"
    | "CANCELED"
    | "FAILED";
  currentRound: number;
  maxRounds: number;
  currentTerms: ApiAgreementTerms;
  initialAmountUsdc?: number;
  currentAmountUsdc?: number;
  deliverableSummary?: string;
  workItems?: Array<Record<string, unknown>>;
};

export type ApiAgreement = {
  agreementId: string;
  negotiationId: string;
  taskId: string;
  artifactId: string;
  promotionId: string;
  promotionTitle?: string;
  productName?: string;
  brandId?: string;
  brandAgentId: string;
  creatorId?: string;
  creatorAgentId: string;
  creatorDisplayName?: string;
  terms: ApiAgreementTerms;
  deliverableSummary?: string;
  workItems?: Array<Record<string, unknown>>;
  promotionSnapshot?: Record<string, unknown> | null;
  creatorSnapshot?: Record<string, unknown> | null;
  canonicalTermsJson: string;
  termsHash: string;
  status: "AGREED" | "REJECTED";
};

export type ApiTimelineEvent = {
  eventId: string;
  promotionId: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  sequence?: number;
};

export type ApiNegotiationMessage = {
  messageId: string;
  negotiationId?: string;
  contextId: string;
  taskId: string;
  role?: string;
  sequence?: number;
  payload?: Record<string, unknown>;
  a2aMessage?: Record<string, unknown>;
  createdAt: string;
};

export type ApiEvidence = {
  evidenceId: string;
  agreementId: string;
  milestoneId: string;
  creatorAgentId: string;
  status: "SUBMITTED" | "PASSED" | "FAILED";
};

export type ApiEscrow = {
  escrowId: string;
  agreementId: string;
  promotionId: string;
  lockedAmountBaseUnits: string;
  releasedAmountBaseUnits: string;
  milestoneAmounts?: Record<string, string>;
  status: "LOCKED" | "COMPLETED" | string;
  lockSignature: string | null;
  lockReceiptId: string;
};

export type ApiSettlement = {
  settlementId: string;
  escrowId: string;
  agreementId: string;
  milestoneId: string;
  amountBaseUnits: string;
  status: "SIMULATED" | "SUBMITTED" | "CONFIRMED" | string;
  signature: string | null;
};

export type ApiReceipt = {
  receiptId: string;
  paymentOperationId: string;
  network: string;
  signature: string | null;
  explorerUrl: string | null;
  status: "SIMULATED" | "SUBMITTED" | "CONFIRMED" | string;
  detail?: string;
};

export type ApiAgentActionResult = {
  action: "ESCROW_LOCK" | "MILESTONE_RELEASE" | string;
  status: "LOCKED" | "RELEASED" | "FAILED" | "SKIPPED" | string;
  escrow?: ApiEscrow;
  settlement?: ApiSettlement;
  receipt?: ApiReceipt;
  reason?: string;
  error?: Record<string, unknown>;
};

export type BrandDashboard = {
  brand: Record<string, unknown>;
  summary: {
    activePromotions: number;
    negotiationsInProgress: number;
    agreements: number;
    lockedEscrowBaseUnits: string;
  };
  activePromotions: ApiPromotion[];
  recentAgentActivity: ApiTimelineEvent[];
  contractedCreators: Array<Record<string, unknown>>;
};

export type CreatorDashboard = {
  creator: Record<string, unknown>;
  summary: {
    newOffers: number;
    agentNegotiations: number;
    activeSponsorships: number;
    pendingPayoutBaseUnits: string;
  };
  offers: Array<Record<string, unknown>>;
  activeSponsorships: Array<Record<string, unknown>>;
  recentAgentActivity: Array<Record<string, unknown>>;
};

export type ApiNegotiationBundle = {
  promotion: ApiPromotion;
  matchRun: ApiMatchRun;
  candidates: ApiCandidate[];
  negotiation: ApiNegotiation;
  agreement: ApiAgreement | null;
  timeline: ApiTimelineEvent[];
};

export type ApiAgreementEscrowBundle = {
  escrow: ApiEscrow | null;
  settlements: ApiSettlement[];
};

export type ApiDevAdminOverview = {
  enabled: boolean;
  actorUid: string;
  counts: Record<string, number>;
  latestFailures: Array<Record<string, unknown>>;
};

export type ApiSettlementBundle = ApiNegotiationBundle & {
  agreement: ApiAgreement;
  evidence: ApiEvidence;
  escrow: ApiEscrow;
  settlement: ApiSettlement;
  receipt: ApiReceipt;
};

export type BrandPromotionDetail = {
  promotion: ApiPromotion & Record<string, unknown>;
  agreement: (ApiAgreement & Record<string, unknown>) | null;
  agreements?: Array<ApiAgreement & Record<string, unknown>>;
  activity: ApiTimelineEvent[];
};

export type AgreementDetail = {
  agreement: ApiAgreement & Record<string, unknown>;
  escrow: ApiEscrow | null;
};

export type CreatorOfferDetail = {
  offer: Record<string, unknown>;
  negotiation: ApiNegotiation & Record<string, unknown>;
};

export class ProductApiError extends Error {
  status: number;
  code: string;
  detail: unknown;

  constructor(message: string, status: number, code: string, detail: unknown) {
    super(message);
    this.name = "ProductApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export class ProductApiClient {
  private static authTokenProvider: (() => Promise<string | null>) | null = null;
  private baseUrl: string;

  constructor(baseUrl = apiBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  static setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
    ProductApiClient.authTokenProvider = provider;
  }

  async health() {
    return this.raw<{ status: string; service: string }>("/readyz");
  }

  async getMe() {
    return this.request<CurrentUserContext>("/api/v1/me");
  }

  async saveWalletAddress(walletAddress: string) {
    return this.request<CurrentUserContext>("/api/v1/me/wallet", {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    });
  }

  async getMyWalletBalance() {
    return this.request<{
      connected: boolean;
      address?: string;
      sol?: number;
      usdc?: number;
      mint?: string;
      cluster?: string;
      error?: string;
    }>("/api/v1/me/wallet/balance");
  }

  async listMyNotifications() {
    const response = await this.request<{ notifications: ApiUserNotification[] }>(
      "/api/v1/me/notifications",
    );
    return response.notifications;
  }

  async selectMyRole(role: "BRAND" | "CREATOR", idempotencyKey: string) {
    return this.request<CurrentUserContext>("/api/v1/me/role", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ role }),
    });
  }

  async createMyBrandProfile(input: CurrentBrandProfileInput, idempotencyKey: string) {
    return this.request<{
      brand: Record<string, unknown>;
      agent: Record<string, unknown>;
    } & CurrentUserContext>("/api/v1/me/brand-profile", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  async createMyCreatorProfile(input: CurrentCreatorProfileInput, idempotencyKey: string) {
    return this.request<{
      creator: { creatorId: string; creatorAgentId: string };
      agent: Record<string, unknown>;
      policy: Record<string, unknown>;
    } & CurrentUserContext>("/api/v1/me/creator-profile", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(input),
    });
  }

  async listPromotions() {
    const response = await this.request<{ promotions: ApiPromotion[] }>("/api/v1/promotions");
    return response.promotions;
  }

  async getBrandDashboard() {
    const response = await this.request<{ dashboard: BrandDashboard }>("/api/v1/brand/dashboard");
    return response.dashboard;
  }

  async listBrandPromotions() {
    const response = await this.request<{ promotions: Array<ApiPromotion & Record<string, unknown>> }>(
      "/api/v1/brand/promotions",
    );
    return response.promotions;
  }

  async createBrandPromotion(input: BrandPromotionCreateInput, idempotencyKey: string) {
    const response = await this.request<{ promotion: ApiPromotion & Record<string, unknown> }>(
      "/api/v1/brand/promotions",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(input),
      },
    );
    return response.promotion;
  }

  async analyzeBrandSource(input: BrandSourceAnalysisInput) {
    return this.request<BrandSourceAnalysisDraft>("/api/v1/onboarding/brand/analyze-source", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getOnboarding() {
    const response = await this.request<{ onboarding: OnboardingSession }>("/api/v1/onboarding");
    return response.onboarding;
  }

  async patchOnboarding(input: Partial<OnboardingSession> & { role: "BRAND" | "CREATOR" }) {
    const response = await this.request<{ onboarding: OnboardingSession }>("/api/v1/onboarding", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return response.onboarding;
  }

  async analyzeProduct(sourceUrl: string, idempotencyKey: string) {
    const response = await this.request<{ analysis: AnalysisJob }>("/api/v1/analyses/product", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ sourceUrl }),
    });
    return response.analysis;
  }

  async analyzeCreatorProfile(sourceUrl: string, idempotencyKey: string) {
    const response = await this.request<{ analysis: AnalysisJob }>(
      "/api/v1/analyses/creator-profile",
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ sourceUrl }),
      },
    );
    return response.analysis;
  }

  async getAnalysis(analysisId: string) {
    const response = await this.request<{ analysis: AnalysisJob }>(
      `/api/v1/analyses/${analysisId}`,
    );
    return response.analysis;
  }

  async confirmAnalysis(
    analysisId: string,
    input: { confirmedFields: string[]; edits?: Record<string, unknown> },
    idempotencyKey: string,
  ) {
    const response = await this.request<{ analysis: AnalysisJob }>(
      `/api/v1/analyses/${analysisId}:confirm`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ ...input, edits: input.edits ?? {} }),
      },
    );
    return response.analysis;
  }

  async getBrandPromotionDetail(promotionId: string) {
    return this.request<BrandPromotionDetail>(`/api/v1/brand/promotions/${promotionId}`);
  }

  async deleteBrandPromotion(promotionId: string, idempotencyKey: string) {
    return this.request<{ promotion: ApiPromotion & Record<string, unknown>; deleted: boolean }>(
      `/api/v1/brand/promotions/${promotionId}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  async listBrandAgreements() {
    const response = await this.request<{ agreements: Array<ApiAgreement & Record<string, unknown>> }>(
      "/api/v1/brand/agreements",
    );
    return response.agreements;
  }

  async getBrandAgreementDetail(agreementId: string) {
    return this.request<AgreementDetail>(`/api/v1/brand/agreements/${agreementId}`);
  }

  async listCreatorOffers() {
    const response = await this.request<{ offers: Array<Record<string, unknown>> }>(
      "/api/v1/creator/offers",
    );
    return response.offers;
  }

  async getCreatorOfferDetail(negotiationId: string) {
    return this.request<CreatorOfferDetail>(`/api/v1/creator/offers/${negotiationId}`);
  }

  async listCreatorAgreements() {
    const response = await this.request<{ agreements: Array<ApiAgreement & Record<string, unknown>> }>(
      "/api/v1/creator/agreements",
    );
    return response.agreements;
  }

  async getCreatorAgreementDetail(agreementId: string) {
    return this.request<AgreementDetail>(`/api/v1/creator/agreements/${agreementId}`);
  }

  async getCreatorDashboard() {
    const response = await this.request<{ dashboard: CreatorDashboard }>(
      "/api/v1/creator/dashboard",
    );
    return response.dashboard;
  }

  async getCreatorAgent() {
    return this.request<{
      agent: CreatorAgentControl;
      discoveryProfile: Record<string, unknown> | null;
    }>("/api/v1/creator/agent");
  }

  async publishCreatorAgent() {
    return this.request<{
      agent: CreatorAgentControl;
      discoveryProfile: Record<string, unknown>;
    }>("/api/v1/creator/agent:publish", { method: "POST" });
  }

  async pauseCreatorAgent() {
    return this.request<{
      agent: CreatorAgentControl;
      discoveryProfile: Record<string, unknown>;
    }>("/api/v1/creator/agent:pause", { method: "POST" });
  }

  async resumeCreatorAgent() {
    return this.request<{
      agent: CreatorAgentControl;
      discoveryProfile: Record<string, unknown>;
    }>("/api/v1/creator/agent:resume", { method: "POST" });
  }

  async bootstrapUser(input: BootstrapUserInput) {
    const response = await this.request<{ user: ApiUser }>("/api/v1/users:bootstrap", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return response.user;
  }

  async onboardBrand(input: BrandOnboardingInput) {
    return this.request<{ brand: Record<string, unknown>; agent: Record<string, unknown>; session: ApiRoleSession }>(
      "/api/v1/brands:onboard",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async onboardCreator(input: CreatorOnboardingInput) {
    return this.request<{
      creator: { creatorId: string; creatorAgentId: string };
      agent: Record<string, unknown>;
      policy: Record<string, unknown>;
      session: ApiRoleSession;
    }>("/api/v1/creators:onboard", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateCreatorCriteria(creatorId: string, input: CreatorCriteriaInput) {
    return this.request<{ creator: Record<string, unknown>; policy: Record<string, unknown> }>(
      `/api/v1/creators/${creatorId}/criteria`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  async createPromotion(input: PromotionCreateInput) {
    const response = await this.request<{ promotion: ApiPromotion }>("/api/v1/promotions", {
      method: "POST",
      body: JSON.stringify(withoutStatus(input)),
    });
    return response.promotion;
  }

  async runMatches(promotionId: string) {
    const response = await this.request<{ matchRun: ApiMatchRun }>(
      `/api/v1/promotions/${promotionId}/matches:run`,
      { method: "POST" },
    );
    return response.matchRun;
  }

  async listCandidates(matchRunId: string) {
    const response = await this.request<{ candidates: ApiCandidate[] }>(
      `/api/v1/match-runs/${matchRunId}/candidates`,
    );
    return response.candidates;
  }

  async getMatchRun(matchRunId: string) {
    const response = await this.request<{ matchRun: ApiMatchRun }>(
      `/api/v1/match-runs/${matchRunId}`,
    );
    return response.matchRun;
  }

  async listMatchRunEvents(matchRunId: string) {
    const response = await this.request<{ events: ApiTimelineEvent[] }>(
      `/api/v1/match-runs/${matchRunId}/events`,
    );
    return response.events;
  }

  async getNegotiation(negotiationId: string) {
    const response = await this.request<{ negotiation: ApiNegotiation }>(
      `/api/v1/negotiations/${negotiationId}`,
    );
    return response.negotiation;
  }

  async listNegotiationMessages(negotiationId: string) {
    const response = await this.request<{ messages: ApiNegotiationMessage[] }>(
      `/api/v1/negotiations/${negotiationId}/messages`,
    );
    return response.messages;
  }

  async listNegotiationEvents(negotiationId: string) {
    const response = await this.request<{ events: ApiTimelineEvent[] }>(
      `/api/v1/negotiations/${negotiationId}/events`,
    );
    return response.events;
  }

  async startNegotiation(matchRunId: string) {
    return this.request<{ negotiation: ApiNegotiation; agreement: ApiAgreement | null }>(
      `/api/v1/match-runs/${matchRunId}:start-negotiation`,
      { method: "POST" },
    );
  }

  async getNegotiationAgreement(negotiationId: string) {
    const response = await this.request<{ agreement: ApiAgreement }>(
      `/api/v1/negotiations/${negotiationId}/agreement`,
    );
    return response.agreement;
  }

  async getAgreement(agreementId: string) {
    const response = await this.request<{ agreement: ApiAgreement }>(
      `/api/v1/agreements/${agreementId}`,
    );
    return response.agreement;
  }

  async getAgreementEscrow(agreementId: string) {
    return this.request<ApiAgreementEscrowBundle>(`/api/v1/agreements/${agreementId}/escrow`);
  }

  async runAgentForPromotion(promotionId: string) {
    const promotion = await this.getPromotion(promotionId);
    const matchRun = await this.runMatches(promotionId);
    const candidates = await this.listCandidates(matchRun.matchRunId);
    if (!matchRun.selectedCreatorAgentId) {
      throw new ProductApiError(noEligibleCreatorMessage(candidates), 409, "NO_ELIGIBLE_CREATOR", {
        matchRunId: matchRun.matchRunId,
        candidates,
      });
    }
    const { negotiation, agreement } = await this.startNegotiation(matchRun.matchRunId);
    const timeline = await this.getTimeline(promotionId);
    return { promotion, matchRun, candidates, negotiation, agreement, timeline };
  }

  async getPromotion(promotionId: string) {
    const response = await this.request<{ promotion: ApiPromotion }>(
      `/api/v1/promotions/${promotionId}`,
    );
    return response.promotion;
  }

  async getTimeline(promotionId: string) {
    const response = await this.request<{ events: ApiTimelineEvent[] }>(
      `/api/v1/promotions/${promotionId}/timeline`,
    );
    return response.events;
  }

  async submitEvidence(
    agreement:
      | ApiAgreement
      | { agreementId: string; creatorAgentId: string },
    milestoneId: string,
    url = "https://social.example/post/with-brand-and-ad",
  ) {
    const response = await this.request<{ evidence: ApiEvidence }>(
      `/api/v1/agreements/${agreement.agreementId}/evidence`,
      {
        method: "POST",
        body: JSON.stringify({
          url,
          submittedByAgentId: agreement.creatorAgentId,
          milestoneId,
        }),
      },
    );
    return response.evidence;
  }

  async verifyEvidence(evidenceId: string) {
    const response = await this.verifyEvidenceWithAgentActions(evidenceId);
    return response.evidence;
  }

  async verifyEvidenceWithAgentActions(evidenceId: string) {
    return this.request<{ evidence: ApiEvidence; autoRelease?: ApiAgentActionResult | null }>(
      `/api/v1/evidence/${evidenceId}:verify`,
      { method: "POST" },
    );
  }

  async lockEscrow(agreementId: string) {
    return this.request<{ escrow: ApiEscrow; receipt: ApiReceipt }>(
      `/api/v1/agreements/${agreementId}/escrow:lock`,
      {
        method: "POST",
        headers: { "Idempotency-Key": `frontend-lock-${agreementId}` },
      },
    );
  }

  async releaseMilestone(escrowId: string, milestoneId: string) {
    return this.request<{ settlement: ApiSettlement; escrow: ApiEscrow; receipt: ApiReceipt }>(
      `/api/v1/escrows/${escrowId}/milestones/${milestoneId}:release`,
      {
        method: "POST",
        headers: { "Idempotency-Key": `frontend-release-${escrowId}-${milestoneId}` },
      },
    );
  }

  async getDevAdminOverview() {
    const response = await this.request<{ overview: ApiDevAdminOverview }>(
      "/api/v1/dev-admin/overview",
    );
    return response.overview;
  }

  private async raw<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await this.headers(init);
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw toApiError(response.status, body);
    }
    return body as T;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const envelope = await this.raw<ApiEnvelope<T>>(path, init);
    return envelope.data;
  }

  private async headers(init?: RequestInit) {
    const headers = new Headers(init?.headers);
    if (init?.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const token = await ProductApiClient.authTokenProvider?.();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }
}

function toApiError(status: number, body: unknown) {
  if (isProblemEnvelope(body)) {
    const message = typeof body.detail.detail === "string" ? body.detail.detail : body.detail.title;
    return new ProductApiError(message, status, body.detail.code, body.detail);
  }
  if (isFastApiValidationEnvelope(body)) {
    return new ProductApiError(
      validationMessage(body.detail),
      status,
      "VALIDATION_ERROR",
      body.detail,
    );
  }
  return new ProductApiError(`Product API request failed with ${status}`, status, "API_ERROR", body);
}

function isProblemEnvelope(value: unknown): value is {
  detail: { title: string; code: string; detail?: string };
} {
  if (!value || typeof value !== "object" || !("detail" in value)) return false;
  const detail = (value as { detail: unknown }).detail;
  return Boolean(
    detail &&
      typeof detail === "object" &&
      "code" in detail &&
      "title" in detail,
  );
}

function isFastApiValidationEnvelope(value: unknown): value is {
  detail: Array<{ loc?: unknown[]; msg?: string }>;
} {
  if (!value || typeof value !== "object" || !("detail" in value)) return false;
  return Array.isArray((value as { detail: unknown }).detail);
}

function validationMessage(errors: Array<{ loc?: unknown[]; msg?: string }>) {
  const first = errors[0];
  if (!first) return "입력값을 확인해주세요.";
  const field = Array.isArray(first.loc) ? first.loc.filter((part) => part !== "body").join(".") : "";
  return field ? `${field}: ${first.msg ?? "입력값을 확인해주세요."}` : first.msg ?? "입력값을 확인해주세요.";
}

function noEligibleCreatorMessage(candidates: ApiCandidate[]) {
  const reasons = candidates
    .flatMap((candidate) => candidate.hardFilterReasons ?? [])
    .filter((reason, index, all) => all.indexOf(reason) === index)
    .slice(0, 3);
  const hint = reasons.length ? ` 현재 blocker: ${reasons.join(", ")}.` : "";
  return `선택 가능한 Creator가 없습니다. 카테고리, usage right, 일정, 최대 제안가를 조정한 뒤 다시 실행해주세요.${hint}`;
}

function withoutStatus(input: PromotionCreateInput) {
  const payload: Partial<PromotionCreateInput> = { ...input };
  delete payload.status;
  return payload;
}

export function apiBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }
  return (
    process.env.KNOT_API_BASE_URL ??
    process.env.NEXT_PUBLIC_KNOT_API_BASE_URL ??
    "http://127.0.0.1:8080"
  );
}
