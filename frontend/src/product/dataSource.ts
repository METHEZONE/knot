import {
  brandProduct,
  creatorCriteria,
  creatorDeals,
  devOverview,
  negotiationViews,
  roleSessions,
} from "./mockData";
import {
  ProductApiClient,
  ProductApiError,
  apiBaseUrl,
  type ApiAgreement,
  type ApiAgreementTerms,
  type ApiCandidate,
  type ApiEscrow,
  type ApiMatchRun,
  type ApiNegotiationBundle,
  type ApiPromotion,
  type ApiSettlement,
  type ApiTimelineEvent,
} from "./apiClient";
import type {
  AgentTask,
  BrandProduct,
  CreatorCriteria,
  CreatorDeal,
  DevEvent,
  DevOverview,
  Milestone,
  NegotiatedTerm,
  NegotiationView,
  Role,
  RoleSession,
  Settlement,
} from "./types";

const USDC_BASE_UNIT = 1_000_000;

type NegotiationQuery = {
  promotionId?: string;
  negotiationId?: string;
  agreementId?: string;
};

export interface KnotDataSource {
  getRoleSession(role: Role): Promise<RoleSession>;
  getBrandProduct(promotionId?: string): Promise<BrandProduct>;
  getCreatorCriteria(): Promise<CreatorCriteria>;
  getNegotiation(role: Role, query?: NegotiationQuery): Promise<NegotiationView>;
  getCreatorDeals(): Promise<CreatorDeal[]>;
  getCreatorDeal(agreementId: string): Promise<CreatorDeal | null>;
  getBrandSettlementDeal(agreementId?: string): Promise<CreatorDeal>;
  getDevOverview(): Promise<DevOverview>;
}

class MockKnotDataSource implements KnotDataSource {
  async getRoleSession(role: Role) {
    return roleSessions[role];
  }

  async getBrandProduct() {
    return brandProduct;
  }

  async getCreatorCriteria() {
    return creatorCriteria;
  }

  async getNegotiation(role: Role) {
    return negotiationViews[role];
  }

  async getCreatorDeals() {
    return creatorDeals;
  }

  async getCreatorDeal(agreementId: string) {
    return creatorDeals.find((deal) => deal.agreementId === agreementId) ?? null;
  }

  async getBrandSettlementDeal() {
    return creatorDeals[0];
  }

  async getDevOverview(): Promise<DevOverview> {
    return devOverview;
  }
}

class ApiKnotDataSource implements KnotDataSource {
  private client = new ProductApiClient();

  async getRoleSession(role: Role) {
    return roleSessions[role];
  }

  async getBrandProduct(promotionId?: string) {
    const promotion = await this.resolvePromotion(promotionId);
    return promotionToBrandProduct(promotion);
  }

  async getCreatorCriteria() {
    return creatorCriteria;
  }

  async getNegotiation(role: Role, query: NegotiationQuery = {}) {
    const flow = await this.resolveNegotiationFlow(query);
    return negotiationFlowToView(flow, role);
  }

  async getCreatorDeals() {
    const promotions = await this.client.listPromotions();
    const deals = await Promise.all(
      promotions.map(async (promotion) => {
        const timeline = await this.client.getTimeline(promotion.promotionId);
        const negotiationId = latestTimelineString(timeline, "NEGOTIATION_STARTED", "negotiationId");
        if (!negotiationId) return null;
        const flow = await this.resolveNegotiationFlow({
          promotionId: promotion.promotionId,
          negotiationId,
        });
        return negotiationFlowToCreatorDeal(flow);
      }),
    );
    return deals.filter((deal): deal is CreatorDeal => deal !== null);
  }

  async getCreatorDeal(agreementId: string) {
    const agreement = await this.client.getAgreement(agreementId).catch(() => null);
    if (!agreement) return null;
    const flow = await this.resolveNegotiationFlow({
      promotionId: agreement.promotionId,
      negotiationId: agreement.negotiationId,
      agreementId,
    });
    return negotiationFlowToCreatorDeal(flow);
  }

  async getBrandSettlementDeal(agreementId?: string) {
    const flow = await this.resolveNegotiationFlow({ agreementId });
    if (!flow.agreement) {
      throw new ProductApiError(
        "Settlement requires an accepted Agreement. Run the agent negotiation first.",
        409,
        "AGREEMENT_REQUIRED",
        null,
      );
    }
    const escrowState = await this.client.getAgreementEscrow(flow.agreement.agreementId);
    return settlementFlowToCreatorDeal(
      { ...flow, agreement: flow.agreement },
      escrowState.escrow,
      escrowState.settlements[escrowState.settlements.length - 1] ?? null,
    );
  }

  async getDevOverview(): Promise<DevOverview> {
    const events: DevEvent[] = [
      { id: "api-auth", type: "AUTH", label: "Firebase auth projection not wired yet", status: "pending" },
      { id: "api-db", type: "DB", label: "Product API repository boundary active", status: "ok" },
      { id: "api-a2a", type: "A2A", label: "Frontend consumes Product API A2A projection, not direct A2A messages", status: "ok" },
      { id: "api-policy", type: "POLICY", label: "Agreement, evidence and escrow checks are deterministic", status: "ok" },
      { id: "api-web3", type: "WEB3", label: "Escrow receipts are API-backed but still SIMULATED", status: "warning" },
    ];

    try {
      await this.client.health();
    } catch (error) {
      return {
        dataMode: "api-ready",
        activeTaskCount: 0,
        mockCollectionCount: 0,
        events: [
          {
            id: "api-unreachable",
            type: "DB",
            label: `Product API unreachable at ${apiBaseUrl()}: ${errorMessage(error)}`,
            status: "warning",
          },
          ...events.filter((event) => event.type !== "DB"),
        ],
      };
    }

    const promotions = await this.client.listPromotions().catch(() => []);
    const eventCounts = await Promise.all(
      promotions.map((promotion) => this.client.getTimeline(promotion.promotionId).catch(() => [])),
    );
    return {
      dataMode: "api-ready",
      activeTaskCount: eventCounts.flat().filter((event) => event.type === "NEGOTIATION_STARTED").length,
      mockCollectionCount: 0,
      events,
    };
  }

  private async resolvePromotion(promotionId?: string) {
    if (promotionId) {
      return this.client.getPromotion(promotionId);
    }
    const promotions = await this.client.listPromotions();
    const promotion = promotions[0];
    if (!promotion) {
      throw new ProductApiError("Product API returned no Promotions", 404, "NO_PROMOTION", null);
    }
    return promotion;
  }

  private async resolveNegotiationFlow(query: NegotiationQuery): Promise<ApiNegotiationBundle> {
    let promotion = await this.resolvePromotion(query.promotionId);
    const timeline = await this.client.getTimeline(promotion.promotionId);
    const negotiationId =
      query.negotiationId ?? latestTimelineString(timeline, "NEGOTIATION_STARTED", "negotiationId");

    if (!negotiationId) {
      return pendingNegotiationFlow(promotion, timeline);
    }

    const negotiation = await this.client.getNegotiation(negotiationId);
    if (negotiation.promotionId !== promotion.promotionId) {
      promotion = await this.client.getPromotion(negotiation.promotionId);
    }
    const agreement =
      query.agreementId
        ? await this.client.getAgreement(query.agreementId)
        : await this.client.getNegotiationAgreement(negotiationId).catch(() => null);
    const matchRun = await this.client.getMatchRun(negotiation.matchRunId);
    const candidates = await this.client.listCandidates(matchRun.matchRunId);
    return { promotion, matchRun, candidates, negotiation, agreement, timeline };
  }
}

export function createKnotDataSource(mode = resolveDataMode()): KnotDataSource {
  return mode === "api" ? new ApiKnotDataSource() : new MockKnotDataSource();
}

export const knotDataSource: KnotDataSource = createKnotDataSource();

export function resolveDataMode() {
  return process.env.KNOT_DATA_MODE ?? process.env.NEXT_PUBLIC_KNOT_DATA_MODE ?? "api";
}

function promotionToBrandProduct(promotion: ApiPromotion): BrandProduct {
  return {
    productId: promotion.promotionId,
    title: promotion.title,
    category: promotion.category,
    targetAudience: promotion.targetAudience.join(", "),
    budgetUsdc: promotion.budget.totalUsdc,
    maxOfferUsdc: promotion.budget.maxPerCreatorUsdc,
    deliverables: promotion.deliverables.map(
      (deliverable) => `${deliverable.format} x ${deliverable.count}`,
    ),
    blockedTerms: [
      ...(promotion.constraints?.prohibitedClaims ?? []),
      ...(promotion.constraints?.prohibitedCategories ?? []),
    ],
    status: promotion.status === "DRAFT" ? "DRAFT" : "NEGOTIATING",
  };
}

function negotiationFlowToView(flow: ApiNegotiationBundle, role: Role): NegotiationView {
  const candidate = selectedCandidate(flow);
  const creatorLabel = creatorDisplayName(candidate);
  const agreement = flow.agreement;
  const terms = agreement?.terms ?? flow.negotiation.currentTerms;
  const completed = flow.negotiation.status === "AGREED" || flow.negotiation.status === "REJECTED";
  return {
    role,
    promotionId: flow.promotion.promotionId,
    negotiationId: isPendingNegotiation(flow.negotiation) ? null : flow.negotiation.negotiationId,
    agreementId: agreement?.agreementId ?? null,
    title: flow.promotion.title,
    counterpartyLabel: role === "brand" ? creatorLabel : brandDisplayName(),
    counterpartyAgentLabel:
      role === "brand" ? flow.negotiation.creatorAgentId : flow.negotiation.brandAgentId,
    agentId: role === "brand" ? flow.negotiation.brandAgentId : flow.negotiation.creatorAgentId,
    counterpartyAgentId:
      role === "brand" ? flow.negotiation.creatorAgentId : flow.negotiation.brandAgentId,
    taskId: flow.negotiation.taskId,
    taskState: completed ? "TASK_STATE_COMPLETED" : "TASK_STATE_WORKING",
    progressPercent: completed ? 100 : 72,
    tasks: apiTasks(flow, completed),
    candidates: flow.candidates.map((item) => candidateSummary(item, flow.matchRun)),
    publicSummary:
      role === "brand"
        ? [
            `${creatorLabel}와 Product API-backed A2A negotiation projection을 불러왔습니다.`,
            "Creator의 private policy와 minimum은 Brand 화면에 노출하지 않습니다.",
            "Agreement Artifact가 있으면 termsHash를 UI에 표시합니다.",
          ]
        : [
            `${brandDisplayName()} 제안을 Agent가 처리했습니다.`,
            "브랜드의 hard maximum과 내부 matching score는 Creator 화면에 노출하지 않습니다.",
            "결과에는 공개 가능한 조건과 Agreement 상태만 표시합니다.",
          ],
    terms: termsToRows(terms),
    termsHash: agreement?.termsHash ?? "pending-agreement-artifact",
  };
}

function negotiationFlowToCreatorDeal(flow: ApiNegotiationBundle): CreatorDeal {
  const agreement = flow.agreement;
  const terms = agreement?.terms ?? flow.negotiation.currentTerms;
  return {
    agreementId: agreement?.agreementId ?? null,
    brandId: agreement?.agreementId ?? flow.negotiation.negotiationId,
    brandName: brandDisplayName(),
    creatorAgentId: flow.negotiation.creatorAgentId,
    productTitle: flow.promotion.title,
    status: creatorDealStatus(flow.negotiation.status),
    visibleResult:
      flow.negotiation.status === "AGREED"
        ? `${terms.compensation.baseAmountUsdc} USDC, ${deliverableSummary(terms)}로 합의됐습니다.`
        : `협상 상태: ${flow.negotiation.status}`,
    amountUsdc: terms.compensation.baseAmountUsdc,
    termsHash: agreement?.termsHash ?? null,
    milestones: milestonesFromTerms(terms),
    settlement: emptySettlement(terms),
  };
}

function settlementFlowToCreatorDeal(
  flow: ApiNegotiationBundle & { agreement: ApiAgreement },
  escrow: ApiEscrow | null,
  settlement: ApiSettlement | null,
): CreatorDeal {
  const terms = flow.agreement.terms;
  return {
    ...negotiationFlowToCreatorDeal(flow),
    milestones: milestonesFromTerms(terms, settlement ?? undefined),
    settlement: escrow ? settlementFromEscrow(escrow, settlement) : emptySettlement(terms),
  };
}

function apiTasks(flow: ApiNegotiationBundle, completed: boolean): AgentTask[] {
  const hasMatch = hasTimeline(flow.timeline, "MATCH_RUN_COMPLETED");
  const hasNegotiation = hasTimeline(flow.timeline, "NEGOTIATION_STARTED");
  const hasAgreement = Boolean(flow.agreement);
  return [
    {
      id: "api-match",
      label: "Creator candidates ranked",
      status: hasMatch ? "done" : "running",
      visibleDetail: "Product API가 deterministic matching 결과와 후보 순위를 저장했습니다.",
    },
    {
      id: "api-a2a",
      label: "A2A negotiation projected",
      status: hasNegotiation ? "done" : "running",
      visibleDetail: "Frontend는 직접 A2A를 호출하지 않고 Product API의 A2A projection만 읽습니다.",
    },
    {
      id: "api-policy",
      label: "Policy evaluated",
      status: completed ? "done" : "running",
      visibleDetail: "Brand/Creator policy decision은 backend deterministic policy engine에서 계산됩니다.",
    },
    {
      id: "api-artifact",
      label: "Agreement Artifact",
      status: hasAgreement ? "done" : "queued",
      visibleDetail: "합의 시 A2A Artifact와 Agreement가 termsHash로 연결됩니다.",
    },
  ];
}

function termsToRows(terms: ApiAgreementTerms): NegotiatedTerm[] {
  return [
    { label: "Amount", value: `${terms.compensation.baseAmountUsdc} USDC` },
    { label: "Deliverables", value: deliverableSummary(terms) },
    { label: "Usage rights", value: terms.usageRights },
    { label: "Deadline", value: terms.deliverables[0]?.postWindow.end ?? "TBD" },
    {
      label: "Evidence",
      value: (terms.constraints?.requiredDisclosures ?? []).length
        ? `Required disclosure: ${(terms.constraints?.requiredDisclosures ?? []).join(", ")}`
        : "Content URL + milestone verification",
    },
  ];
}

function milestonesFromTerms(terms: ApiAgreementTerms, settlement?: ApiSettlement): Milestone[] {
  const total = terms.compensation.baseAmountUsdc;
  return terms.milestones.map((milestone) => {
    const released = settlement?.milestoneId === milestone.id;
    return {
      id: milestone.id,
      title: milestoneTitle(milestone.trigger),
      amountUsdc: Math.floor((total * milestone.releasePct) / 100),
      status: released ? "released" : milestone.id === "content" ? "inProgress" : "notStarted",
      progressPercent: released ? 100 : milestone.id === "content" ? 45 : 0,
      creatorAction:
        milestone.id === "content"
          ? "게시 URL과 광고 표기 evidence를 제출합니다."
          : "합의된 계약 조건을 확인합니다.",
    };
  });
}

function settlementFromEscrow(escrow: ApiEscrow, settlement: ApiSettlement | null): Settlement {
  const locked = baseUnitsToUsdc(escrow.lockedAmountBaseUnits);
  const released = baseUnitsToUsdc(escrow.releasedAmountBaseUnits);
  return {
    escrowAmountUsdc: locked,
    releasedUsdc: released,
    pendingUsdc: Math.max(locked - released, 0),
    escrowStatus:
      escrow.status === "COMPLETED"
        ? "RELEASED"
        : released > 0
          ? "PARTIALLY_RELEASED"
          : "LOCKED",
    lockTx: escrow.lockSignature,
    releaseTx: settlement?.signature ?? null,
  };
}

function emptySettlement(terms: ApiAgreementTerms): Settlement {
  return {
    escrowAmountUsdc: terms.compensation.baseAmountUsdc,
    releasedUsdc: 0,
    pendingUsdc: terms.compensation.baseAmountUsdc,
    escrowStatus: "NOT_FUNDED",
    lockTx: null,
    releaseTx: null,
  };
}

function hasTimeline(events: ApiTimelineEvent[], type: string) {
  return events.some((event) => event.type === type);
}

function latestTimelineString(
  events: ApiTimelineEvent[],
  type: string,
  fieldName: string,
): string | null {
  for (const event of [...events].reverse()) {
    if (event.type !== type) continue;
    const value = event.data[fieldName];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function pendingNegotiationFlow(
  promotion: ApiPromotion,
  timeline: ApiTimelineEvent[],
): ApiNegotiationBundle {
  const terms: ApiAgreementTerms = {
    compensation: {
      structure: "flat",
      baseAmountUsdc: Math.min(promotion.budget.maxPerCreatorUsdc, 500),
      performancePct: 0,
    },
    deliverables: promotion.deliverables.map((deliverable) => ({
      format: deliverable.format,
      count: deliverable.count,
      postWindow: promotion.postingWindow,
      revisionRounds: 1,
    })),
    usageRights: promotion.usageRights,
    milestones: [{ id: "content", trigger: "contentLiveVerified", releasePct: 100 }],
    constraints: {
      requiredDisclosures: promotion.constraints?.requiredDisclosures ?? [],
      prohibitedClaims: promotion.constraints?.prohibitedClaims ?? [],
      exclusivityDays: 0,
    },
  };
  return {
    promotion,
    timeline,
    candidates: [],
    matchRun: {
      matchRunId: "not-run",
      promotionId: promotion.promotionId,
      brandAgentId: promotion.brandAgentId,
      status: "NOT_RUN",
      selectedCreatorId: null,
      selectedCreatorAgentId: null,
    },
    negotiation: {
      negotiationId: "not-started",
      matchRunId: "not-run",
      matchCandidateId: "",
      promotionId: promotion.promotionId,
      brandAgentId: promotion.brandAgentId,
      creatorAgentId: "",
      contextId: "",
      taskId: "",
      status: "CREATED" as ApiNegotiationBundle["negotiation"]["status"],
      currentRound: 0,
      maxRounds: promotion.autonomy?.maxNegotiationRounds ?? 5,
      currentTerms: terms,
    },
    agreement: null,
  };
}

function isPendingNegotiation(negotiation: ApiNegotiationBundle["negotiation"]) {
  return negotiation.negotiationId === "not-started";
}

function selectedCandidate(flow: ApiNegotiationBundle) {
  return (
    flow.candidates.find((candidate) => candidate.creatorAgentId === flow.matchRun.selectedCreatorAgentId) ??
    flow.candidates[0]
  );
}

function candidateSummary(candidate: ApiCandidate, matchRun: ApiMatchRun) {
  return {
    creatorId: candidate.creatorId,
    creatorAgentId: candidate.creatorAgentId,
    displayName: creatorDisplayName(candidate),
    rank: candidate.rank ?? null,
    score: candidate.overallScore ? Math.round(candidate.overallScore * 100) : null,
    eligible: candidate.eligible,
    reason:
      candidate.explanation ??
      candidate.hardFilterReasons?.join(", ") ??
      "Product API candidate snapshot",
    selected: candidate.creatorAgentId === matchRun.selectedCreatorAgentId,
  };
}

function creatorDealStatus(status: ApiNegotiationBundle["negotiation"]["status"]): CreatorDeal["status"] {
  if (status === "AGREED" || status === "REJECTED" || status === "COUNTERED") return status;
  return "IN_PROGRESS";
}

function creatorDisplayName(candidate: ApiCandidate | undefined) {
  if (candidate?.creatorId === "creator-003") return "Demo Lifestyle Creator";
  if (candidate?.creatorId === "creator-001") return "Demo Beauty Creator";
  if (candidate?.creatorId === "creator-002") return "Demo Fitness Creator";
  return candidate?.creatorId ?? "Selected Creator";
}

function brandDisplayName() {
  return "Demo Beauty Brand";
}

function deliverableSummary(terms: ApiAgreementTerms) {
  return terms.deliverables
    .map((deliverable) => `${deliverable.format} x ${deliverable.count}`)
    .join(", ");
}

function milestoneTitle(trigger: string) {
  if (trigger === "contractSigned") return "Agreement signed";
  if (trigger === "contentLiveVerified") return "Content verified";
  return trigger;
}

function baseUnitsToUsdc(value: string) {
  return Math.floor(Number(value) / USDC_BASE_UNIT);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
