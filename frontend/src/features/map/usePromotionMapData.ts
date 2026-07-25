"use client";

/**
 * Client data hook for the Agent Society Map.
 *
 * Starts from server-rendered timeline events, then resolves the artifact ids
 * referenced by those events (matchRunId, negotiationId, escrowId) into full
 * resources via the KNOT provider. Polls modestly so the map tracks agents
 * working the promotion live.
 */

import { useEffect, useState } from "react";
import { knotProvider } from "@/lib/api/provider";
import type {
  Escrow,
  MatchCandidate,
  MatchRun,
  Negotiation,
  TimelineEvent,
} from "@/lib/api/types";

const POLL_INTERVAL_MS = 12_000;

/** Latest event carrying a string `data[key]` wins. */
function findLatestId(events: TimelineEvent[], key: string): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const value = events[i].data?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export interface PromotionMapData {
  events: TimelineEvent[];
  matchRun: MatchRun | null;
  candidates: MatchCandidate[];
  negotiation: Negotiation | null;
  escrow: Escrow | null;
  loading: boolean;
}

export function usePromotionMapData(
  promotionId: string,
  initialEvents: TimelineEvent[],
): PromotionMapData {
  const [data, setData] = useState<PromotionMapData>({
    events: initialEvents,
    matchRun: null,
    candidates: [],
    negotiation: null,
    escrow: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const { events } = await knotProvider.getPromotionTimeline(promotionId, signal);
        if (cancelled) return;

        const matchRunId = findLatestId(events, "matchRunId");
        const negotiationId = findLatestId(events, "negotiationId");
        const escrowId = findLatestId(events, "escrowId");

        const [matchRun, candidates, negotiation, escrow] = await Promise.all([
          matchRunId
            ? knotProvider.getMatchRun(matchRunId, signal).then((d) => d.matchRun)
            : Promise.resolve(null),
          matchRunId
            ? knotProvider
                .getMatchCandidates(matchRunId, signal)
                .then((d) => d.candidates)
            : Promise.resolve([] as MatchCandidate[]),
          negotiationId
            ? knotProvider
                .getNegotiation(negotiationId, signal)
                .then((d) => d.negotiation)
            : Promise.resolve(null),
          escrowId
            ? knotProvider.getEscrow(escrowId, signal).then((d) => d.escrow)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        setData({ events, matchRun, candidates, negotiation, escrow, loading: false });
      } catch {
        // Keep the last good state; the audit map never fabricates data.
        if (!cancelled) setData((prev) => ({ ...prev, loading: false }));
      }
    }

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
    // initialEvents is a seed only; refetching is keyed by promotionId.
  }, [promotionId]);

  return data;
}
