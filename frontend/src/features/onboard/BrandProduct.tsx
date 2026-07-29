"use client";

/** Brand onboarding — 제품 링크 하나로 Brand Agent profile을 완성한다. */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { ProductApiClient, type BrandSourceAnalysisDraft } from "@/product/apiClient";

const DRAFT_KEY = "knot.draft.product";

type ProductDraft = {
  brandName: string;
  productName: string;
  productUrl: string;
  priceKrw: number | null;
  summary: string;
  category: string;
};

export function BrandProduct() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [url, setUrl] = useState("https://glowbar.example.com/spf-daily");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState<ProductDraft | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const extract = async () => {
    setBusy(true);
    setError(null);
    try {
      const draft = await new ProductApiClient().analyzeBrandSource({ productUrl: url });
      const product = toProductDraft(draft, url);
      setFound(product);
      setName(product.productName);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const enableAgent = async () => {
    if (!found) return;
    setSaving(true);
    setError(null);
    const productName = name.trim() || found.productName;
    try {
      await new ProductApiClient().createMyBrandProfile(
        {
          brandName: found.brandName || productName,
          websiteUrl: url,
          categories: [found.category || "lifestyle"],
          targetAudience: "Instagram Reels에 반응하는 잠재 고객",
          description: [
            found.summary,
            `제품명: ${productName}`,
            "Agent 생성과 정책 연결은 완료하지만 협상은 별도 에이전트 실행에서 시작합니다.",
          ].join("\n"),
          restrictedClaims: [],
        },
        idempotencyKey("brand-profile"),
      );
      window.sessionStorage.removeItem(DRAFT_KEY);
      await refresh();
      router.push("/brand/agent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">Brand onboarding</p>
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
          disabled={busy}
          className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
        >
          {busy ? "읽는 중…" : "읽어오기"}
        </button>
      </div>

      {error ? (
        <div className="sketch-alt ink border border-caution/50 bg-caution/10 p-4 text-sm text-muted">
          {error}
        </div>
      ) : null}

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
                {found.priceKrw ? `${found.priceKrw.toLocaleString()}원` : "직접 확인"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">카테고리</div>
              <div className="font-mono text-lg">{found.category}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">{found.summary}</p>
          <p className="mt-3 text-xs text-muted">
            API가 출처와 신뢰도를 붙인 초안입니다. 제품명은 저장 전에 직접 고칠 수 있어요.
          </p>
          <button
            type="button"
            onClick={enableAgent}
            disabled={saving}
            className="sketch-pill mt-5 bg-accent px-5 py-2.5 text-background disabled:opacity-50"
          >
            {saving ? "에이전트 켜는 중..." : "에이전트 켜기"}
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

function idempotencyKey(action: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `frontend-${action}-${crypto.randomUUID()}`;
  }
  return `frontend-${action}-${Date.now()}`;
}

function toProductDraft(draft: BrandSourceAnalysisDraft, productUrl: string): ProductDraft {
  return {
    brandName: draft.brand.name.value,
    productName: draft.product.name.value,
    productUrl,
    priceKrw: null,
    summary: draft.product.summary.value,
    category: draft.product.category.value,
  };
}
