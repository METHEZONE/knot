"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ProductApiClient,
  type ApiCandidate,
  type ApiMatchRun,
  type ApiPromotion,
  type BrandPromotionCreateInput,
} from "@/product/apiClient";

type RunState = {
  promotion: ApiPromotion | null;
  matchRun: ApiMatchRun | null;
  candidates: ApiCandidate[];
  negotiationId: string | null;
};

export function BrandPromotionFlow() {
  const [state, setState] = useState<RunState>({ promotion: null, matchRun: null, candidates: [], negotiationId: null });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    setSelectedAgentId(null);
    try {
      const input = formToPromotion(formData);
      const client = new ProductApiClient();
      const promotion = await client.createBrandPromotion(input, idempotencyKey("brand-promotion"));
      const matchRun = await client.runMatches(promotion.promotionId);
      const candidates = await client.listCandidates(matchRun.matchRunId);
      setState({ promotion, matchRun, candidates, negotiationId: null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function select(candidate: ApiCandidate) {
    if (!state.matchRun) return;
    setSaving(true);
    setError(null);
    try {
      const response = await new ProductApiClient().selectCandidate(
        state.matchRun.matchRunId,
        candidate.creatorAgentId,
      );
      setSelectedAgentId(response.matchRun.selectedCreatorAgentId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  async function startNegotiation() {
    if (!state.matchRun) return;
    setSaving(true);
    setError(null);
    try {
      const { negotiation } = await new ProductApiClient().startNegotiation(state.matchRun.matchRunId);
      setState((current) => ({ ...current, negotiationId: negotiation.negotiationId }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 py-8">
      <div>
        <p className="font-mono text-xs uppercase text-muted">Brand</p>
        <h1 className="mt-1 text-4xl">협찬 제안하기</h1>
        <p className="mt-2 text-sm text-muted">Promotion을 만들고 Product API가 Creator 후보를 탐색합니다.</p>
      </div>

      <form action={submit} className="sketch ink grid gap-4 border border-border-subtle bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="productName" label="제품명" defaultValue="Daily SPF Moisturizer" />
          <Input name="title" label="Promotion 제목" defaultValue="Daily SPF Reels Campaign" />
          <Input name="category" label="카테고리" defaultValue="beauty" />
          <Input name="targetAudience" label="대상" defaultValue="skincare shoppers" />
          <Input name="totalBudget" label="총 예산 USDC" defaultValue="2000" type="number" />
          <Input name="maximumPerCreator" label="Creator당 한도 USDC" defaultValue="800" type="number" />
          <Input name="initialOffer" label="초기 제안 USDC" defaultValue="650" type="number" />
          <Input name="deadline" label="마감일" defaultValue="2026-08-15" type="date" />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">목표</span>
          <textarea
            name="objective"
            rows={3}
            defaultValue="Instagram Reels로 제품 사용 루틴과 자외선 차단 메시지를 전달합니다."
            className="sketch-alt ink border border-border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="sketch-pill self-start bg-accent px-5 py-2.5 text-sm text-background disabled:opacity-50"
        >
          {saving ? "탐색 중..." : "후보 탐색"}
        </button>
        {error ? <p className="text-sm text-muted">{error}</p> : null}
      </form>

      {state.promotion && state.matchRun ? (
        <section className="sketch ink border border-border-subtle bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl">후보 목록</h2>
              <p className="mt-1 font-mono text-xs text-muted">{state.matchRun.matchRunId}</p>
            </div>
            <Link href={`/brand/promotions/${state.promotion.promotionId}`} className="text-sm font-semibold text-muted hover:text-foreground">
              Promotion detail
            </Link>
          </div>
          <div className="mt-4 grid gap-3">
            {state.candidates.length ? state.candidates.map((candidate) => (
              <CandidateRow
                key={candidate.creatorAgentId}
                candidate={candidate}
                selected={selectedAgentId === candidate.creatorAgentId}
                disabled={saving || !candidate.eligible}
                onSelect={() => select(candidate)}
              />
            )) : (
              <div className="sketch-alt ink border border-border-subtle bg-background p-4 text-sm text-muted">
                후보가 없습니다. Promotion 조건을 조정하세요.
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startNegotiation}
              disabled={saving || !selectedAgentId}
              className="sketch-pill bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
            >
              협상 시작
            </button>
            {state.negotiationId ? (
              <Link href={`/negotiations/${state.negotiationId}`} className="text-sm font-semibold text-muted hover:text-foreground">
                Negotiation Detail 열기
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  disabled,
  onSelect,
}: {
  candidate: ApiCandidate;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="sketch-alt ink border border-border-subtle bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-muted">#{candidate.rank} {candidate.creatorId}</div>
          <div className="mt-1 text-lg">{candidate.creatorAgentId}</div>
        </div>
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          className="sketch-pill bg-accent px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {selected ? "선택됨" : candidate.eligible ? "후보 선택" : "부적합"}
        </button>
      </div>
      {candidate.hardFilterReasons?.length ? (
        <p className="mt-2 text-sm text-muted">{candidate.hardFilterReasons.join(", ")}</p>
      ) : null}
    </div>
  );
}

function Input({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required
        className="sketch-alt ink border border-border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
      />
    </label>
  );
}

function formToPromotion(formData: FormData): BrandPromotionCreateInput {
  const maximumPerCreator = numberField(formData, "maximumPerCreator");
  return {
    productName: stringField(formData, "productName"),
    title: stringField(formData, "title"),
    objective: stringField(formData, "objective"),
    categories: [stringField(formData, "category")],
    targetAudience: stringField(formData, "targetAudience"),
    totalBudget: numberField(formData, "totalBudget"),
    initialOffer: numberField(formData, "initialOffer"),
    maximumPerCreator,
    autoAcceptCeiling: maximumPerCreator,
    maximumRounds: 3,
    deliverables: [{ format: "reel", count: 1 }],
    usageRights: "paidBoost30d",
    deadline: stringField(formData, "deadline"),
    prohibitedClaims: ["medical cure"],
    autoEscrow: false,
    autoRelease: false,
  };
}

function stringField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function numberField(formData: FormData, key: string) {
  return Math.max(0, Number(formData.get(key) ?? 0));
}

function idempotencyKey(action: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `frontend-${action}-${crypto.randomUUID()}`;
  }
  return `frontend-${action}-${Date.now()}`;
}
