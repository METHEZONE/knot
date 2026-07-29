"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductApiClient, type BrandPromotionDetail as Detail } from "@/product/apiClient";

type LoadState =
  | { status: "loading"; detail: null; error: null }
  | { status: "ready"; detail: Detail; error: null }
  | { status: "error"; detail: null; error: string };

export function BrandPromotionDetail({ promotionId }: { promotionId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading", detail: null, error: null });

  useEffect(() => {
    let cancelled = false;
    new ProductApiClient()
      .getBrandPromotionDetail(promotionId)
      .then((detail) => {
        if (!cancelled) setState({ status: "ready", detail, error: null });
      })
      .catch((caught) => {
        if (!cancelled) {
          setState({
            status: "error",
            detail: null,
            error: caught instanceof Error ? caught.message : String(caught),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [promotionId]);

  if (state.status === "loading") {
    return <Shell promotionId={promotionId}><Panel text="Promotion을 불러오는 중..." /></Shell>;
  }
  if (state.status === "error") {
    return <Shell promotionId={promotionId}><Panel text={state.error} /></Shell>;
  }

  const { promotion, activity, agreements } = state.detail;
  return (
    <Shell promotionId={promotionId}>
      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">{text(promotion.title) || promotionId}</h2>
          <span className="font-mono text-xs text-muted">{text(promotion.status) || "OPEN"}</span>
        </div>
        <p className="mt-2 text-sm text-muted">{text(promotion.objective)}</p>
      </section>
      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <h2 className="text-2xl">Negotiation 목록</h2>
        <div className="mt-4 grid gap-3">
          {agreements?.length ? agreements.map((agreement) => (
            <Link
              key={text(agreement.negotiationId) || text(agreement.agreementId)}
              href={`/negotiations/${text(agreement.negotiationId)}`}
              className="sketch-alt ink border border-border-subtle bg-background p-4 hover:bg-surface-raised"
            >
              <div className="font-mono text-sm">{text(agreement.negotiationId)}</div>
              <div className="mt-1 text-sm text-muted">{text(agreement.status)}</div>
            </Link>
          )) : <Panel text="아직 협상 또는 Agreement가 없습니다." />}
        </div>
      </section>
      <section className="sketch ink border border-border-subtle bg-surface p-5">
        <h2 className="text-2xl">최근 활동</h2>
        <div className="mt-4 grid gap-3">
          {activity.length ? activity.map((event) => (
            <div key={event.eventId} className="sketch-alt ink border border-border-subtle bg-background p-4">
              <div className="font-mono text-xs text-muted">{event.type}</div>
              <div className="mt-1 text-sm">{event.createdAt}</div>
            </div>
          )) : <Panel text="활동이 없습니다." />}
        </div>
      </section>
    </Shell>
  );
}

function Shell({ promotionId, children }: { promotionId: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-8">
      <div>
        <p className="font-mono text-xs uppercase text-muted">Promotion</p>
        <h1 className="mt-1 text-4xl">{promotionId}</h1>
      </div>
      {children}
      <Link href="/brand" className="text-sm font-semibold text-muted hover:text-foreground">
        Dashboard로 돌아가기
      </Link>
    </div>
  );
}

function Panel({ text: value }: { text: string }) {
  return <div className="sketch-alt ink border border-border-subtle bg-background p-4 text-sm text-muted">{value}</div>;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}
