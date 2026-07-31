"use client";

/** `/brand/product` — 링크 하나 (docs/24 §4-1). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { extractProduct } from "@/product/setupStore";

const DRAFT_KEY = "knot.draft.product";

export function BrandProduct() {
  const router = useRouter();
  const [url, setUrl] = useState("https://demo-skincare.example.com/spf-daily");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<ReturnType<typeof extractProduct> | null>(null);
  const [name, setName] = useState("");

  const extract = () => {
    setBusy(true);
    window.setTimeout(() => {
      const p = extractProduct(url);
      setFound(p);
      setName(p.productName);
      setBusy(false);
    }, 1200);
  };

  const next = () => {
    if (!found) return;
    // 무드 화면에서 마무리하므로 여기서는 초안만 넘긴다.
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...found, productName: name, productUrl: url }),
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
          disabled={busy}
          className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
        >
          {busy ? "읽는 중…" : "읽어오기"}
        </button>
      </div>

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
              <div className="font-mono text-lg">{found.priceKrw.toLocaleString()}원</div>
            </div>
            <div>
              <div className="text-xs text-muted">카테고리</div>
              <div className="font-mono text-lg">{found.category}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">{found.summary}</p>
          <p className="mt-3 text-xs text-muted">
            안 고쳐도 그대로 넘어갈 수 있어요.
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
