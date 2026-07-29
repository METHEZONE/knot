"use client";

/** `/creator/connect` — 인스타 사용자이름 하나 (docs/24 §3-1). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { BlockedCategory } from "@/product/setupStore";

type CreatorDraft = {
  handle: string;
  snsUrl: string;
  creatorName: string;
  minUsdc: number;
  blocked: BlockedCategory[];
};

const DRAFT_KEY = "knot.draft.creator";
type CreatorPreview = Omit<CreatorDraft, "minUsdc" | "blocked">;

export function CreatorConnect() {
  const router = useRouter();
  const [handle, setHandle] = useState("@mina.studio");
  const [creatorName, setCreatorName] = useState("Mina Studio");
  const [found, setFound] = useState<CreatorPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = () => {
    setError(null);
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) {
      setError("Instagram 사용자이름을 입력해주세요.");
      return;
    }
    setFound({
      handle: `@${clean}`,
      snsUrl: `https://instagram.com/${clean}`,
      creatorName: creatorName.trim() || clean,
    });
  };

  const next = () => {
    if (!found) return;
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...found, minUsdc: 300, blocked: ["gambling", "loanCrypto", "dietSupplement"] }),
    );
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
          className="sketch-pill bg-accent px-5 py-3 text-background"
        >
          확인
        </button>
      </div>
      <input
        value={creatorName}
        onChange={(e) => setCreatorName(e.target.value)}
        placeholder="Creator display name"
        className="sketch-alt ink border border-border-subtle bg-surface-raised px-4 py-3 text-lg outline-none"
      />

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
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl">{found.handle}</h2>
            <span className="sketch-pill ink border border-border-subtle bg-surface-raised px-2.5 py-1 font-mono text-[10px]">
              URL 확인
            </span>
          </div>

          <p className="mt-4 text-sm text-muted">{found.creatorName}</p>
          <p className="mt-2 font-mono text-sm text-muted">{found.snsUrl}</p>
          <p className="mt-4 text-xs text-muted">팔로워·조회수·참여율은 실제 수집 연동 전까지 표시하지 않습니다.</p>

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
