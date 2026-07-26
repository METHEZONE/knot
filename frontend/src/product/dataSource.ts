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
  type ApiAgreementTerms,
  type ApiCandidate,
  type ApiEscrow,
  type ApiNegotiationBundle,
  type ApiPromotion,
  type ApiSettlement,
  type ApiSettlementBundle,
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
const API_CREATOR_DEAL_ID = "glow-bar";

export interface KnotDataSource {
  getRoleSession(role: Role): Promise<RoleSession>;
  getBrandProduct(): Promise<BrandProduct>;
  getCreatorCriteria(): Promise<CreatorCriteria>;
  getNegotiation(role: Role): Promise<NegotiationView>;
  getCreatorDeals(): Promise<CreatorDeal[]>;
  getCreatorDeal(brandId: string): Promise<CreatorDeal | null>;
  getBrandSettlementDeal(): Promise<CreatorDeal>;
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

  async getCreatorDeal(brandId: string) {
    return creatorDeals.find((deal) => deal.brandId === brandId) ?? null;
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
  private negotiationFlow: Promise<ApiNegotiationBundle> | null = null;
  private settlementFlow: Promise<ApiSettlementBundle> | null = null;

  async getRoleSession(role: Role) {
    return roleSessions[role];
  }

  async getBrandProduct() {
    const promotion = await this.primaryPromotion();
    return promotionToBrandProduct(promotion);
  }

  async getCreatorCriteria() {
    return creatorCriteria;
  }

  async getNegotiation(role: Role) {
    const flow = await this.ensureNegotiationFlow();
    return negotiationFlowToView(flow, role);
  }

  async getCreatorDeals() {
    const flow = await this.ensureNegotiationFlow();
    return [negotiationFlowToCreatorDeal(flow)];
  }

  async getCreatorDeal(brandId: string) {
    if (brandId !== API_CREATOR_DEAL_ID) {
      return null;
    }
    const flow = await this.ensureNegotiationFlow();
    return negotiationFlowToCreatorDeal(flow);
  }

  async getBrandSettlementDeal() {
    const flow = await this.ensureSettlementFlow();
    return settlementFlowToCreatorDeal(flow);
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

    const flow = await this.ensureNegotiationFlow().catch(() => null);
    return {
      dataMode: "api-ready",
      activeTaskCount: flow ? 1 : 0,
      mockCollectionCount: 0,
      events,
    };
  }

  private async primaryPromotion() {
    const promotions = await this.client.listPromotions();
    const promotion = promotions[0];
    if (!promotion) {
      throw new ProductApiError("Product API returned no Promotions", 404, "NO_PROMOTION", null);
    }
    return promotion;
  }

  private ensureNegotiationFlow() {
    if (!this.negotiationFlow) {
      this.negotiationFlow = this.createNegotiationFlow();
    }
    return this.negotiationFlow;
  }

  private ensureSettlementFlow() {
    if (!this.settlementFlow) {
      this.settlementFlow = this.createSettlementFlow();
    }
    return this.settlementFlow;
  }

  private async createNegotiationFlow(): Promise<ApiNegotiationBundle> {
    const promotion = await this.primaryPromotion();
    const matchRun = await this.client.runMatches(promotion.promotionId);
    const candidates = await this.client.listCandidates(matchRun.matchRunId);
    const { negotiation, agreement } = await this.client.startNegotiation(matchRun.matchRunId);
    const timeline = await this.client.getTimeline(promotion.promotionId);
    return { promotion, matchRun, candidates, negotiation, agreement, timeline };
  }

  private async createSettlementFlow(): Promise<ApiSettlementBundle> {
    const flow = await this.ensureNegotiationFlow();
    if (!flow.agreement) {
      throw new ProductApiError(
        "Settlement requires an accepted Agreement",
        409,
        "AGREEMENT_REQUIRED",
        flow.negotiation,
      );
    }

    const milestoneId = preferredReleaseMilestone(flow.agreement.terms);
    const evidence = await this.client.submitEvidence(flow.agreement, milestoneId);
    await this.client.verifyEvidence(evidence.evidenceId);
    const locked = await this.client.lockEscrow(flow.agreement.agreementId);
    const released = await this.client.releaseMilestone(locked.escrow.escrowId, milestoneId);
    const timeline = await this.client.getTimeline(flow.promotion.promotionId);
    return {
      ...flow,
      agreement: flow.agreement,
      evidence,
      escrow: released.escrow,
      settlement: released.settlement,
      receipt: released.receipt,
      timeline,
    };
  }
}

export const knotDataSource: KnotDataSource =
  resolveDataMode() === "api" ? new ApiKnotDataSource() : new MockKnotDataSource();

export function resolveDataMode() {
  return process.env.KNOT_DATA_MODE ?? process.env.NEXT_PUBLIC_KNOT_DATA_MODE ?? "mock";
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
    brandId: API_CREATOR_DEAL_ID,
    brandName: brandDisplayName(),
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

function settlementFlowToCreatorDeal(flow: ApiSettlementBundle): CreatorDeal {
  const terms = flow.agreement.terms;
  return {
    ...negotiationFlowToCreatorDeal(flow),
    milestones: milestonesFromTerms(terms, flow.settlement),
    settlement: settlementFromEscrow(flow.escrow, flow.settlement),
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

function settlementFromEscrow(escrow: ApiEscrow, settlement: ApiSettlement): Settlement {
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
    releaseTx: settlement.signature,
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

function preferredReleaseMilestone(terms: ApiAgreementTerms) {
  return terms.milestones.find((milestone) => milestone.id === "content")?.id ?? terms.milestones[0].id;
}

function hasTimeline(events: ApiTimelineEvent[], type: string) {
  return events.some((event) => event.type === type);
}

function selectedCandidate(flow: ApiNegotiationBundle) {
  return (
    flow.candidates.find((candidate) => candidate.creatorAgentId === flow.matchRun.selectedCreatorAgentId) ??
    flow.candidates[0]
  );
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
