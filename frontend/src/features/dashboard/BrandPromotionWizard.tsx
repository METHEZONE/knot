"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { Money } from "@/features/chat/Money";
import { analysisSourceLabel } from "@/features/onboard/analysisSourceLabel";
import { ProductApiClient, ProductApiError, type AnalysisJob } from "@/product/apiClient";

type WizardStep = "url" | "review" | "running";

type MoodDraft = {
  analysisId: string;
  productUrl: string;
  productName: string;
  priceKrw: number | null;
  summary: string;
  category: string;
  moodTags: string[];
  totalUsdc: NumericDraftValue;
  maxPerDealUsdc: NumericDraftValue;
  deadline: string;
  workBrief: string;
  deliverables: DeliverableCounts;
  prohibitedClaims: string;
  usageRights: string;
  provider: string;
  fallbackReason: string | null;
};

type NumericDraftValue = number | "";

type DeliverableCounts = {
  reel: number;
  short: number;
  post: number;
};

const RECOMMENDED_MOODS = ["설명형", "루틴", "클로즈업", "정보", "신뢰", "솔직함"];
const DELIVERABLE_CONTROLS: Array<{ key: keyof DeliverableCounts; label: string }> = [
  { key: "reel", label: "릴스" },
  { key: "short", label: "숏츠" },
  { key: "post", label: "게시글" },
];

export function BrandPromotionWizard() {
  const router = useRouter();
  const client = useMemo(() => new ProductApiClient(), []);
  const [step, setStep] = useState<WizardStep>("url");
  const [productUrl, setProductUrl] = useState("");
  const [draft, setDraft] = useState<MoodDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function extractMood() {
    if (!productUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const normalizedUrl = normalizeSourceUrl(productUrl);
      const analysis = await client.analyzeProduct(normalizedUrl);
      setDraft(draftFromAnalysis(analysis));
      setStep("review");
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function startNegotiation() {
    if (!draft) return;
    setStep("running");
    setBusy(true);
    setError(null);
    try {
      const maxPerCreator = normalizedUsdc(numericDraftValue(draft.maxPerDealUsdc), 1);
      const totalBudget = Math.max(normalizedUsdc(numericDraftValue(draft.totalUsdc), maxPerCreator), maxPerCreator);
      const initialOffer = initialOfferForMax(maxPerCreator);
      const promotionPayload = {
        productName: draft.productName,
        title: `${draft.productName} 협찬 프로젝트`,
        objective: `${draft.workBrief.trim()} · ${draft.summary || "제품 인지도와 실제 사용 콘텐츠 확보"}`,
        categories: [draft.category || "beauty"],
        targetAudience: draft.moodTags.join(", "),
        totalBudget,
        initialOffer,
        maximumPerCreator: maxPerCreator,
        autoAcceptCeiling: maxPerCreator,
        maximumRounds: 3,
        deliverables: deliverablesFromDraft(draft.deliverables),
        usageRights: draft.usageRights,
        deadline: draft.deadline,
        prohibitedClaims: splitList(draft.prohibitedClaims),
      };
      const promotion = await client.createBrandPromotion(
        promotionPayload,
        uniqueRequestKey("promotion"),
      );
      const flow = await client.runAgentForPromotion(promotion.promotionId);
      if (flow.negotiation) {
        router.push(`/brand/negotiations/${flow.negotiation.negotiationId}`);
      } else {
        router.push("/brand?agent=waiting");
      }
    } catch (caught) {
      setStep("review");
      setError(readableError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-8">
      <section className="grid items-center gap-5 md:grid-cols-[1fr_auto]">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">promotion setup</p>
          <h1 className="mt-2 text-5xl">프로모션 만들기</h1>
          <p className="mt-2 max-w-2xl text-muted">
            제품 URL에서 무드를 추출하고, 사람이 검토한 뒤 브랜드 매니저가 바로 협상을 시작합니다.
          </p>
        </div>
        <AgentCharacter agentId="brand-agent-glow" side="brand" category={draft?.category ?? "beauty"} pose="knock" size={140} />
      </section>

      <section className="sketch ink border border-border-subtle bg-surface p-5">
        {step === "url" ? (
          <div className="grid gap-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">1 / 2</p>
              <h2 className="mt-1 text-3xl">제품 URL 입력</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
                placeholder="thezonebio.com/products/spf 또는 https://..."
                className="sketch-alt ink min-w-0 flex-1 border border-border-subtle bg-surface-raised px-4 py-3 outline-none"
              />
              <button
                type="button"
                onClick={extractMood}
                disabled={busy || !productUrl.trim()}
                className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
              >
                {busy ? "추출 중…" : "무드 추출"}
              </button>
            </div>
          </div>
        ) : null}

        {step === "review" && draft ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">2 / 2</p>
              <h2 className="mt-1 text-3xl">추출된 무드 검토</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="sketch-alt ink border border-border-subtle bg-surface-raised p-4">
                <label className="block text-sm text-muted">
                  제품명
                  <input
                    value={draft.productName}
                    onChange={(event) => setDraft({ ...draft, productName: event.target.value })}
                    className="sketch-alt ink mt-2 w-full border border-border-subtle bg-surface px-3 py-2 text-xl outline-none"
                  />
                </label>
                <label className="mt-4 block text-sm text-muted">
                  카테고리
                  <input
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                    placeholder="beauty, food, tech..."
                    className="sketch-alt ink mt-2 w-full border border-border-subtle bg-surface px-3 py-2 text-base outline-none"
                  />
                </label>
                <p className="mt-3 text-sm text-muted">{draft.summary}</p>
                <p className="mt-2 text-xs text-muted">
                  {analysisSourceLabel(draft.provider, draft.fallbackReason)}
                </p>
                <label className="mt-4 block text-sm text-muted">
                  해야 하는 작업
                  <textarea
                    value={draft.workBrief}
                    onChange={(event) => setDraft({ ...draft, workBrief: event.target.value })}
                    placeholder="예: 릴스 1개에서 제품 사용 장면과 사용감을 보여주고, 설명란에 브랜드명과 필수 해시태그를 넣기"
                    className="sketch-alt ink mt-2 min-h-20 w-full border border-border-subtle bg-surface px-3 py-2 text-base outline-none"
                  />
                </label>
                <label className="mt-4 block text-sm text-muted">
                  금지 표현
                  <textarea
                    value={draft.prohibitedClaims}
                    onChange={(event) => setDraft({ ...draft, prohibitedClaims: event.target.value })}
                    placeholder="줄바꿈 또는 쉼표로 입력"
                    className="sketch-alt ink mt-2 min-h-16 w-full border border-border-subtle bg-surface px-3 py-2 text-base outline-none"
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {RECOMMENDED_MOODS.map((mood) => {
                    const active = draft.moodTags.includes(mood);
                    return (
                      <button
                        key={mood}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            moodTags: active
                              ? draft.moodTags.filter((item) => item !== mood)
                              : [...draft.moodTags, mood],
                          })
                        }
                        className={`sketch-pill ink border border-border-subtle px-3 py-1.5 text-sm ${
                          active ? "bg-accent text-background" : "bg-surface text-muted"
                        }`}
                      >
                        {mood}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sketch ink border border-border-subtle bg-background p-4">
                <div>
                  <p className="text-sm text-muted">작업 수량</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {DELIVERABLE_CONTROLS.map((control) => (
                      <label key={control.key} className="sketch-alt ink border border-border-subtle bg-surface-raised p-3 text-sm text-muted">
                        {control.label}
                        <input
                          type="number"
                          min={0}
                          max={9}
                          step={1}
                          value={draft.deliverables[control.key]}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              deliverables: {
                                ...draft.deliverables,
                                [control.key]: Math.max(0, Number(event.target.value)),
                              },
                            })
                          }
                          className="mt-2 w-full bg-transparent font-mono text-2xl text-foreground outline-none"
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">{deliverableSummary(draft.deliverables)}</p>
                </div>
                <label className="block text-sm text-muted">
                  총 예산
                  <span className="mt-2 flex items-baseline gap-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={draft.totalUsdc}
                      onChange={(event) => {
                        const totalUsdc = usdcInputValue(event.target.value);
                        setDraft({ ...draft, totalUsdc });
                      }}
                      className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
                    />
                    <span className="font-mono">USDC</span>
                  </span>
                </label>
                <label className="mt-4 block text-sm text-muted">
                  사용권
                  <select
                    value={draft.usageRights}
                    onChange={(event) => setDraft({ ...draft, usageRights: event.target.value })}
                    className="sketch-alt ink mt-2 w-full border border-border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                  >
                    <option value="organicOnly">Organic only</option>
                    <option value="paidBoost30d">Paid boost 30d</option>
                    <option value="fullLicense90d">Full license 90d</option>
                  </select>
                </label>
                <label className="mt-4 block text-sm text-muted">
                  게시 마감일
                  <input
                    type="date"
                    value={draft.deadline}
                    min={todayDate()}
                    onChange={(event) => setDraft({ ...draft, deadline: event.target.value })}
                    className="sketch-alt ink mt-2 w-full border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-sm outline-none"
                  />
                </label>
                <label className="mt-4 block text-sm text-muted">
                  딜당 한도
                  <span className="mt-2 flex items-baseline gap-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={draft.maxPerDealUsdc}
                      onChange={(event) => {
                        const maxPerDealUsdc = usdcInputValue(event.target.value);
                        const normalizedMax = normalizedUsdc(numericDraftValue(maxPerDealUsdc), 1);
                        const currentTotal = numericDraftValue(draft.totalUsdc);
                        setDraft({
                          ...draft,
                          maxPerDealUsdc,
                          totalUsdc: currentTotal > 0 ? Math.max(currentTotal, normalizedMax) : draft.totalUsdc,
                        });
                      }}
                      className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
                    />
                    <span className="font-mono">USDC</span>
                  </span>
                </label>
                <div className="mt-4">
                  <p className="text-xs text-muted">협상 시작 금액</p>
                  <Money usdc={initialOfferForMax(numericDraftValue(draft.maxPerDealUsdc))} size="lg" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startNegotiation}
                disabled={
                  busy ||
                  !draft.productName.trim() ||
                  !draft.category.trim() ||
                  !draft.workBrief.trim() ||
                  !draft.deadline ||
                  draft.moodTags.length === 0 ||
                  deliverablesFromDraft(draft.deliverables).length === 0 ||
                  normalizedUsdc(numericDraftValue(draft.maxPerDealUsdc), 0) < 1 ||
                  normalizedUsdc(numericDraftValue(draft.totalUsdc), 0) < normalizedUsdc(numericDraftValue(draft.maxPerDealUsdc), 1)
                }
                className="sketch-pill bg-accent px-6 py-3 text-background disabled:opacity-50"
              >
                협상 시작
              </button>
              <button
                type="button"
                onClick={() => setStep("url")}
                className="sketch-pill ink border border-border-subtle bg-surface px-5 py-3 text-sm"
              >
                URL 다시 입력
              </button>
            </div>
            {error ? <p className="text-sm text-negative">{error}</p> : null}
          </motion.div>
        ) : null}

        {step === "running" ? (
          <div className="flex items-center gap-3 py-12 text-muted">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="inline-block h-1.5 w-1.5 rounded-full bg-muted"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
            브랜드 매니저가 크리에이터 매니저와 협상 중입니다.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function normalizeSourceUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function uniqueRequestKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function draftFromAnalysis(analysis: AnalysisJob): MoodDraft {
  const draft = analysis.draft;
  const product = asRecord(draft.product);
  const keywords = fieldArray(product.keywords);
  return {
    analysisId: analysis.analysisId,
    productUrl: analysis.sourceUrl,
    productName: stringField(product.name) || "",
    priceKrw: priceField(product.price),
    summary: stringField(product.summary) || "",
    category: stringField(product.category) || "",
    moodTags: keywords.filter((item) => RECOMMENDED_MOODS.includes(item)).slice(0, 3),
    totalUsdc: "",
    maxPerDealUsdc: "",
    deadline: deadlineAfterDays(14),
    workBrief: "",
    deliverables: { reel: 0, short: 0, post: 0 },
    prohibitedClaims: "",
    usageRights: "organicOnly",
    provider: analysis.provider,
    fallbackReason: analysis.fallbackReason,
  };
}

function deadlineAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function initialOfferForMax(maxPerDealUsdc: number) {
  const max = normalizedUsdc(maxPerDealUsdc, 1);
  if (max <= 5) return Math.max(1, Math.floor(max * 0.6));
  if (max < 50) return Math.max(1, Math.round(max * 0.5));
  return Math.min(max, Math.max(1, Math.round((max * 0.4) / 50) * 50));
}

function normalizedUsdc(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function numericDraftValue(value: NumericDraftValue) {
  return value === "" ? Number.NaN : value;
}

function usdcInputValue(value: string): NumericDraftValue {
  if (!value) return "";
  return normalizedUsdc(Number(value), 0);
}

function deliverablesFromDraft(deliverables: DeliverableCounts) {
  return DELIVERABLE_CONTROLS.flatMap((control) => {
    const count = Math.floor(deliverables[control.key]);
    return count > 0 ? [{ format: control.key, count }] : [];
  });
}

function deliverableSummary(deliverables: DeliverableCounts) {
  const parts = DELIVERABLE_CONTROLS.flatMap((control) => {
    const count = Math.floor(deliverables[control.key]);
    return count > 0 ? [`${control.label} ${count}개`] : [];
  });
  return parts.length ? parts.join(", ") : "최소 1개 작업을 입력하세요.";
}

function readableError(caught: unknown) {
  if (caught instanceof ProductApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return String(caught);
}

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: unknown): string | null {
  const record = asRecord(value);
  const fieldValue = record.value;
  return typeof fieldValue === "string" && fieldValue.trim() ? fieldValue : null;
}

function priceField(value: unknown): number | null {
  const record = asRecord(value);
  const fieldValue = record.value;
  if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) return fieldValue;
  if (typeof fieldValue !== "string") return null;
  const numeric = Number(fieldValue.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function fieldArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const fieldValue = record.value;
    return typeof fieldValue === "string" && fieldValue.trim() ? [fieldValue] : [];
  });
}
