"use client";

/**
 * 브랜드 관리 — 스캔이 만든 프로필을 사람이 직접 다듬는 곳.
 * 여기서 고치는 값이 store의 brand 그 자체라서, 이후 캠페인 대사·브리프·협상 문구에 바로 반영된다.
 */

import { useState } from "react";
import type { BrandProfile } from "@/demo/engine/types";
import { useDemo, mutate, startScan } from "@/demo/engine/store";
import { Button, SectionLabel } from "@/demo/ui/primitives";
import { withBase } from "@/demo/ui/asset";

function editBrand(fn: (b: BrandProfile) => void) {
  mutate((d) => {
    if (d.brand) fn(d.brand);
  });
}

const inputCls =
  "w-full rounded-lg border border-transparent bg-transparent px-2 py-1 transition-colors hover:border-[var(--k-line)] focus:border-[var(--k-ink)] focus:bg-white focus:outline-none";

/* --------------------------------- 헤더 --------------------------------- */

function Header({ b }: { b: BrandProfile }) {
  const [rescanUrl, setRescanUrl] = useState(b.url);
  const rescan = () => startScan(rescanUrl.trim() || b.url);
  return (
    <div className="k-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase(b.logo)}
          alt=""
          width={44}
          height={44}
          className="rounded-xl border border-[var(--k-line)] bg-white object-contain"
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <input
              value={b.name}
              onChange={(e) => editBrand((br) => (br.name = e.target.value))}
              className={`${inputCls} -mx-2 w-auto min-w-0 text-[19px] font-black tracking-tight`}
              aria-label="브랜드 이름"
            />
          </div>
          <div className="truncate text-[12.5px] text-[var(--k-muted)]">
            {b.tagline} · <span className="k-mono">{b.url}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={rescanUrl}
          onChange={(e) => setRescanUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") rescan();
          }}
          placeholder={b.url}
          className="k-mono h-9 w-[190px] rounded-lg border border-[var(--k-line-strong)] bg-white px-3 text-[12.5px] focus:border-[var(--k-ink)] focus:outline-none"
        />
        <Button variant="outline" size="sm" onClick={rescan}>
          🔍 다시 스캔
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------- 회사 소개 -------------------------------- */

function IntroCard({ b }: { b: BrandProfile }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <div className="k-card px-5 py-4">
      <div className="flex items-center justify-between">
        <SectionLabel>회사 소개</SectionLabel>
        {!editing && (
          <button
            onClick={() => {
              setDraft(b.intro);
              setEditing(true);
            }}
            className="text-[12px] font-bold text-[var(--k-ink-soft)] underline-offset-2 hover:underline"
          >
            수정
          </button>
        )}
      </div>
      {editing ? (
        <div className="mt-2.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            autoFocus
            className="w-full rounded-xl border border-[var(--k-line-strong)] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed focus:border-[var(--k-ink)] focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                editBrand((br) => (br.intro = draft.trim()));
                setEditing(false);
              }}
            >
              저장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => {
            setDraft(b.intro);
            setEditing(true);
          }}
          className="mt-2.5 cursor-text rounded-xl px-1 py-0.5 text-[13.5px] leading-relaxed text-[var(--k-ink-soft)] transition-colors hover:bg-black/[0.03]"
        >
          {b.intro || "회사 소개가 아직 없어요 — 클릭해서 직접 적어주세요."}
        </p>
      )}
    </div>
  );
}

/* --------------------------------- 제품 --------------------------------- */

function ProductGrid({ b }: { b: BrandProfile }) {
  return (
    <div className="k-card px-5 py-4">
      <div className="flex items-center justify-between">
        <SectionLabel>제품</SectionLabel>
        {b.products.length < 8 && (
          <button
            onClick={() => editBrand((br) => br.products.push({ name: "새 제품", desc: "" }))}
            className="text-[12px] font-bold text-[var(--k-ink-soft)] underline-offset-2 hover:underline"
          >
            + 제품 추가
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {b.products.map((p, i) => (
          <div key={i} className="group relative rounded-xl border border-[var(--k-line)] bg-white">
            <div className="relative h-28 overflow-hidden rounded-t-xl">
              {/* 플레이스홀더 스와치 — 이미지가 있으면 그 위를 덮는다 */}
              <div
                className="flex h-full items-center justify-center text-[26px] font-black text-white/90"
                style={{ background: b.color }}
              >
                {p.name.slice(0, 1) || "•"}
              </div>
              {b.images[i] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.images[i]}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>
            <div className="px-3 py-2.5">
              <input
                value={p.name}
                onChange={(e) => editBrand((br) => (br.products[i].name = e.target.value))}
                className={`${inputCls} -mx-2 text-[13.5px] font-bold`}
                aria-label="제품명"
              />
              <input
                value={p.desc}
                onChange={(e) => editBrand((br) => (br.products[i].desc = e.target.value))}
                placeholder="한 줄 설명"
                className={`${inputCls} -mx-2 mt-0.5 text-[12px] text-[var(--k-muted)]`}
                aria-label="제품 설명"
              />
            </div>
            {b.products.length > 1 && (
              <button
                onClick={() => editBrand((br) => br.products.splice(i, 1))}
                title="제품 삭제"
                className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-black/50 text-[12px] text-white group-hover:flex"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 text-[11.5px] text-[var(--k-muted)]">
        첫 번째 제품이 캠페인의 주인공이 돼요 — 에이전트가 협상 대사와 브리프에 이 이름을 그대로 써요.
      </div>
    </div>
  );
}

/* ------------------------------- 톤 & 타깃 ------------------------------- */

function ToneAudience({ b }: { b: BrandProfile }) {
  const [newTone, setNewTone] = useState("");
  const addTone = () => {
    const t = newTone.trim();
    if (!t || b.tone.includes(t)) return;
    editBrand((br) => br.tone.push(t));
    setNewTone("");
  };
  return (
    <div className="k-card px-5 py-4">
      <SectionLabel>톤 & 무드</SectionLabel>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {b.tone.map((t, i) => (
          <span
            key={t + i}
            className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--k-ink-soft)]"
          >
            {t}
            <button
              onClick={() => editBrand((br) => br.tone.splice(i, 1))}
              className="text-[var(--k-muted)] hover:text-[var(--k-ink)]"
              title="삭제"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={newTone}
          onChange={(e) => setNewTone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTone();
          }}
          placeholder="+ 형용사 추가"
          className="h-6 w-[92px] rounded-full border border-dashed border-[var(--k-line-strong)] px-2.5 text-[12px] focus:border-[var(--k-ink)] focus:outline-none"
        />
      </div>
      <div className="mt-4">
        <SectionLabel>타깃</SectionLabel>
        <input
          value={b.audience}
          onChange={(e) => editBrand((br) => (br.audience = e.target.value))}
          className={`${inputCls} -mx-2 mt-1.5 text-[13px]`}
          aria-label="타깃"
        />
      </div>
    </div>
  );
}

/* ------------------------------- 애셋 갤러리 ------------------------------- */

function AssetGallery({ b }: { b: BrandProfile }) {
  if (b.images.length === 0) {
    return (
      <div className="k-card px-5 py-4">
        <SectionLabel>애셋</SectionLabel>
        <div className="mt-2.5 rounded-xl border border-dashed border-[var(--k-line-strong)] px-4 py-6 text-center text-[12.5px] text-[var(--k-muted)]">
          사이트에서 수집한 이미지가 아직 없어요 — 다시 스캔하면 제품 사진을 모아올게요.
        </div>
      </div>
    );
  }
  return (
    <div className="k-card px-5 py-4">
      <SectionLabel>애셋 — 사이트에서 수집</SectionLabel>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {b.images.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            className="h-20 w-full rounded-lg border border-[var(--k-line)] object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- 본체 --------------------------------- */

export function BrandPage() {
  const s = useDemo();
  const b = s.brand;
  if (!b) {
    return (
      <div className="k-card px-6 py-14 text-center text-[13px] text-[var(--k-muted)]">
        아직 브랜드 프로필이 없어요 — 온보딩에서 사이트를 먼저 스캔해주세요.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[18px] font-bold tracking-tight">브랜드</div>
          <div className="text-[12.5px] text-[var(--k-muted)]">
            여기서 고친 내용은 {b.agentName}의 캠페인 대사·협상·브리프에 바로 반영돼요
          </div>
        </div>
      </div>
      <Header b={b} />
      <IntroCard b={b} />
      <ProductGrid b={b} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ToneAudience b={b} />
        <AssetGallery b={b} />
      </div>
    </div>
  );
}
