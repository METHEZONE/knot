"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AgentCharacter } from "@/components/AgentCharacter";
import { Money } from "@/features/chat/Money";
import { ProductApiClient, ProductApiError } from "@/product/apiClient";
import { extractProduct } from "@/product/setupStore";

type WizardStep = "url" | "review" | "running";

type MoodDraft = {
  productUrl: string;
  productName: string;
  priceKrw: number;
  summary: string;
  category: string;
  moodTags: string[];
  totalUsdc: number;
  maxPerDealUsdc: number;
};

const RECOMMENDED_MOODS = ["설명형", "루틴", "클로즈업", "정보", "신뢰", "솔직함"];

export function BrandPromotionWizard() {
  const router = useRouter();
  const client = useMemo(() => new ProductApiClient(), []);
  const [step, setStep] = useState<WizardStep>("url");
  const [productUrl, setProductUrl] = useState("https://demo-skincare.example.com/spf-daily");
  const [draft, setDraft] = useState<MoodDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function extractMood() {
    setBusy(true);
    setError(null);
    window.setTimeout(() => {
      const product = extractProduct(productUrl);
      setDraft({
        ...product,
        productUrl,
        moodTags: product.category === "wellness" ? ["집중", "루틴", "설명형"] : ["설명형", "루틴", "클로즈업"],
        totalUsdc: 2000,
        maxPerDealUsdc: 800,
      });
      setStep("review");
      setBusy(false);
    }, 800);
  }

  async function startNegotiation() {
    if (!draft) return;
    setStep("running");
    setBusy(true);
    setError(null);
    try {
      const initialOffer = Math.max(50, Math.round((draft.maxPerDealUsdc * 0.75) / 50) * 50);
      const promotion = await client.createBrandPromotion(
        {
          productName: draft.productName,
          title: `${draft.productName} 협찬 프로젝트`,
          objective: draft.summary || "제품 인지도와 실제 사용 콘텐츠 확보",
          categories: [draft.category || "beauty"],
          targetAudience: draft.moodTags.join(", "),
          totalBudget: draft.totalUsdc,
          initialOffer,
          maximumPerCreator: draft.maxPerDealUsdc,
          autoAcceptCeiling: draft.maxPerDealUsdc,
          maximumRounds: 3,
          deliverables: [{ format: "reel", count: 1 }],
          usageRights: "organicOnly",
          deadline: deadlineAfterDays(14),
          prohibitedClaims: ["의료 효능 과장", "무검수 게시"],
        },
        stableKey("promotion", draft.productUrl, draft.productName, draft.moodTags.join(",")),
      );
      const flow = await client.runAgentForPromotion(promotion.promotionId);
      router.push(`/brand/negotiations/${flow.negotiation.negotiationId}`);
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
            제품 URL에서 무드를 추출하고, 사람이 검토한 뒤 Brand Agent가 바로 협상을 시작합니다.
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
                placeholder="https://..."
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
                <p className="mt-3 text-sm text-muted">{draft.summary}</p>
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
                <label className="block text-sm text-muted">
                  총 예산
                  <span className="mt-2 flex items-baseline gap-2">
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={draft.totalUsdc}
                      onChange={(event) => setDraft({ ...draft, totalUsdc: Math.max(0, Number(event.target.value)) })}
                      className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
                    />
                    <span className="font-mono">USDC</span>
                  </span>
                </label>
                <label className="mt-4 block text-sm text-muted">
                  딜당 한도
                  <span className="mt-2 flex items-baseline gap-2">
                    <input
                      type="number"
                      min={50}
                      step={50}
                      value={draft.maxPerDealUsdc}
                      onChange={(event) => setDraft({ ...draft, maxPerDealUsdc: Math.max(0, Number(event.target.value)) })}
                      className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
                    />
                    <span className="font-mono">USDC</span>
                  </span>
                </label>
                <div className="mt-4">
                  <p className="text-xs text-muted">협상 시작 금액</p>
                  <Money usdc={Math.max(50, Math.round((draft.maxPerDealUsdc * 0.75) / 50) * 50)} size="lg" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startNegotiation}
                disabled={busy || !draft.productName.trim() || draft.moodTags.length === 0}
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
            Brand Agent가 Creator Agent와 협상 중입니다.
          </div>
        ) : null}
      </section>
    </div>
  );
}

function stableKey(prefix: string, ...parts: string[]) {
  let hash = 0x811c9dc5;
  for (const part of parts.join("|")) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

function deadlineAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function readableError(caught: unknown) {
  if (caught instanceof ProductApiError) return caught.message;
  if (caught instanceof Error) return caught.message;
  return String(caught);
}
