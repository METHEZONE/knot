export type Role = "brand" | "creator";

export type AgentTaskStatus = "queued" | "running" | "done";

export type AgentTask = {
  id: string;
  label: string;
  status: AgentTaskStatus;
  visibleDetail: string;
};

export type NegotiatedTerm = {
  label: string;
  value: string;
};

export type Milestone = {
  id: string;
  title: string;
  amountUsdc: number;
  status: "notStarted" | "inProgress" | "submitted" | "verified" | "released";
  progressPercent: number;
  creatorAction: string;
};

export type Settlement = {
  escrowAmountUsdc: number;
  releasedUsdc: number;
  pendingUsdc: number;
  escrowStatus: "NOT_FUNDED" | "LOCKED" | "PARTIALLY_RELEASED" | "RELEASED";
  lockTx: string | null;
  releaseTx: string | null;
};

export type RoleSession = {
  role: Role;
  userLabel: string;
  organizationLabel: string;
  agentId: string;
  agentLabel: string;
  profileSummary: string;
  walletAddress: string;
};

export type BrandProduct = {
  productId: string;
  title: string;
  category: string;
  targetAudience: string;
  budgetUsdc: number;
  maxOfferUsdc: number;
  deliverables: string[];
  blockedTerms: string[];
  status: "DRAFT" | "NEGOTIATING" | "AGREED" | "SETTLING";
};

export type CreatorCriteria = {
  minimumUsdc: number;
  blockedDomains: string[];
  preferredContent: string[];
  usageRights: string;
  notes: string;
};

export type NegotiationView = {
  role: Role;
  title: string;
  counterpartyLabel: string;
  counterpartyAgentLabel: string;
  agentId: string;
  counterpartyAgentId: string;
  taskId: string;
  taskState: "TASK_STATE_WORKING" | "TASK_STATE_COMPLETED";
  progressPercent: number;
  tasks: AgentTask[];
  publicSummary: string[];
  terms: NegotiatedTerm[];
  termsHash: string;
};

export type CreatorDeal = {
  brandId: string;
  brandName: string;
  productTitle: string;
  status: "AGREED" | "COUNTERED" | "REJECTED" | "IN_PROGRESS";
  visibleResult: string;
  amountUsdc: number;
  termsHash: string | null;
  milestones: Milestone[];
  settlement: Settlement;
};

export type DevEvent = {
  id: string;
  type: "A2A" | "POLICY" | "DB" | "WEB3" | "AUTH";
  label: string;
  status: "ok" | "warning" | "pending";
};

export type DevOverview = {
  dataMode: "mock" | "api-ready";
  activeTaskCount: number;
  mockCollectionCount: number;
  events: DevEvent[];
};
