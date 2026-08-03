"use client";

/** `/creator/rules` — 두 개만 정한다 (docs/24 §3-2). */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthProvider";
import { readBoard, useBoard, writeBoard } from "@/product/dealBoard";
import { ProductApiClient } from "@/product/apiClient";
import {
  BLOCKED_CATEGORY_LABEL,
  suggestedMinUsdc,
  type BlockedCategory,
} from "@/product/setupStore";

const ALL: BlockedCategory[] = [
  "gambling",
  "loanCrypto",
  "dietSupplement",
  "medicalProcedure",
  "alcohol",
  "adult",
];

export function CreatorRules() {
  const router = useRouter();
  const { board, ready } = useBoard();
  const creator = board.creator;

  // 보드에서 온 값은 폼의 초기값일 뿐이다. effect로 세우면 렌더가 연쇄되므로
  // 값이 도착한 시점을 key로 삼아 폼을 새로 만든다(아래 CreatorRulesForm).
  useEffect(() => {
    if (ready && !creator) router.replace("/creator/connect");
  }, [ready, creator, router]);

  if (!ready || !creator) {
    return <div className="py-24 text-center text-muted">불러오는 중…</div>;
  }

  return <CreatorRulesForm key={creator.handle} creator={creator} router={router} />;
}

function CreatorRulesForm({
  creator,
  router,
}: {
  creator: NonNullable<ReturnType<typeof useBoard>["board"]["creator"]>;
  router: ReturnType<typeof useRouter>;
}) {
  const { refresh } = useAuth();
  const [min, setMin] = useState(
    creator.minUsdc || suggestedMinUsdc(creator.followers, creator.engagementRate),
  );
  const [blocked, setBlocked] = useState<BlockedCategory[]>(creator.blocked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (c: BlockedCategory) =>
    setBlocked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const done = async () => {
    const nextCreator = { ...creator, minUsdc: min, blocked };
    setSaving(true);
    setError(null);
    try {
      const client = new ProductApiClient();
      const creatorWithAnalysis = creator as unknown as { analysisId?: unknown };
      const analysisId =
        typeof creatorWithAnalysis.analysisId === "string"
          ? creatorWithAnalysis.analysisId
          : null;
      if (analysisId) {
        await client.confirmAnalysis(
          analysisId,
          {
            confirmedFields: ["handle", "categoryKeys", "formatKeys"],
            edits: {
              minimumUsdc: min,
              blockedDomains: blocked.map((item) => BLOCKED_CATEGORY_LABEL[item]),
            },
          },
          stableKey("creator-analysis-confirm", analysisId, creator.handle),
        );
      }
      await client.createMyCreatorProfile(
        {
          creatorName: creator.handle,
          snsUrl: `https://instagram.com/${creator.handle.replace(/^@/, "")}`,
          categories: ["beauty"],
          customCategory: creator.toneKeywords.join(", "),
          preferredContent: ["reel", "short", "post"],
          blockedDomains: blocked.map((item) => BLOCKED_CATEGORY_LABEL[item]),
          minimumUsdc: min,
        },
        stableKey("creator-profile", creator.handle, String(min), blocked.join(",")),
      );
      await client.publishCreatorAgent();
      writeBoard({
        creator: nextCreator,
        evidenceUrl: null,
        epoch: readBoard().epoch + 1,
      });
      await refresh();
      router.replace("/creator");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-7 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">2 / 2</p>
        <h1 className="mt-1 text-4xl">두 개만 정하면 끝이에요</h1>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">마지노선</h2>
        <div className="flex items-baseline gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={min}
            onChange={(e) => setMin(Math.max(0, Number(e.target.value)))}
            className="sketch-alt ink w-40 border border-border-subtle bg-surface-raised px-4 py-3 font-mono text-2xl outline-none"
          />
          <span className="font-mono text-muted">USDC</span>
        </div>
        <p className="text-sm text-muted">
          이 밑으로 들어오는 제안은 매니저가 알아서 거절해요.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl">안 하는 카테고리</h2>
        <div className="flex flex-wrap gap-2">
          {ALL.map((c) => {
            const on = blocked.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggle(c)}
                className={`sketch-pill border-2 px-3.5 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-border-subtle bg-accent text-background"
                    : "border-border-subtle bg-surface text-muted"
                }`}
              >
                {BLOCKED_CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-muted">돈은 협상해도, 이건 협상하지 않아요.</p>
      </section>

      <button
        type="button"
        onClick={done}
        disabled={saving}
        className="sketch-pill self-start bg-accent px-6 py-3 text-lg text-background disabled:opacity-50"
      >
        {saving ? "저장 중…" : "매니저 붙이기"}
      </button>
      {error ? <p className="text-sm text-negative">{error}</p> : null}
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
