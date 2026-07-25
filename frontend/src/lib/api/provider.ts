/**
 * KNOT data provider — one interface, two modes.
 *
 * - Demo mode (NEXT_PUBLIC_KNOT_DEMO=1, or the API is unreachable): serves
 *   fixtures with realistic latencies.
 * - Live mode: delegates to the typed fetch client.
 *
 * Only network-level failures (fetch rejections) trigger the demo fallback;
 * API-level Problem errors (4xx/5xx) are re-thrown so callers see real errors.
 */

import { knotClient, ProblemError, type KnotClient } from "./client";
import type {
  EvidenceSubmitRequest,
  Promotion,
  PromotionCreateRequest,
} from "./types";
import {
  demoAgreement,
  demoCandidates,
  demoEscrow,
  demoEvidence,
  demoMatchRun,
  demoNegotiation,
  demoNegotiationEvents,
  demoNegotiationMessages,
  demoPromotion,
  demoPromotionTimeline,
} from "@/lib/fixtures";

export type KnotDataProvider = KnotClient & {
  /** True when the last served response came from fixtures. */
  readonly demoActive: boolean;
};

function isDemoModeForced(): boolean {
  return process.env.NEXT_PUBLIC_KNOT_DEMO === "1";
}

/** Simulate agent/API latency: 180–600 ms. */
function delay(): Promise<void> {
  const ms = 180 + Math.random() * 420;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

async function serveDemo<T>(value: T): Promise<T> {
  await delay();
  return clone(value);
}

// ---------------------------------------------------------------------------
// Demo implementation (fixtures + latency)
// ---------------------------------------------------------------------------

const demoClient: KnotClient = {
  createPromotion(body: PromotionCreateRequest) {
    const promotion: Promotion = {
      ...body,
      promotionId: `promo-${Date.now().toString(36)}`,
      brandId: demoPromotion.brandId,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
    return serveDemo({ promotion });
  },
  listPromotions() {
    return serveDemo({ promotions: [demoPromotion] });
  },
  getPromotion(promotionId: string) {
    return serveDemo({ promotion: { ...demoPromotion, promotionId } });
  },
  activatePromotion(promotionId: string) {
    return serveDemo({
      promotion: { ...demoPromotion, promotionId, status: "ACTIVE" as const },
    });
  },
  runMatches() {
    return serveDemo({ matchRun: demoMatchRun });
  },
  getPromotionTimeline() {
    return serveDemo({ events: demoPromotionTimeline });
  },
  getMatchRun(matchRunId: string) {
    return serveDemo({ matchRun: { ...demoMatchRun, matchRunId } });
  },
  getMatchCandidates() {
    return serveDemo({ candidates: demoCandidates });
  },
  startNegotiation() {
    return serveDemo({ negotiation: demoNegotiation, agreement: demoAgreement });
  },
  getNegotiation(negotiationId: string) {
    return serveDemo({ negotiation: { ...demoNegotiation, negotiationId } });
  },
  getNegotiationMessages() {
    return serveDemo({ messages: demoNegotiationMessages });
  },
  getNegotiationEvents() {
    return serveDemo({ events: demoNegotiationEvents });
  },
  getAgreement(agreementId: string) {
    return serveDemo({ agreement: { ...demoAgreement, agreementId } });
  },
  lockEscrow() {
    return serveDemo({ escrow: demoEscrow });
  },
  getEscrow(escrowId: string) {
    return serveDemo({ escrow: { ...demoEscrow, escrowId } });
  },
  releaseMilestone(_escrowId: string, milestoneId: string) {
    const escrow = clone(demoEscrow);
    const target = escrow.milestones.find((m) => m.id === milestoneId);
    if (target) {
      target.released = true;
      target.receiptId = `rcpt-${milestoneId}-001`;
    }
    escrow.status = escrow.milestones.every((m) => m.released)
      ? "RELEASED"
      : "PARTIALLY_RELEASED";
    return serveDemo({ escrow });
  },
  getTransactionReceipt(receiptId: string) {
    return serveDemo({ receipt: { ...demoEscrow.receipt, receiptId } });
  },
  submitEvidence(agreementId: string, body: EvidenceSubmitRequest) {
    return serveDemo({
      evidence: {
        ...demoEvidence,
        agreementId,
        url: body.url,
        submittedByAgentId: body.submittedByAgentId,
        milestoneId: body.milestoneId ?? null,
        status: "PENDING" as const,
        observations: null,
        policyDecision: null,
        createdAt: new Date().toISOString(),
      },
    });
  },
  verifyEvidence(evidenceId: string) {
    return serveDemo({ evidence: { ...demoEvidence, evidenceId } });
  },
};

// ---------------------------------------------------------------------------
// Fallback wiring
// ---------------------------------------------------------------------------

/** Once the API proves unreachable, prefer fixtures for a short window. */
const UNREACHABLE_TTL_MS = 30_000;
let unreachableSince = 0;

function apiRecentlyUnreachable(): boolean {
  return Date.now() - unreachableSince < UNREACHABLE_TTL_MS;
}

function isNetworkError(error: unknown): boolean {
  // ProblemError means the API answered — never mask it with fixtures.
  return !(error instanceof ProblemError);
}

type AnyFn = (...args: never[]) => Promise<unknown>;

function withFallback<F extends AnyFn>(live: F, demo: F): F {
  return (async (...args: Parameters<F>) => {
    if (isDemoModeForced() || apiRecentlyUnreachable()) {
      return demo(...args);
    }
    try {
      return await live(...args);
    } catch (error) {
      if (isNetworkError(error)) {
        unreachableSince = Date.now();
        return demo(...args);
      }
      throw error;
    }
  }) as F;
}

function buildProvider(): KnotDataProvider {
  const provider = {} as Record<string, unknown>;
  for (const key of Object.keys(knotClient) as (keyof KnotClient)[]) {
    provider[key] = withFallback(
      knotClient[key] as AnyFn,
      demoClient[key] as AnyFn,
    );
  }
  Object.defineProperty(provider, "demoActive", {
    get: () => isDemoModeForced() || apiRecentlyUnreachable(),
  });
  return provider as KnotDataProvider;
}

/** The single data access point for the app — same shape in both modes. */
export const knotProvider: KnotDataProvider = buildProvider();
