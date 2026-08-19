"use client";

/** `/creator/connect` — 인스타 사용자이름 하나 (docs/24 §3-1). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { analysisSourceLabel } from "@/features/onboard/analysisSourceLabel";
import { type CreatorSetup } from "@/product/setupStore";
import { readBoard, writeBoard } from "@/product/dealBoard";
import { ProductApiClient, type AnalysisJob } from "@/product/apiClient";

type CreatorDraft = Omit<CreatorSetup, "minUsdc" | "blocked"> & {
  analysisId: string;
  sourceUrl: string;
  provider: string;
  fallbackReason: string | null;
  summary: string;
  publicSignals: CreatorPublicSignals;
};

type CreatorPublicSignals = {
  fetchStatus: string;
  sourceTitle: string | null;
  sourceDescription: string | null;
  profileCounts: Record<string, number>;
  contentHints: string[];
  recentPostUrls: string[];
  analysisNotes: string[];
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
      const analysis = await new ProductApiClient().analyzeCreatorProfile(sourceUrl);
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
            {creatorStats(found).map((stat) => (
              <Stat key={stat.label} label={stat.label} value={stat.value} />
            ))}
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

          <div className="sketch-alt ink mt-4 border border-border-subtle bg-surface-raised p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg">공개 프로필 신호</p>
              <span className="font-mono text-[10px] uppercase text-muted">
                {found.publicSignals.fetchStatus}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{dedupeProfileSummary(found)}</p>
            {found.publicSignals.contentHints.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {found.publicSignals.contentHints.map((hint) => (
                  <span
                    key={hint}
                    className="sketch-pill ink border border-border-subtle bg-surface px-2.5 py-0.5 text-xs"
                  >
                    {hint}
                  </span>
                ))}
              </div>
            ) : null}
            {found.publicSignals.recentPostUrls.length ? (
              <div className="mt-3 grid gap-1.5">
                {found.publicSignals.recentPostUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate font-mono text-xs text-muted underline decoration-border-subtle underline-offset-4"
                  >
                    게시글 {index + 1} · {url}
                  </a>
                ))}
              </div>
            ) : null}
            {found.publicSignals.analysisNotes.length ? (
              <div className="mt-3 grid gap-1 text-xs text-muted">
                {found.publicSignals.analysisNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}
          </div>

          <p className="mt-4 text-xs text-muted">
            {analysisSourceLabel(found.provider, found.fallbackReason)}
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
    followers: numberField(draft.followerCount) ?? 0,
    avgViews: numberField(draft.averageViews) ?? 0,
    engagementRate: ratioField(draft.engagementRate) ?? 0,
    reelShare: numberField(draft.reelShare) ?? 0,
    toneKeywords: stringArray(draft.audienceTags).concat(stringArray(draft.proposedMoodIds)).slice(0, 3),
    capturedAt: new Date().toISOString().slice(0, 10),
    provider: analysis.provider,
    fallbackReason: analysis.fallbackReason,
    summary: typeof draft.summary === "string" && draft.summary.trim() ? draft.summary : "공개 프로필 분석 결과를 확인해주세요.",
    publicSignals: publicSignalsFromDraft(draft.publicSignals),
  };
}

function instagramUrlFromHandle(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  if (trimmed.includes(".")) return `https://${trimmed.replace(/^\/+/, "")}`;
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

function numberField(value: unknown): number | null {
  const record = asRecord(value);
  const fieldValue = record.value;
  if (typeof fieldValue === "number" && Number.isFinite(fieldValue) && fieldValue > 0) {
    return fieldValue;
  }
  if (typeof fieldValue !== "string") return null;
  const numeric = Number(fieldValue.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function ratioField(value: unknown): number | null {
  const numeric = numberField(value);
  if (numeric === null) return null;
  return numeric > 1 ? numeric / 100 : numeric;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function publicSignalsFromDraft(value: unknown): CreatorPublicSignals {
  const record = asRecord(value);
  return {
    fetchStatus: typeof record.fetchStatus === "string" ? record.fetchStatus : "LIMITED",
    sourceTitle: nullableString(record.sourceTitle),
    sourceDescription: nullableString(record.sourceDescription),
    profileCounts: numberMap(record.profileCounts),
    contentHints: stringArray(record.contentHints).slice(0, 8),
    recentPostUrls: stringArray(record.recentPostUrls).slice(0, 6),
    analysisNotes: stringArray(record.analysisNotes).slice(0, 4),
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberMap(value: unknown): Record<string, number> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, item]) =>
      typeof item === "number" && Number.isFinite(item) && item >= 0 ? [[key, item]] : [],
    ),
  );
}

function creatorStats(found: CreatorDraft) {
  const counts = found.publicSignals.profileCounts;
  const limited = found.publicSignals.fetchStatus === "LIMITED";
  if (limited && !Object.keys(counts).length) {
    return [
      { label: "사용자이름", value: found.handle },
      { label: "공개 지표", value: "확인 필요" },
    ];
  }
  const stats = [
    ["팔로워", counts.followerCount ?? found.followers],
    ["팔로잉", counts.followingCount],
    ["게시물", counts.postCount],
    ["공개 릴스 링크", counts.publicReelLinkCount],
    ["공개 게시글 링크", counts.publicPostLinkCount],
  ] as const;
  return stats.flatMap(([label, value]) =>
    typeof value === "number" && value >= 0 ? [{ label, value: value.toLocaleString() }] : [],
  ).slice(0, 4);
}

function dedupeProfileSummary(found: CreatorDraft) {
  const description = found.publicSignals.sourceDescription;
  if (description && description.trim()) return description;
  return found.summary;
}
