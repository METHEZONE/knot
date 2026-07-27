import type {
  BrandProduct,
  CreatorCriteria,
  CreatorDeal,
  DevOverview,
  Milestone,
  NegotiationView,
  RoleSession,
  Settlement,
} from "./types";

export const roleSessions: Record<"brand" | "creator", RoleSession> = {
  brand: {
    role: "brand",
    userLabel: "Yuna",
    organizationLabel: "Alpha Brand Labs",
    agentId: "brand-agent-alpha",
    agentLabel: "Alpha Agent",
    profileSummary:
      "스킨케어 제품을 만드는 브랜드. 주요 타깃은 20대 후반-30대 초반, 톤은 신뢰감 있고 일상적입니다.",
    walletAddress: "9wFF...GLOW",
  },
  creator: {
    role: "creator",
    userLabel: "Mina",
    organizationLabel: "Mina Studio",
    agentId: "creator-agent-mina",
    agentLabel: "Mina Agent",
    profileSummary:
      "웰니스와 뷰티 루틴 콘텐츠를 만드는 크리에이터. Reels 리뷰와 스토리 링크 전환 성과가 높습니다.",
    walletAddress: "8mNA...MINA",
  },
};

export const brandProduct: BrandProduct = {
  productId: "product-alpha-summer-kit",
  title: "Alpha Summer Kit",
  category: "wellness skincare",
  targetAudience: "25-34 wellness-conscious creators and followers",
  budgetUsdc: 3000,
  maxOfferUsdc: 1000,
  deliverables: ["Instagram Reel 1개", "Story 2개", "제품 리뷰", "광고 표기"],
  blockedTerms: ["무기한 사용권", "과장 효능 표현", "무검수 게시"],
  status: "NEGOTIATING",
};

export const creatorCriteria: CreatorCriteria = {
  minimumUsdc: 750,
  blockedDomains: ["담배", "도박", "고위험 금융", "의료 효능 과장", "정치 캠페인"],
  preferredContent: ["Instagram Reels", "제품 리뷰", "스토리 링크", "UGC 컷다운"],
  usageRights: "Organic usage up to 30 days",
  notes: "제품을 직접 사용해보고 진정성 있는 리뷰가 가능한 협업만 선호합니다.",
};

const terms = [
  { label: "Amount", value: "950 USDC" },
  { label: "Deliverables", value: "Instagram Reel 1개 + Story 2개" },
  { label: "Usage rights", value: "Organic usage 30 days" },
  { label: "Deadline", value: "2026-08-03" },
  { label: "Evidence", value: "게시 URL + 광고 표기 + 브랜드 멘션" },
];

const milestones: Milestone[] = [
  {
    id: "m1",
    title: "Agreement signed",
    amountUsdc: 285,
    status: "released",
    progressPercent: 100,
    creatorAction: "완료된 계약 조건을 확인합니다.",
  },
  {
    id: "m2",
    title: "Content submitted",
    amountUsdc: 475,
    status: "inProgress",
    progressPercent: 45,
    creatorAction: "Reel 초안을 제작하고 게시 URL을 제출합니다.",
  },
  {
    id: "m3",
    title: "Evidence verified",
    amountUsdc: 190,
    status: "notStarted",
    progressPercent: 0,
    creatorAction: "광고 표기와 브랜드 멘션이 포함된 evidence를 제출합니다.",
  },
];

const settlement: Settlement = {
  escrowAmountUsdc: 950,
  releasedUsdc: 285,
  pendingUsdc: 665,
  escrowStatus: "PARTIALLY_RELEASED",
  lockTx: null,
  releaseTx: null,
};

export const negotiationViews: Record<"brand" | "creator", NegotiationView> = {
  brand: {
    role: "brand",
    promotionId: brandProduct.productId,
    negotiationId: "negotiation-mock-alpha",
    agreementId: "agreement-mock-alpha",
    title: brandProduct.title,
    counterpartyLabel: "Mina Studio",
    counterpartyAgentLabel: "Mina Agent",
    agentId: "brand-agent-glow",
    counterpartyAgentId: "creator-agent-mina",
    taskId: "a2a-task-20260725-001",
    taskState: "TASK_STATE_WORKING",
    progressPercent: 68,
    candidates: [
      {
        creatorId: "creator-mina",
        creatorAgentId: "creator-agent-mina",
        displayName: "Mina Studio",
        rank: 1,
        score: 94,
        eligible: true,
        reason: "웰니스 뷰티 루틴 적합도 높음",
        selected: true,
      },
      {
        creatorId: "creator-nari",
        creatorAgentId: "creator-agent-nari",
        displayName: "Nari Daily",
        rank: 2,
        score: 87,
        eligible: true,
        reason: "UGC 전환 데이터 양호",
        selected: false,
      },
      {
        creatorId: "creator-sol",
        creatorAgentId: "creator-agent-sol",
        displayName: "Studio Sol",
        rank: 3,
        score: 73,
        eligible: false,
        reason: "일정 충돌 가능성",
        selected: false,
      },
    ],
    tasks: [
      {
        id: "brand-1",
        label: "Creator candidates ranked",
        status: "done",
        visibleDetail: "공개 프로필, 공개 rate range, 제품 적합도를 기준으로 후보를 좁혔습니다.",
      },
      {
        id: "brand-2",
        label: "A2A offer sent",
        status: "done",
        visibleDetail: "Creator Agent에게 공개 가능한 제안 요약만 전달했습니다.",
      },
      {
        id: "brand-3",
        label: "Counter evaluated privately",
        status: "running",
        visibleDetail: "Brand Agent가 내부 최대가와 금지 조건을 비공개로 검토 중입니다.",
      },
      {
        id: "brand-4",
        label: "Agreement artifact",
        status: "queued",
        visibleDetail: "합의 가능하면 termsHash가 포함된 Agreement Artifact를 생성합니다.",
      },
    ],
    publicSummary: [
      "Mina Studio와 조건 조율 중입니다.",
      "Creator의 최소 단가와 차단 도메인은 Brand 화면에 노출하지 않습니다.",
      "결과 화면에는 합의 금액, deliverables, usage rights, deadline만 표시합니다.",
    ],
    terms,
    termsHash: "sha256:mock-explicit-fixture-only",
  },
  creator: {
    role: "creator",
    promotionId: brandProduct.productId,
    negotiationId: "negotiation-mock-alpha",
    agreementId: "agreement-mock-alpha",
    title: brandProduct.title,
    counterpartyLabel: "Alpha Brand Labs",
    counterpartyAgentLabel: "Alpha Agent",
    agentId: "creator-agent-mina",
    counterpartyAgentId: "brand-agent-alpha",
    taskId: "a2a-task-20260725-001",
    taskState: "TASK_STATE_WORKING",
    progressPercent: 74,
    candidates: [
      {
        creatorId: "creator-mina",
        creatorAgentId: "creator-agent-mina",
        displayName: "Mina Studio",
        rank: 1,
        score: 94,
        eligible: true,
        reason: "Creator Agent가 공개 조건만 수신했습니다.",
        selected: true,
      },
    ],
    tasks: [
      {
        id: "creator-1",
        label: "Offer received",
        status: "done",
        visibleDetail: "Brand Agent가 보낸 공개 제안 요약을 받았습니다.",
      },
      {
        id: "creator-2",
        label: "Criteria checked privately",
        status: "done",
        visibleDetail: "내 minimum, 피할 도메인, 선호 콘텐츠 기준을 비공개로 확인했습니다.",
      },
      {
        id: "creator-3",
        label: "Counter prepared",
        status: "running",
        visibleDetail: "Creator Agent가 공개 가능한 counter 조건만 정리 중입니다.",
      },
      {
        id: "creator-4",
        label: "Agreement artifact",
        status: "queued",
        visibleDetail: "합의 가능하면 최종 조건과 termsHash만 사용자에게 표시합니다.",
      },
    ],
    publicSummary: [
      "Alpha Brand Labs 제안을 Agent가 협상 중입니다.",
      "브랜드의 hard maximum과 내부 scoring은 Creator 화면에 노출하지 않습니다.",
      "결과 페이지에는 각 브랜드별 협상 상태와 공개 가능한 결과만 표시합니다.",
    ],
    terms,
    termsHash: "sha256:mock-explicit-fixture-only",
  },
};

export const creatorDeals: CreatorDeal[] = [
  {
    agreementId: "agreement-mock-alpha",
    brandId: "brand-alpha",
    brandName: "Alpha Brand Labs",
    creatorAgentId: "creator-agent-mina",
    productTitle: "Glow Bar Summer Kit",
    status: "AGREED",
    visibleResult: "950 USDC, Reel 1개 + Story 2개로 합의됐습니다.",
    amountUsdc: 950,
    termsHash: "sha256:mock-explicit-fixture-only",
    milestones,
    settlement,
  },
  {
    agreementId: null,
    brandId: "terra-tea",
    brandName: "Terra Tea",
    creatorAgentId: "creator-agent-mina",
    productTitle: "Cold Brew Tea Pack",
    status: "COUNTERED",
    visibleResult: "Creator Agent가 일정 조정을 counter했습니다.",
    amountUsdc: 680,
    termsHash: null,
    milestones: [],
    settlement: {
      escrowAmountUsdc: 0,
      releasedUsdc: 0,
      pendingUsdc: 0,
      escrowStatus: "NOT_FUNDED",
      lockTx: null,
      releaseTx: null,
    },
  },
  {
    agreementId: null,
    brandId: "smoke-zero",
    brandName: "Smoke Zero",
    creatorAgentId: "creator-agent-mina",
    productTitle: "Nicotine Alternative Kit",
    status: "REJECTED",
    visibleResult: "피할 도메인 기준에 따라 Creator Agent가 거절했습니다.",
    amountUsdc: 0,
    termsHash: null,
    milestones: [],
    settlement: {
      escrowAmountUsdc: 0,
      releasedUsdc: 0,
      pendingUsdc: 0,
      escrowStatus: "NOT_FUNDED",
      lockTx: null,
      releaseTx: null,
    },
  },
];

export const devOverview: DevOverview = {
  dataMode: "mock",
  activeTaskCount: 2,
  mockCollectionCount: 8,
  events: [
    { id: "dev-1", type: "AUTH", label: "Login/signup UI wired to mock sessions", status: "ok" },
    { id: "dev-2", type: "DB", label: "KnotDataSource mock implementation active", status: "ok" },
    { id: "dev-3", type: "A2A", label: "A2A task stream adapter pending", status: "pending" },
    { id: "dev-4", type: "POLICY", label: "Private policy fields hidden in role views", status: "ok" },
    { id: "dev-5", type: "WEB3", label: "Escrow receipt binding pending live gateway", status: "warning" },
  ],
};
