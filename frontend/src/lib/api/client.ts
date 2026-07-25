/**
 * Thin typed fetch client for the KNOT API v1.
 *
 * - Base URL from NEXT_PUBLIC_KNOT_API_URL (must include the /api/v1 prefix);
 *   defaults to http://localhost:8080/api/v1.
 * - Unwraps the {data, meta} envelope and returns `data`.
 * - Throws ProblemError (RFC 7807) on non-2xx responses.
 * - Payment POSTs (escrow lock, milestone release) send an Idempotency-Key
 *   header; one is generated when the caller does not supply it.
 */

import type {
  AgreementResponse,
  CandidateListResponse,
  Envelope,
  EscrowResponse,
  EvidenceResponse,
  EvidenceSubmitRequest,
  MatchRunResponse,
  NegotiationMessagesResponse,
  NegotiationResponse,
  Problem,
  PromotionCreateRequest,
  PromotionListResponse,
  PromotionResponse,
  ReceiptResponse,
  StartNegotiationResponse,
  TimelineResponse,
} from "./types";

export const DEFAULT_BASE_URL = "http://localhost:8080/api/v1";

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_KNOT_API_URL || DEFAULT_BASE_URL;
}

/** Typed error carrying the RFC 7807 problem details from the API. */
export class ProblemError extends Error implements Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: string;
  readonly violations?: Problem["violations"];

  constructor(problem: Problem) {
    super(`${problem.title}: ${problem.detail}`);
    this.name = "ProblemError";
    this.type = problem.type;
    this.title = problem.title;
    this.status = problem.status;
    this.detail = problem.detail;
    this.code = problem.code;
    this.violations = problem.violations;
  }
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  /** When set, an Idempotency-Key header is attached (payment POSTs). */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, idempotencyKey, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey !== undefined) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    cache: "no-store",
  });

  if (!res.ok) {
    let problem: Problem;
    try {
      problem = (await res.json()) as Problem;
    } catch {
      problem = {
        type: "about:blank",
        title: res.statusText || "Request failed",
        status: res.status,
        detail: `Request to ${path} failed with status ${res.status}.`,
        code: "UNKNOWN_ERROR",
      };
    }
    throw new ProblemError(problem);
  }

  const envelope = (await res.json()) as Envelope<T>;
  return envelope.data;
}

export const knotClient = {
  // -- Promotions -----------------------------------------------------------

  createPromotion(body: PromotionCreateRequest, signal?: AbortSignal) {
    return request<PromotionResponse>("/promotions", { method: "POST", body, signal });
  },

  listPromotions(signal?: AbortSignal) {
    return request<PromotionListResponse>("/promotions", { signal });
  },

  getPromotion(promotionId: string, signal?: AbortSignal) {
    return request<PromotionResponse>(`/promotions/${promotionId}`, { signal });
  },

  activatePromotion(promotionId: string, signal?: AbortSignal) {
    return request<PromotionResponse>(`/promotions/${promotionId}:activate`, {
      method: "POST",
      signal,
    });
  },

  runMatches(promotionId: string, signal?: AbortSignal) {
    return request<MatchRunResponse>(`/promotions/${promotionId}/matches:run`, {
      method: "POST",
      signal,
    });
  },

  getPromotionTimeline(promotionId: string, signal?: AbortSignal) {
    return request<TimelineResponse>(`/promotions/${promotionId}/timeline`, { signal });
  },

  // -- Match runs -----------------------------------------------------------

  getMatchRun(matchRunId: string, signal?: AbortSignal) {
    return request<MatchRunResponse>(`/match-runs/${matchRunId}`, { signal });
  },

  getMatchCandidates(matchRunId: string, signal?: AbortSignal) {
    return request<CandidateListResponse>(`/match-runs/${matchRunId}/candidates`, {
      signal,
    });
  },

  startNegotiation(matchRunId: string, signal?: AbortSignal) {
    return request<StartNegotiationResponse>(
      `/match-runs/${matchRunId}:start-negotiation`,
      { method: "POST", signal },
    );
  },

  // -- Negotiations ---------------------------------------------------------

  getNegotiation(negotiationId: string, signal?: AbortSignal) {
    return request<NegotiationResponse>(`/negotiations/${negotiationId}`, { signal });
  },

  getNegotiationMessages(negotiationId: string, signal?: AbortSignal) {
    return request<NegotiationMessagesResponse>(
      `/negotiations/${negotiationId}/messages`,
      { signal },
    );
  },

  getNegotiationEvents(negotiationId: string, signal?: AbortSignal) {
    return request<TimelineResponse>(`/negotiations/${negotiationId}/events`, {
      signal,
    });
  },

  // -- Agreements -----------------------------------------------------------

  getAgreement(agreementId: string, signal?: AbortSignal) {
    return request<AgreementResponse>(`/agreements/${agreementId}`, { signal });
  },

  // -- Escrow & payments (idempotent POSTs) ---------------------------------

  lockEscrow(agreementId: string, idempotencyKey?: string, signal?: AbortSignal) {
    return request<EscrowResponse>(`/agreements/${agreementId}/escrow:lock`, {
      method: "POST",
      idempotencyKey: idempotencyKey ?? newIdempotencyKey(),
      signal,
    });
  },

  getEscrow(escrowId: string, signal?: AbortSignal) {
    return request<EscrowResponse>(`/escrows/${escrowId}`, { signal });
  },

  releaseMilestone(
    escrowId: string,
    milestoneId: string,
    idempotencyKey?: string,
    signal?: AbortSignal,
  ) {
    return request<EscrowResponse>(
      `/escrows/${escrowId}/milestones/${milestoneId}:release`,
      { method: "POST", idempotencyKey: idempotencyKey ?? newIdempotencyKey(), signal },
    );
  },

  getTransactionReceipt(receiptId: string, signal?: AbortSignal) {
    return request<ReceiptResponse>(`/transaction-receipts/${receiptId}`, { signal });
  },

  // -- Evidence -------------------------------------------------------------

  submitEvidence(agreementId: string, body: EvidenceSubmitRequest, signal?: AbortSignal) {
    return request<EvidenceResponse>(`/agreements/${agreementId}/evidence`, {
      method: "POST",
      body,
      signal,
    });
  },

  verifyEvidence(evidenceId: string, signal?: AbortSignal) {
    return request<EvidenceResponse>(`/evidence/${evidenceId}:verify`, {
      method: "POST",
      signal,
    });
  },
};

export type KnotClient = typeof knotClient;

/**
 * Build a Solana explorer link for a receipt signature.
 * Returns null for simulated receipts (signature: null) — never fabricate links.
 */
export function explorerLink(signature: string | null): string | null {
  if (!signature) return null;
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}
