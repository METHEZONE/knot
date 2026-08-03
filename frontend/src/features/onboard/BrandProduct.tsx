"use client";

/** `/brand/product` — 링크 하나 (docs/24 §4-1). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { analysisSourceLabel } from "@/features/onboard/analysisSourceLabel";
import { ProductApiClient, type AnalysisJob } from "@/product/apiClient";

const DRAFT_KEY = "knot.draft.product";

type ProductDraft = {
  analysisId: string;
  productUrl: string;
  productName: string;
  priceKrw: number | null;
  category: string;
  summary: string;
  provider: string;
  fallbackReason: string | null;
};

export function BrandProduct() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<ProductDraft | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const normalizedUrl = normalizeSourceUrl(url);
      const analysis = await new ProductApiClient().analyzeProduct(normalizedUrl);
      const draft = productDraftFromAnalysis(analysis);
      setFound(draft);
      setName(draft.productName);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!found) return;
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...found, productName: name, productUrl: normalizeSourceUrl(url) }),
    );
    router.push("/brand/mood");
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">1 / 2</p>
        <h1 className="mt-1 text-4xl">제품 링크만 주세요</h1>
        <p className="mt-2 text-muted">붙여넣으면 나머지는 매니저가 읽어옵니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="sketch-alt ink flex-1 border border-border-subtle bg-surface-raised px-4 py-3 outline-none"
        />
        <button
          type="button"
          onClick={extract}
          disabled={busy || !url.trim()}
          className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
        >
          {busy ? "읽는 중…" : "읽어오기"}
        </button>
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}

      {found ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sketch ink border border-border-subtle bg-surface p-5"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">제품명</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sketch-alt ink border border-border-subtle bg-surface-raised px-3 py-2 text-lg outline-none"
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted">가격</div>
              <div className="font-mono text-lg">
                {found.priceKrw === null ? "확인 필요" : `${found.priceKrw.toLocaleString()}원`}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">카테고리</div>
              <div className="font-mono text-lg">{found.category}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">{found.summary}</p>
          <p className="mt-3 text-xs text-muted">
            {analysisSourceLabel(found.provider, found.fallbackReason)}
          </p>
          <button
            type="button"
            onClick={next}
            className="sketch-pill mt-5 bg-accent px-5 py-2.5 text-background"
          >
            무드 고르러 가기
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

function productDraftFromAnalysis(analysis: AnalysisJob): ProductDraft {
  const draft = analysis.draft;
  const product = asRecord(draft.product);
  return {
    analysisId: analysis.analysisId,
    productUrl: analysis.sourceUrl,
    productName: stringField(product.name) || "제품명 확인 필요",
    priceKrw: priceField(product.price),
    category: stringField(product.category) || "category-required",
    summary: stringField(product.summary) || "요약 확인 필요",
    provider: analysis.provider,
    fallbackReason: analysis.fallbackReason,
  };
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

function normalizeSourceUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  return `https://${trimmed.replace(/^\/+/, "")}`;
}
