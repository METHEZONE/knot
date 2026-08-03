"use client";

/** `/creator/connect` — 인스타 사용자이름 하나 (docs/24 §3-1). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { type CreatorSetup } from "@/product/setupStore";
import { readBoard, writeBoard } from "@/product/dealBoard";
import { ProductApiClient, type AnalysisJob } from "@/product/apiClient";

type CreatorDraft = Omit<CreatorSetup, "minUsdc" | "blocked"> & {
  analysisId: string;
  sourceUrl: string;
  provider: string;
  fallbackReason: string | null;
};

export function CreatorConnect() {
  const router = useRouter();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<CreatorDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!handle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const sourceUrl = instagramUrlFromHandle(handle);
      const analysis = await new ProductApiClient().analyzeCreatorProfile(
        sourceUrl,
        stableKey("creator-profile-analysis", sourceUrl),
      );
      setFound(creatorDraftFromAnalysis(analysis));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!found) return;
    const setup: CreatorSetup = {
      ...found,
      minUsdc: 150,
      blocked: ["gambling", "loanCrypto", "dietSupplement"],
    };
    writeBoard({ creator: setup, evidenceUrl: null, epoch: readBoard().epoch + 1 });
    router.push("/creator/rules");
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-wide text-muted">1 / 2</p>
        <h1 className="mt-1 text-4xl">인스타그램만 연결하면 돼요</h1>
        <p className="mt-2 text-muted">
          사용자이름만 알려주세요. 나머지는 매니저가 알아서 봅니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@myhandle"
          className="sketch-alt ink flex-1 border border-border-subtle bg-surface-raised px-4 py-3 text-lg outline-none"
        />
        <button
          type="button"
          onClick={analyze}
          disabled={busy || !handle.trim()}
          className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
        >
          {busy ? "보는 중…" : "분석"}
        </button>
      </div>
      {error ? <p className="text-sm text-negative">{error}</p> : null}

      {found ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="sketch ink border border-border-subtle bg-surface p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl">{found.handle}</h2>
            <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-1 font-mono text-[10px]">
              {found.capturedAt} 수집
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="팔로워" value={unknownableNumber(found.followers)} />
            <Stat label="평균 조회" value={unknownableNumber(found.avgViews)} />
            <Stat label="참여율" value={found.engagementRate ? `${(found.engagementRate * 100).toFixed(1)}%` : "확인 필요"} />
            <Stat label="릴스 비중" value={found.reelShare ? `${found.reelShare}%` : "확인 필요"} />
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {found.toneKeywords.map((k) => (
              <span
                key={k}
                className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-0.5 text-sm"
              >
                {k}
              </span>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted">
            {found.provider}
            {found.fallbackReason ? ` · ${found.fallbackReason}` : ""}
          </p>

          <button
            type="button"
            onClick={next}
            className="sketch-pill mt-5 bg-accent px-5 py-2.5 text-background"
          >
            맞아요, 계속
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-xl">{value}</div>
    </div>
  );
}

function creatorDraftFromAnalysis(analysis: AnalysisJob): CreatorDraft {
  const draft = analysis.draft;
  const handle = stringField(draft.handle) || handleFromUrl(analysis.sourceUrl);
  return {
    analysisId: analysis.analysisId,
    sourceUrl: analysis.sourceUrl,
    handle,
    followers: 0,
    avgViews: 0,
    engagementRate: 0,
    reelShare: 0,
    toneKeywords: stringArray(draft.audienceTags).concat(stringArray(draft.proposedMoodIds)).slice(0, 3),
    capturedAt: new Date().toISOString().slice(0, 10),
    provider: analysis.provider,
    fallbackReason: analysis.fallbackReason,
  };
}

function instagramUrlFromHandle(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("https://")) return trimmed;
  const clean = trimmed.replace(/^@/, "").replace(/^\/+/, "");
  return `https://instagram.com/${clean}`;
}

function handleFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const handle = url.pathname.split("/").filter(Boolean)[0] || "creator";
    return handle.startsWith("@") ? handle : `@${handle}`;
  } catch {
    return "@creator";
  }
}

function stringField(value: unknown): string | null {
  const record = asRecord(value);
  const fieldValue = record.value;
  return typeof fieldValue === "string" && fieldValue.trim() ? fieldValue : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function unknownableNumber(value: number) {
  return value > 0 ? value.toLocaleString() : "확인 필요";
}

function stableKey(prefix: string, ...parts: string[]) {
  let hash = 0x811c9dc5;
  for (const part of parts.join("|")) {
    hash ^= part.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}
