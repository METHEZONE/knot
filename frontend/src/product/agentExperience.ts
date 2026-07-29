import type {
  ApiAgreement,
  ApiEscrow,
  ApiNegotiation,
  ApiNegotiationMessage,
  ApiPromotion,
  ApiSettlement,
  ApiTimelineEvent,
  CurrentUserContext,
} from "./apiClient";
import { agreementMilestones, calculateBrandEscrow, calculateCreatorSettlement } from "./mvp";
import type { Role } from "./types";

export type AgentActivityType =
  | "MANAGER_INTRO"
  | "INBOUND_OFFER"
  | "NEGOTIATION_STARTED"
  | "OFFER"
  | "COUNTER"
  | "POLICY_CHECK"
  | "APPROVAL_REQUIRED"
  | "ACCEPT"
  | "REJECT"
  | "AGREEMENT"
  | "ESCROW_FUNDED"
  | "MILESTONE"
  | "NEXT_ACTION";

export type AgentActivityActor = "BRAND_AGENT" | "CREATOR_AGENT" | "POLICY" | "SYSTEM";
export type AgentActivityStatus = "WAITING" | "ACTIVE" | "DONE" | "BLOCKED" | "FAILED";

export type NegotiationTermsView = {
  amountUsdc?: number;
  deliverables?: string;
  usageRights?: string;
  deadline?: string;
  performancePct?: number;
};

export type AgentActivityItem = {
  id: string;
  type: AgentActivityType;
  actor: AgentActivityActor;
  actorName: string;
  title?: string;
  message: string;
  terms?: NegotiationTermsView;
  policyReason?: string;
  status: AgentActivityStatus;
  createdAt?: string;
  href?: string;
  developerMeta?: {
    taskId?: string;
    contextId?: string;
    messageId?: string;
    artifactId?: string;
  };
};

export type AgentManagerView = {
  role: Role;
  agentId: string;
  agentName: string;
  status: "ACTIVE" | "NEEDS_SETUP";
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  recentUpdate: string;
  settingsHref: string;
  activityHref: string;
};

export type AgreementEscrowView = {
  agreementId: string | null;
  termsHash: string | null;
  agreementStatus: string;
  amountUsdc: number | null;
  deliverables: string;
  usageRights: string;
  deadline: string;
  escrowStatus: string;
  network: string;
  fundedAmountUsdc: number;
  availableAmountUsdc: number;
  releasedAmountUsdc: number;
  signature: string | null;
  explorerUrl: string | null;
  milestones: Array<{
    id: string;
    title: string;
    percentage: number;
    amountUsdc: number;
    status: string;
    progressPercent: number;
  }>;
};

export type NextActionView = {
  label: string;
  href?: string;
  message: string;
};

export function managerFromContext(
  role: Role,
  context: CurrentUserContext,
  recentActivities: AgentActivityItem[] = [],
): AgentManagerView {
  const profile = context.profileSummary ?? {};
  const agentId = context.account.agentId ?? `${role}-agent`;
  const displayName = stringValue(
    profile.agentName,
    `${stringValue(context.account.displayName, role === "brand" ? "Brand" : "Creator")} Agent`,
  );
  const recentUpdate = recentActivities[0]?.message ?? "아직 최근 Agent 활동이 없습니다.";

  if (role === "brand") {
    const cap = firstPresent(profile.dealCapUsdc, profile.maxPerCreatorUsdc, profile.maximumPerCreator);
    return {
      role,
      agentId,
      agentName: displayName,
      status: context.account.onboardingStatus === "COMPLETED" ? "ACTIVE" : "NEEDS_SETUP",
      primaryLabel: "딜당 한도",
      primaryValue: cap ? `${cap} USDC` : "정책 설정 필요",
      secondaryLabel: "자동 체결",
      secondaryValue: booleanLike(profile.autoAcceptEnabled) ? "정책 범위 내 허용" : "승인 필요",
      recentUpdate,
      settingsHref: "/brand/settings/agent",
      activityHref: "/brand/promotions",
    };
  }

  const minimum = firstPresent(profile.minimumUsdc, profile.minimumAmountUsdc, profile.baseMinimumUsdc);
  const blocked = stringList(firstPresent(profile.blockedDomains, profile.blockedCategories, profile.excludedCategories));
  return {
    role,
    agentId,
    agentName: displayName,
    status: context.account.onboardingStatus === "COMPLETED" ? "ACTIVE" : "NEEDS_SETUP",
    primaryLabel: "기준선",
    primaryValue: minimum ? `${minimum} USDC` : "정책 설정 필요",
    secondaryLabel: "안 하는 것",
    secondaryValue: blocked.length ? blocked.join(" · ") : "설정된 제외 항목 없음",
    recentUpdate,
    settingsHref: "/creator/settings/agent",
    activityHref: "/creator/offers",
  };
}

export function dashboardActivitiesFromBrand(
  events: ApiTimelineEvent[],
  promotions: Array<ApiPromotion & Record<string, unknown>>,
): AgentActivityItem[] {
  const fromEvents = events.map((event) => timelineEventToActivity(event, "brand"));
  const fromPromotions = promotions.slice(0, 3).map((promotion) => ({
    id: `promotion-${promotion.promotionId}`,
    type: "NEXT_ACTION" as const,
    actor: "BRAND_AGENT" as const,
    actorName: agentName("brand", promotion.brandAgentId),
    title: "진행 중 Promotion",
    message: `${promotion.title} 상태를 ${promotion.status}로 추적하고 있어요.`,
    status: "ACTIVE" as const,
    href: `/brand/promotions/${promotion.promotionId}`,
  }));
  return dedupeActivities([...fromEvents, ...fromPromotions]).slice(0, 5);
}

export function dashboardActivitiesFromCreator(
  events: Array<Record<string, unknown>>,
  offers: Array<Record<string, unknown>>,
): AgentActivityItem[] {
  const fromEvents = events.map((event, index) =>
    recordToActivity(event, "creator", `creator-event-${index + 1}`),
  );
  const fromOffers = offers.slice(0, 5).map((offer, index) => {
    const negotiationId = stringValue(offer.negotiationId, "");
    const amount = numberMaybe(firstPresent(offer.currentAmountUsdc, offer.initialAmountUsdc));
    return {
      id: negotiationId || `creator-offer-${index + 1}`,
      type: "INBOUND_OFFER" as const,
      actor: "CREATOR_AGENT" as const,
      actorName: agentName("creator", stringValue(offer.creatorAgentId, "")),
      title: "새 제안",
      message: `${stringValue(offer.title, "Promotion")} 제안을 검토하고 있어요.${amount ? ` 현재 조건은 ${amount} USDC입니다.` : ""}`,
      terms: amount ? { amountUsdc: amount } : undefined,
      status: activityStatusFromDomain(stringValue(offer.status, "")),
      href: negotiationId ? `/creator/offers/${negotiationId}` : "/creator/offers",
    };
  });
  return dedupeActivities([...fromEvents, ...fromOffers]).slice(0, 5);
}

export function mapNegotiationMessagesToActivities({
  role,
  negotiation,
  messages,
  agreement,
  escrow,
}: {
  role: Role;
  negotiation: ApiNegotiation;
  messages: ApiNegotiationMessage[];
  agreement?: ApiAgreement | null;
  escrow?: ApiEscrow | null;
  settlements?: ApiSettlement[];
}): AgentActivityItem[] {
  const intro = managerIntro(role, negotiation);
  const mappedMessages = messages.map((message, index) =>
    negotiationMessageToActivity(message, negotiation, index),
  );
  const fallbackMessages = mappedMessages.length ? [] : fallbackNegotiationActivities(negotiation);
  const policy = policyActivity(negotiation);
  const agreementItem = agreement ? agreementActivity(agreement) : null;
  const escrowItem = escrow ? escrowActivity(escrow) : null;
  const next = nextActionActivity(role, negotiation, agreement ?? null, escrow ?? null);
  return dedupeActivities([
    intro,
    ...mappedMessages,
    ...fallbackMessages,
    ...(policy ? [policy] : []),
    ...(agreementItem ? [agreementItem] : []),
    ...(escrowItem ? [escrowItem] : []),
    next,
  ]);
}

export function agreementEscrowView(
  agreement: ApiAgreement | null | undefined,
  escrow: ApiEscrow | null | undefined,
  settlements: ApiSettlement[] = [],
  role: Role = "brand",
): AgreementEscrowView {
  const milestones = agreement ? agreementMilestones(agreement as ApiAgreement & Record<string, unknown>) : [];
  const creatorSettlement = calculateCreatorSettlement(milestones);
  const brandEscrow = calculateBrandEscrow(escrow ?? null, settlements);
  const amount = agreement?.terms.compensation.baseAmountUsdc ?? null;
  return {
    agreementId: agreement?.agreementId ?? null,
    termsHash: agreement?.termsHash ?? null,
    agreementStatus: agreement?.status ?? "NOT_CREATED",
    amountUsdc: amount,
    deliverables:
      agreement?.terms.deliverables.map((item) => `${item.format} ${item.count}`).join(", ") ??
      "Agreement 생성 후 표시됩니다",
    usageRights: agreement?.terms.usageRights ?? "pending",
    deadline: agreement?.terms.deliverables[0]?.postWindow.end ?? "pending",
    escrowStatus: escrow?.status ?? "NOT_FUNDED",
    network: "Solana devnet",
    fundedAmountUsdc: escrow ? baseUnitsToUsdcNumber(escrow.lockedAmountBaseUnits) : 0,
    availableAmountUsdc:
      role === "creator" ? creatorSettlement.availableToClaimAmount : brandEscrow.releasableAmount,
    releasedAmountUsdc:
      role === "creator" ? creatorSettlement.paidAmount : brandEscrow.releasedAmount,
    signature: escrow?.lockSignature ?? null,
    explorerUrl: escrow?.lockSignature
      ? `https://explorer.solana.com/tx/${escrow.lockSignature}?cluster=devnet`
      : null,
    milestones: milestones.map((milestone, index) => ({
      id: milestone.id,
      title: milestone.title,
      percentage: agreement?.terms.milestones[index]?.releasePct ?? 0,
      amountUsdc: milestone.amountUsdc,
      status: milestone.status,
      progressPercent: milestone.progressPercent,
    })),
  };
}

export function nextActionForDeal(
  role: Role,
  negotiation: ApiNegotiation,
  agreement: ApiAgreement | null | undefined,
  escrow: ApiEscrow | null | undefined,
): NextActionView {
  const status = negotiation.status;
  if (status === "ESCALATED") {
    return {
      label: "사용자 승인",
      message: "정책 자동 권한을 벗어나 승인이 필요합니다.",
    };
  }
  if (!agreement) {
    return role === "brand"
      ? {
          label: "에이전트 협상하기",
          href: `/brand/negotiations/${negotiation.negotiationId}`,
          message: "Agent 협상을 진행해 Agreement를 생성하세요.",
        }
      : {
          label: "전체 대화 보기",
          href: `/creator/offers/${negotiation.negotiationId}`,
          message: "제안 조건과 Agent 협상 상태를 확인하세요.",
        };
  }
  if (!escrow || escrow.status === "CREATED" || escrow.status === "FAILED") {
    return role === "brand"
      ? {
          label: "Escrow 예치",
          href: `/brand/settlement?agreementId=${agreement.agreementId}`,
          message: "Agreement가 생성되었습니다. 지갑에서 에스크로 예치를 승인하세요.",
        }
      : {
          label: "Agreement 확인",
          href: `/creator/agreements/${agreement.agreementId}`,
          message: "Agreement가 생성되었습니다. 에스크로 예치 상태를 기다리고 있어요.",
        };
  }
  if (role === "creator") {
    return {
      label: "게시물 링크 제출",
      href: `/creator/agreements/${agreement.agreementId}`,
      message: "게시물 링크를 제출하면 검증과 정산이 이어집니다.",
    };
  }
  return {
    label: "콘텐츠 검수",
    href: `/brand/agreements/${agreement.agreementId}`,
    message: "Creator 수행 증빙이 들어오면 검수 후 정산할 수 있습니다.",
  };
}

function managerIntro(role: Role, negotiation: ApiNegotiation): AgentActivityItem {
  return {
    id: `intro-${negotiation.negotiationId}`,
    type: "MANAGER_INTRO",
    actor: role === "brand" ? "BRAND_AGENT" : "CREATOR_AGENT",
    actorName: agentName(role, role === "brand" ? negotiation.brandAgentId : negotiation.creatorAgentId),
    title: "Manager",
    message:
      role === "creator"
        ? "안녕하세요. 이제 제가 대신 붙겠습니다. 기준과 공개 가능한 조건만 사용해 협상합니다."
        : "안녕하세요. Promotion 조건과 정책 범위 안에서 Creator Agent와 협상합니다.",
    status: "DONE",
    developerMeta: {
      taskId: negotiation.taskId,
      contextId: negotiation.contextId,
    },
  };
}

function negotiationMessageToActivity(
  message: ApiNegotiationMessage,
  negotiation: ApiNegotiation,
  index: number,
): AgentActivityItem {
  const payload = isRecord(message.payload) ? message.payload : {};
  const messageType = stringValue(payload.type, index === 0 ? "OFFER" : "COUNTER").toUpperCase();
  const actor = String(message.role) === "ROLE_AGENT" ? "CREATOR_AGENT" : "BRAND_AGENT";
  const terms = termsFromUnknown(firstPresent(payload.terms, message.a2aMessage, negotiation.currentTerms));
  return {
    id: message.messageId || `message-${index + 1}`,
    type: activityTypeFromMessage(messageType),
    actor,
    actorName: actor === "BRAND_AGENT" ? agentName("brand", negotiation.brandAgentId) : agentName("creator", negotiation.creatorAgentId),
    title: titleFromMessage(messageType),
    message: sanitizedMessage(messageType, actor, terms, payload.rationale),
    terms,
    status: statusFromMessage(messageType, negotiation.status),
    createdAt: message.createdAt,
    developerMeta: {
      taskId: message.taskId,
      contextId: message.contextId,
      messageId: message.messageId,
    },
  };
}

function fallbackNegotiationActivities(negotiation: ApiNegotiation): AgentActivityItem[] {
  const terms = termsFromUnknown(negotiation.currentTerms);
  return [
    {
      id: `offer-${negotiation.negotiationId}`,
      type: "OFFER",
      actor: "BRAND_AGENT",
      actorName: agentName("brand", negotiation.brandAgentId),
      title: "제안",
      message: amountMessage("릴스 조건으로 제안을 시작했어요.", terms),
      terms,
      status: negotiation.status === "CREATED" ? "ACTIVE" : "DONE",
      developerMeta: {
        taskId: negotiation.taskId,
        contextId: negotiation.contextId,
      },
    },
    {
      id: `counter-${negotiation.negotiationId}`,
      type: negotiation.status === "AGREED" ? "ACCEPT" : "COUNTER",
      actor: "CREATOR_AGENT",
      actorName: agentName("creator", negotiation.creatorAgentId),
      title: negotiation.status === "AGREED" ? "수락" : "검토",
      message:
        negotiation.status === "AGREED"
          ? amountMessage("조건이 기준을 충족해 수락했어요.", terms)
          : "조건과 정책을 검토하고 있어요.",
      terms,
      status: negotiation.status === "AGREED" ? "DONE" : "ACTIVE",
      developerMeta: {
        taskId: negotiation.taskId,
        contextId: negotiation.contextId,
      },
    },
  ];
}

function policyActivity(negotiation: ApiNegotiation): AgentActivityItem | null {
  if (!["COUNTERED", "ESCALATED", "AGREED", "REJECTED", "FAILED"].includes(negotiation.status)) {
    return null;
  }
  return {
    id: `policy-${negotiation.negotiationId}`,
    type: negotiation.status === "ESCALATED" ? "APPROVAL_REQUIRED" : "POLICY_CHECK",
    actor: "POLICY",
    actorName: "Policy",
    title: negotiation.status === "ESCALATED" ? "사용자 승인 필요" : "정책 검사",
    message:
      negotiation.status === "ESCALATED"
        ? "자동 승인 범위를 벗어나 사용자 확인이 필요합니다."
        : "정책 범위와 공개 조건을 검사했습니다.",
    policyReason:
      negotiation.status === "AGREED"
        ? "딜당 한도와 Creator 기준선을 모두 충족했습니다."
        : "상대의 private policy 값은 표시하지 않습니다.",
    status: negotiation.status === "FAILED" ? "FAILED" : negotiation.status === "ESCALATED" ? "BLOCKED" : "DONE",
  };
}

function agreementActivity(agreement: ApiAgreement): AgentActivityItem {
  return {
    id: `agreement-${agreement.agreementId}`,
    type: "AGREEMENT",
    actor: "SYSTEM",
    actorName: "Agreement",
    title: "계약",
    message: `${deliverablesLabel(agreement)} 조건으로 Agreement가 생성되었습니다.`,
    terms: termsFromUnknown(agreement.terms),
    status: agreement.status === "AGREED" ? "DONE" : "BLOCKED",
    developerMeta: {
      taskId: agreement.taskId,
      artifactId: agreement.artifactId,
    },
  };
}

function escrowActivity(escrow: ApiEscrow): AgentActivityItem {
  const locked = baseUnitsToUsdcNumber(escrow.lockedAmountBaseUnits);
  const confirmed = Boolean(escrow.lockSignature);
  return {
    id: `escrow-${escrow.escrowId}`,
    type: "ESCROW_FUNDED",
    actor: "SYSTEM",
    actorName: "Escrow",
    title: "에스크로",
    message: confirmed
      ? `${locked} USDC가 Solana devnet escrow에 잠겼어요.`
      : `에스크로 상태는 ${escrow.status}입니다. 실제 signature가 확인되면 Explorer 링크가 표시됩니다.`,
    terms: { amountUsdc: locked },
    status: escrow.status === "FAILED" ? "FAILED" : confirmed ? "DONE" : "ACTIVE",
  };
}

function nextActionActivity(
  role: Role,
  negotiation: ApiNegotiation,
  agreement: ApiAgreement | null,
  escrow: ApiEscrow | null,
): AgentActivityItem {
  const next = nextActionForDeal(role, negotiation, agreement, escrow);
  return {
    id: `next-${negotiation.negotiationId}`,
    type: "NEXT_ACTION",
    actor: role === "brand" ? "BRAND_AGENT" : "CREATOR_AGENT",
    actorName: agentName(role, role === "brand" ? negotiation.brandAgentId : negotiation.creatorAgentId),
    title: "Next Action",
    message: next.message,
    status: "WAITING",
    href: next.href,
  };
}

function timelineEventToActivity(event: ApiTimelineEvent, role: Role): AgentActivityItem {
  const negotiationId = stringValue(event.data.negotiationId, "");
  return {
    id: event.eventId,
    type: eventTypeToActivityType(event.type),
    actor: role === "brand" ? "BRAND_AGENT" : "CREATOR_AGENT",
    actorName: agentName(role, stringValue(event.data.agentId, "")),
    title: event.type,
    message: messageFromTimeline(event),
    status: event.type.includes("FAILED") ? "FAILED" : "DONE",
    createdAt: event.createdAt,
    href: negotiationId ? `/brand/negotiations/${negotiationId}` : undefined,
  };
}

function recordToActivity(record: Record<string, unknown>, role: Role, fallbackId: string): AgentActivityItem {
  const negotiationId = stringValue(record.negotiationId, "");
  return {
    id: negotiationId || stringValue(record.eventId, fallbackId),
    type: eventTypeToActivityType(stringValue(record.type, "INBOUND_OFFER")),
    actor: role === "brand" ? "BRAND_AGENT" : "CREATOR_AGENT",
    actorName: agentName(role, stringValue(record.agentId, "")),
    title: stringValue(record.type, "Agent 활동"),
    message: stringValue(record.message, `${stringValue(record.title, "제안")} 상태를 확인하고 있어요.`),
    status: activityStatusFromDomain(stringValue(record.status, "")),
    createdAt: stringValue(record.createdAt, ""),
    href: negotiationId ? `/creator/offers/${negotiationId}` : undefined,
  };
}

function eventTypeToActivityType(type: string): AgentActivityType {
  const normalized = type.toUpperCase();
  if (normalized.includes("AGREEMENT")) return "AGREEMENT";
  if (normalized.includes("ESCROW")) return "ESCROW_FUNDED";
  if (normalized.includes("NEGOTIATION")) return "NEGOTIATION_STARTED";
  if (normalized.includes("MATCH")) return "NEGOTIATION_STARTED";
  return "NEXT_ACTION";
}

function messageFromTimeline(event: ApiTimelineEvent) {
  const title = stringValue(event.data.title, stringValue(event.data.promotionTitle, "Promotion"));
  if (event.type === "NEGOTIATION_STARTED") return `${title} 협상이 시작됐어요.`;
  if (event.type === "AGREEMENT_CREATED") return `${title} Agreement가 생성됐어요.`;
  if (event.type.includes("ESCROW")) return `${title} escrow 상태가 업데이트됐어요.`;
  if (event.type.includes("MATCH")) return `${title} Creator 후보를 정리했어요.`;
  return `${title} 활동이 업데이트됐어요.`;
}

function activityTypeFromMessage(type: string): AgentActivityType {
  if (type === "OFFER") return "OFFER";
  if (type === "COUNTER") return "COUNTER";
  if (type === "ACCEPT") return "ACCEPT";
  if (type === "REJECT") return "REJECT";
  if (type === "ESCALATE") return "APPROVAL_REQUIRED";
  return "NEGOTIATION_STARTED";
}

function titleFromMessage(type: string) {
  if (type === "OFFER") return "제안";
  if (type === "COUNTER") return "역제안";
  if (type === "ACCEPT") return "수락";
  if (type === "REJECT") return "거절";
  if (type === "ESCALATE") return "승인 요청";
  return "Agent 메시지";
}

function sanitizedMessage(
  type: string,
  actor: AgentActivityActor,
  terms: NegotiationTermsView,
  rationale: unknown,
) {
  const base =
    type === "OFFER"
      ? "공개 가능한 조건으로 제안을 시작했어요."
      : type === "COUNTER"
        ? "조건을 검토하고 공개 가능한 역제안을 보냈어요."
        : type === "ACCEPT"
          ? "정책 범위 안이라 수락했어요."
          : type === "REJECT"
            ? "정책 기준에 맞지 않아 거절했어요."
            : type === "ESCALATE"
              ? "자동 승인 범위를 벗어나 사용자 확인을 요청했어요."
              : "Agent 상태가 업데이트됐어요.";
  const prefix = actor === "BRAND_AGENT" ? "Brand Agent가 " : actor === "CREATOR_AGENT" ? "Creator Agent가 " : "";
  const reason = typeof rationale === "string" && rationale.trim() ? ` ${redactPolicyLeak(rationale)}` : "";
  return amountMessage(`${prefix}${base}`, terms) + reason;
}

function amountMessage(message: string, terms: NegotiationTermsView) {
  return terms.amountUsdc ? `${message} 현재 조건은 ${terms.amountUsdc} USDC입니다.` : message;
}

function statusFromMessage(type: string, domainStatus: string): AgentActivityStatus {
  if (type === "REJECT") return "BLOCKED";
  if (type === "ESCALATE") return "BLOCKED";
  if (domainStatus === "FAILED") return "FAILED";
  if (["AGREED", "REJECTED", "COUNTERED"].includes(domainStatus)) return "DONE";
  return "ACTIVE";
}

function activityStatusFromDomain(status: string): AgentActivityStatus {
  const normalized = status.toUpperCase();
  if (["FAILED", "ERROR"].includes(normalized)) return "FAILED";
  if (["REJECTED", "ESCALATED"].includes(normalized)) return "BLOCKED";
  if (["AGREED", "COMPLETED", "DONE"].includes(normalized)) return "DONE";
  return "ACTIVE";
}

function termsFromUnknown(value: unknown): NegotiationTermsView {
  const terms = isRecord(value) ? value : {};
  const compensation = isRecord(terms.compensation) ? terms.compensation : {};
  const deliverables = Array.isArray(terms.deliverables)
    ? terms.deliverables
        .filter(isRecord)
        .map((item) => `${stringValue(item.format, "content")} ${numberMaybe(item.count) ?? 1}`)
        .join(", ")
    : undefined;
  const firstDeliverable = Array.isArray(terms.deliverables) && isRecord(terms.deliverables[0])
    ? terms.deliverables[0]
    : {};
  const postWindow = isRecord(firstDeliverable.postWindow) ? firstDeliverable.postWindow : {};
  return {
    amountUsdc: numberMaybe(firstPresent(compensation.baseAmountUsdc, terms.amountUsdc, terms.baseAmountUsdc)),
    deliverables,
    usageRights: optionalString(terms.usageRights),
    deadline: optionalString(postWindow.end),
    performancePct: numberMaybe(compensation.performancePct),
  };
}

function deliverablesLabel(agreement: ApiAgreement) {
  const label = agreement.terms.deliverables
    .map((deliverable) => `${deliverable.format} ${deliverable.count}`)
    .join(", ");
  return label || "공개 조건";
}

function agentName(role: Role, agentId: string) {
  if (agentId) return role === "brand" ? "Brand Agent" : "Creator Agent";
  return role === "brand" ? "Brand Agent" : "Creator Agent";
}

function dedupeActivities(items: AgentActivityItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function redactPolicyLeak(value: string) {
  return value
    .replace(/\b(?:creator\s+)?(?:minimum|minimum\s+amount|min\s+rate|base\s+minimum)[^,.]*(\d+)[^,.]*/gi, "기준선을 확인했습니다")
    .replace(/\b(?:brand\s+)?(?:hard\s+maximum|max\s+budget|maximum\s+budget|deal\s+cap)[^,.]*(\d+)[^,.]*/gi, "딜당 한도를 확인했습니다");
}

function baseUnitsToUsdcNumber(value: string) {
  const parsed = Number.parseInt(value || "0", 10);
  if (!Number.isFinite(parsed)) return 0;
  return parsed / 1_000_000;
}

function firstPresent(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberMaybe(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function stringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function booleanLike(value: unknown) {
  return value === true || value === "true" || value === "enabled" || value === "ALLOW";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
