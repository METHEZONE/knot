import type { ApiAgreement, ApiEscrow, ApiPromotion, ApiSettlement, CurrentAccount } from "./apiClient";

export type ProductSnapshot = {
  name: string;
  category?: string;
  imageUrl?: string;
  productUrl?: string;
  summary?: string;
};

export type MilestoneStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VERIFIED"
  | "RELEASED"
  | "REJECTED";

export type NegotiationStatus =
  | "CREATED"
  | "OFFERED"
  | "WORKING"
  | "COUNTERED"
  | "ESCALATED"
  | "AGREED"
  | "REJECTED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELED";

export type NegotiationMessageType = "OFFER" | "COUNTER" | "ACCEPT" | "REJECT" | "ESCALATE";

export type A2ATaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_AUTH_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_REJECTED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED";

export type NegotiationEvent = {
  id: string;
  negotiationId: string;
  taskId: string;
  contextId: string;
  senderAgentId: string;
  receiverAgentId: string;
  senderType: "BRAND_AGENT" | "CREATOR_AGENT";
  messageType: NegotiationMessageType;
  taskState: A2ATaskState;
  round: number;
  terms?: unknown;
  rationale?: string;
  createdAt: string;
  raw?: unknown;
};

export function getDashboardPathForRole(role: CurrentAccount["role"] | undefined | null) {
  if (role === "BRAND") return "/brand";
  if (role === "CREATOR") return "/creator";
  return null;
}

export function productSnapshotFromPromotion(promotion: ApiPromotion & Record<string, unknown>): ProductSnapshot {
  const snapshot = promotion.productSnapshot;
  if (isRecord(snapshot)) {
    return {
      name: stringValue(snapshot.name, promotion.title),
      category: stringValue(snapshot.category, promotion.category),
      imageUrl: optionalString(snapshot.imageUrl),
      productUrl: optionalString(snapshot.productUrl),
      summary: optionalString(snapshot.summary),
    };
  }
  return {
    name: stringValue(promotion.productName, promotion.title),
    category: promotion.category,
    imageUrl: optionalString(promotion.productImageUrl),
    productUrl: optionalString(promotion.productUrl),
    summary: optionalString(promotion.productSummary),
  };
}

export function promotionProgress(promotion: ApiPromotion & Record<string, unknown>) {
  const explicit = numberValue(promotion.progressPercent, NaN);
  if (Number.isFinite(explicit)) return clamp(explicit, 0, 100);
  const status = String(promotion.status ?? "DRAFT").toUpperCase();
  if (status === "COMPLETED") return 100;
  if (status === "ACTIVE" || status === "ESCROW_FUNDED") return 72;
  if (status === "AGREED") return 58;
  if (status === "NEGOTIATING") return 38;
  if (status === "OPEN" || status === "READY") return 22;
  if (status === "CANCELED" || status === "FAILED") return 0;
  return 10;
}

export function mapTaskStateToCreatorStatus(
  taskState: string | null | undefined,
  domainStatus: string | null | undefined,
) {
  const domain = String(domainStatus ?? "").toUpperCase();
  if (domain === "AGREED") return "협상 성공";
  if (domain === "REJECTED") return "협상 거절";
  if (domain === "FAILED") return "협상 실패";
  if (domain === "CANCELED") return "취소됨";
  if (domain === "ESCALATED") return "내 승인 필요";
  switch (taskState) {
    case "TASK_STATE_SUBMITTED":
      return "제안 도착";
    case "TASK_STATE_WORKING":
      return "Agent 분석 중";
    case "TASK_STATE_INPUT_REQUIRED":
      return "상대 응답 대기";
    case "TASK_STATE_AUTH_REQUIRED":
      return "내 승인 필요";
    case "TASK_STATE_COMPLETED":
      return "협상 성공";
    case "TASK_STATE_REJECTED":
      return "협상 거절";
    case "TASK_STATE_FAILED":
      return "협상 실패";
    case "TASK_STATE_CANCELED":
      return "취소됨";
    default:
      return "제안 도착";
  }
}

export function taskStateMessage(taskState: string | null | undefined) {
  switch (taskState) {
    case "TASK_STATE_SUBMITTED":
      return "제안이 Creator Agent에게 전달되었습니다.";
    case "TASK_STATE_WORKING":
      return "Creator Agent가 조건과 정책을 검토하고 있습니다.";
    case "TASK_STATE_INPUT_REQUIRED":
      return "상대 Agent의 추가 응답을 기다리고 있습니다.";
    case "TASK_STATE_AUTH_REQUIRED":
      return "설정된 Agent 권한을 초과하여 사용자 승인이 필요합니다.";
    case "TASK_STATE_COMPLETED":
      return "협상이 완료되었습니다.";
    case "TASK_STATE_REJECTED":
      return "상대 Agent가 제안을 거절했습니다.";
    case "TASK_STATE_FAILED":
      return "협상 처리 중 오류가 발생했습니다.";
    case "TASK_STATE_CANCELED":
      return "협상이 취소되었습니다.";
    default:
      return "협상 상태를 확인하고 있습니다.";
  }
}

export function calculateCreatorSettlement(milestones: Array<{ status: string; amountUsdc: number }>) {
  return milestones.reduce(
    (totals, milestone) => {
      const status = normalizeMilestoneStatus(milestone.status);
      if (status === "RELEASED") totals.paidAmount += milestone.amountUsdc;
      else if (status === "VERIFIED") totals.availableToClaimAmount += milestone.amountUsdc;
      else if (["PENDING", "IN_PROGRESS", "SUBMITTED"].includes(status)) totals.pendingAmount += milestone.amountUsdc;
      return totals;
    },
    { paidAmount: 0, availableToClaimAmount: 0, pendingAmount: 0 },
  );
}

export function calculateBrandEscrow(
  escrow: ApiEscrow | null,
  settlements: ApiSettlement[] = [],
) {
  const total = baseUnitsToUsdcNumber(escrow?.lockedAmountBaseUnits ?? "0");
  const releasedFromSettlements = settlements.reduce((sum, settlement) => {
    if (["CONFIRMED", "SIMULATED"].includes(String(settlement.status).toUpperCase())) {
      return sum + baseUnitsToUsdcNumber(settlement.amountBaseUnits);
    }
    return sum;
  }, 0);
  const released = Math.max(baseUnitsToUsdcNumber(escrow?.releasedAmountBaseUnits ?? "0"), releasedFromSettlements);
  const releasable = settlements.reduce((sum, settlement) => {
    if (String(settlement.status).toUpperCase() === "SUBMITTED") {
      return sum + baseUnitsToUsdcNumber(settlement.amountBaseUnits);
    }
    return sum;
  }, 0);
  return {
    lockedAmount: Math.max(total - released, 0),
    releasableAmount: releasable,
    releasedAmount: released,
  };
}

export function agreementMilestones(agreement: ApiAgreement) {
  const amount = agreement.terms.compensation.baseAmountUsdc;
  return agreement.terms.milestones.map((milestone, index) => ({
    id: milestone.id,
    order: index + 1,
    title: milestoneTitle(milestone.trigger),
    condition: milestone.trigger,
    amountUsdc: Math.round((amount * milestone.releasePct) / 100),
    status: "PENDING" as MilestoneStatus,
  }));
}

export function normalizeNegotiationEvents(
  messages: Array<Record<string, unknown>>,
  fallback: {
    negotiationId: string;
    taskId: string;
    contextId: string;
    brandAgentId: string;
    creatorAgentId: string;
    status?: string;
  },
): NegotiationEvent[] {
  return messages.map((message, index) => {
    const payload = isRecord(message.payload) ? message.payload : {};
    const type = negotiationMessageType(String(payload.type ?? (index === 0 ? "OFFER" : "COUNTER")));
    const senderType = String(message.role) === "ROLE_AGENT" ? "CREATOR_AGENT" : "BRAND_AGENT";
    return {
      id: stringValue(message.messageId, `message-${index + 1}`),
      negotiationId: fallback.negotiationId,
      taskId: stringValue(message.taskId, fallback.taskId),
      contextId: stringValue(message.contextId, fallback.contextId),
      senderAgentId: senderType === "BRAND_AGENT" ? fallback.brandAgentId : fallback.creatorAgentId,
      receiverAgentId: senderType === "BRAND_AGENT" ? fallback.creatorAgentId : fallback.brandAgentId,
      senderType,
      messageType: type,
      taskState: taskStateFromMessageType(type, fallback.status),
      round: numberValue(payload.round, index + 1),
      terms: payload.terms,
      rationale: optionalString(payload.rationale),
      createdAt: stringValue(message.createdAt, ""),
      raw: message,
    };
  });
}

function normalizeMilestoneStatus(status: string): MilestoneStatus {
  const normalized = status.toUpperCase();
  if (normalized === "NOTSTARTED") return "PENDING";
  if (normalized === "INPROGRESS") return "IN_PROGRESS";
  if (["PENDING", "IN_PROGRESS", "SUBMITTED", "VERIFIED", "RELEASED", "REJECTED"].includes(normalized)) {
    return normalized as MilestoneStatus;
  }
  return "PENDING";
}

function taskStateFromMessageType(type: NegotiationMessageType, status?: string): A2ATaskState {
  if (status === "AGREED" || type === "ACCEPT") return "TASK_STATE_COMPLETED";
  if (status === "REJECTED" || type === "REJECT") return "TASK_STATE_REJECTED";
  if (status === "FAILED") return "TASK_STATE_FAILED";
  if (status === "CANCELED") return "TASK_STATE_CANCELED";
  if (type === "ESCALATE") return "TASK_STATE_AUTH_REQUIRED";
  if (type === "COUNTER") return "TASK_STATE_INPUT_REQUIRED";
  return "TASK_STATE_SUBMITTED";
}

function negotiationMessageType(value: string): NegotiationMessageType {
  const normalized = value.toUpperCase();
  if (["OFFER", "COUNTER", "ACCEPT", "REJECT", "ESCALATE"].includes(normalized)) {
    return normalized as NegotiationMessageType;
  }
  return "OFFER";
}

function milestoneTitle(trigger: string) {
  if (trigger === "contractSigned") return "Agreement signed";
  if (trigger === "contentLiveVerified") return "Content verified";
  return trigger;
}

function baseUnitsToUsdcNumber(value: string) {
  const parsed = Number.parseInt(value || "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / 1_000_000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
