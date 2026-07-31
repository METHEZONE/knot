"use client";

/** `/creator/connect` — 인스타 사용자이름 하나 (docs/24 §3-1). */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { lookupInstagram, type CreatorSetup } from "@/product/setupStore";
import { readBoard, writeBoard } from "@/product/dealBoard";
import { suggestedMinUsdc } from "@/product/setupStore";

export function CreatorConnect() {
  const router = useRouter();
  const [handle, setHandle] = useState("@demobeauty");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<ReturnType<typeof lookupInstagram> | null>(null);

  const analyze = () => {
    setBusy(true);
    // 사전 수집된 결과를 불러오는 연출. 라이브 스크래핑이 아니다.
    window.setTimeout(() => {
      setFound(lookupInstagram(handle));
      setBusy(false);
    }, 1400);
  };

  const next = () => {
    if (!found) return;
    const setup: CreatorSetup = {
      ...found,
      minUsdc: suggestedMinUsdc(found.followers, found.engagementRate),
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
          disabled={busy}
          className="sketch-pill bg-accent px-5 py-3 text-background disabled:opacity-50"
        >
          {busy ? "보는 중…" : "분석"}
        </button>
      </div>

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
            <Stat label="팔로워" value={found.followers.toLocaleString()} />
            <Stat label="평균 조회" value={found.avgViews.toLocaleString()} />
            <Stat label="참여율" value={`${(found.engagementRate * 100).toFixed(1)}%`} />
            <Stat label="릴스 비중" value={`${found.reelShare}%`} />
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
            숫자는 수집된 게시물에서 계산했고, 문장만 AI가 씁니다.
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
