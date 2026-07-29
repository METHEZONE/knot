"use client";

/**
 * `/brand/mood` — 릴스 10개 스와이프로 무드를 정하고, 마지막 카드에서 한도를
 * 잡는다 (docs/24 §4-2).
 *
 * 스와이프는 재미 요소가 아니라 이 데모에서 브랜드가 넣는 진짜 입력이다.
 * 좋아요한 카드의 태그가 매니저의 탐색 기준이 되고, 그래서 사람이 크리에이터를
 * 직접 고르지 않아도 된다.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthProvider";
import { ProductApiClient } from "@/product/apiClient";

const DRAFT_KEY = "knot.draft.product";

type Reel = { id: string; title: string; tags: string[] };

/** 샘플 릴스 10개. 태그가 무드 프로필의 재료다. */
const REELS: Reel[] = [
  { id: "r1", title: "잠자기 전 루틴", tags: ["차분함", "루틴", "설명형"] },
  { id: "r2", title: "성분 3개만 짚기", tags: ["설명형", "정보", "클로즈업"] },
  { id: "r3", title: "아침 5분 세안", tags: ["루틴", "빠른편집", "아침"] },
  { id: "r4", title: "화장대 브이로그", tags: ["브이로그", "일상", "느린편집"] },
  { id: "r5", title: "before / after", tags: ["비교", "임팩트", "클로즈업"] },
  { id: "r6", title: "친구한테 추천하듯", tags: ["대화체", "친근함", "핸드헬드"] },
  { id: "r7", title: "텍스트 자막 위주", tags: ["자막중심", "정보", "빠른편집"] },
  { id: "r8", title: "무드 있는 B롤", tags: ["감성", "느린편집", "무드"] },
  { id: "r9", title: "성분표 뜯어보기", tags: ["정보", "신뢰", "설명형"] },
  { id: "r10", title: "하루 종일 써보기", tags: ["리뷰", "일상", "솔직함"] },
];

export function BrandMood() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [total, setTotal] = useState(2000);
  const [perDeal, setPerDeal] = useState(800);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 드래프트는 마운트 시점에 한 번 읽으면 되는 값이라 lazy initial state로 둔다 —
  // effect에서 setState하면 렌더가 연쇄된다.
  const [draft] = useState<Record<string, unknown> | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  });

  useEffect(() => {
    if (!draft) router.replace("/brand/product");
  }, [draft, router]);

  // 좋아요한 릴스의 태그를 많이 나온 순으로 모은다.
  const moodTags = (() => {
    const count = new Map<string, number>();
    for (const id of liked) {
      const reel = REELS.find((r) => r.id === id);
      reel?.tags.forEach((t) => count.set(t, (count.get(t) ?? 0) + 1));
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
  })();

  const swipe = (like: boolean) => {
    if (like) setLiked((prev) => [...prev, REELS[index].id]);
    setIndex((i) => i + 1);
  };

  // 키보드로도 넘길 수 있게.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (index >= REELS.length) return;
      if (e.key === "ArrowRight") swipe(true);
      if (e.key === "ArrowLeft") swipe(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const setup = {
      productUrl: String(draft.productUrl ?? ""),
      productName: String(draft.productName ?? "제품"),
      priceKrw: Number(draft.priceKrw ?? 0),
      summary: String(draft.summary ?? ""),
      category: String(draft.category ?? "beauty"),
      moodTags,
      totalUsdc: total,
      maxPerDealUsdc: perDeal,
    };
    try {
      await new ProductApiClient().createMyBrandProfile(
        {
          brandName: String(draft.brandName ?? setup.productName),
          websiteUrl: setup.productUrl,
          categories: [setup.category],
          targetAudience: moodTags.length ? moodTags.join(", ") : "브랜드가 직접 확정",
          description: [
            setup.summary,
            `제품명: ${setup.productName}`,
            `총 예산: ${setup.totalUsdc} USDC`,
            `딜당 한도: ${setup.maxPerDealUsdc} USDC`,
          ].join("\n"),
          restrictedClaims: [],
        },
        idempotencyKey("brand-profile"),
      );
      window.sessionStorage.removeItem(DRAFT_KEY);
      await refresh();
      router.push("/brand");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  };

  const done = index >= REELS.length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">2 / 2</p>
        <h1 className="mt-1 text-4xl">
          {done ? "한도만 정하면 끝이에요" : "어떤 무드가 좋으세요?"}
        </h1>
        {!done ? (
          <p className="mt-2 text-muted">
            {index + 1} / {REELS.length} · ← → 키로도 넘길 수 있어요
          </p>
        ) : null}
      </div>

      {!done ? (
        <div className="relative h-[340px]">
          <AnimatePresence initial={false}>
            <motion.div
              key={REELS[index].id}
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, x: 0 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 90) swipe(true);
                else if (info.offset.x < -90) swipe(false);
              }}
              className="sketch ink absolute inset-0 flex cursor-grab flex-col items-center justify-center gap-3 border border-border-subtle bg-surface p-6 active:cursor-grabbing"
            >
              {/* 실제 영상 대신 무드를 글로 세운다 — 데모 자산이 없어도 판단은 된다 */}
              <div className="sketch-alt ink flex h-36 w-28 items-center justify-center border-2 border-border-subtle bg-surface-raised font-mono text-xs text-muted">
                REEL
              </div>
              <div className="text-2xl">{REELS[index].title}</div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {REELS[index].tags.map((t) => (
                  <span
                    key={t}
                    className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-sm"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      {!done ? (
        <div className="flex justify-center gap-4">
          <button
            type="button"
            onClick={() => swipe(false)}
            className="sketch-pill ink border-2 border-border-subtle bg-surface px-6 py-2.5 text-muted"
          >
            ✕ 아니야
          </button>
          <button
            type="button"
            onClick={() => swipe(true)}
            className="sketch-pill bg-accent px-6 py-2.5 text-background"
          >
            ♡ 이런 느낌
          </button>
        </div>
      ) : null}

      {moodTags.length > 0 ? (
        <p className="text-center text-sm text-muted">
          고른 무드: <span className="text-foreground">{moodTags.join(" · ")}</span>
        </p>
      ) : null}

      {done ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sketch ink flex flex-col gap-4 border border-border-subtle bg-surface p-5"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">총 예산</span>
            <span className="flex items-baseline gap-2">
              <input
                type="number"
                min={100}
                step={100}
                value={total}
                onChange={(e) => setTotal(Math.max(0, Number(e.target.value)))}
                className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
              />
              <span className="font-mono text-muted">USDC</span>
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">딜당 한도</span>
            <span className="flex items-baseline gap-2">
              <input
                type="number"
                min={50}
                step={50}
                value={perDeal}
                onChange={(e) => setPerDeal(Math.max(0, Number(e.target.value)))}
                className="sketch-alt ink w-36 border border-border-subtle bg-surface-raised px-3 py-2 font-mono text-xl outline-none"
              />
              <span className="font-mono text-muted">USDC</span>
            </span>
            <span className="text-sm text-muted">
              매니저가 한 건에 {perDeal.toLocaleString()} USDC까지는 물어보지 않고 씁니다.
            </span>
          </label>

          <button
            type="button"
            onClick={finish}
            disabled={saving}
            className="sketch-pill self-start bg-accent px-6 py-3 text-lg text-background disabled:opacity-50"
          >
            {saving ? "연결 중..." : "매니저 붙이기"}
          </button>
          {error ? (
            <div className="sketch-alt ink border border-caution/50 bg-caution/10 p-3 text-sm text-muted">
              {error}
            </div>
          ) : null}
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
