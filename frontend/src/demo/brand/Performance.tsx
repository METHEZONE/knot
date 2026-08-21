"use client";

/** 성과 — 캠페인 수치를 한눈에 보고, 인쇄용 리포트(HTML→PDF)로 내보내는 뷰. */

import { motion } from "framer-motion";
import { useDemo } from "@/demo/engine/store";
import { creatorById, REPORT_SUMMARY } from "@/demo/engine/script";
import { openReport, releasedUsdc } from "@/demo/reportClient";
import { Yarn } from "@/demo/character/Yarn";
import { Stat, SectionLabel, Badge, Button, usdc } from "@/demo/ui/primitives";
import { Face } from "@/demo/ui/bits";

/** "38.2만" · "4,820" 같은 표시 문자열 → 숫자 */
function parseKNum(s: string | null | undefined): number {
  if (!s) return 0;
  const t = s.replace(/,/g, "").trim();
  const man = t.match(/^([\d.]+)\s*만/);
  if (man) return Math.round(parseFloat(man[1]) * 10_000);
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function fmtViews(n: number): string {
  if (n >= 10_000) {
    const v = (n / 10_000).toFixed(1);
    return `${v.endsWith(".0") ? v.slice(0, -2) : v}만`;
  }
  return n.toLocaleString();
}

function postHref(url: string) {
  return url.startsWith("http") ? url : `https://${url}`;
}

const STATUS_LABEL: Record<string, string> = {
  scouting: "탐색 중",
  negotiating: "협상 중",
  pending_approval: "승인 대기",
  knotting: "매듭 중",
  active: "진행 중",
  completed: "완료",
};

export function Performance() {
  const s = useDemo();
  const c = s.campaign;

  if (!c) {
    return (
      <div className="k-card flex flex-col items-center px-6 py-14 text-center">
        <Yarn color={s.brand?.color ?? "#d9a441"} mood="idle" size={84} />
        <div className="mt-3 text-[15px] font-bold">아직 성과 데이터가 없어요</div>
        <div className="mt-1 text-[13px] text-[var(--k-muted)]">
          캠페인을 시작하면 조회수·지급액·CPM 절감이 여기에 실시간으로 집계됩니다
        </div>
      </div>
    );
  }

  const deals = c.deals;
  const withMetrics = deals.filter((d) => d.metrics);
  const totalViews = withMetrics.reduce((a, d) => a + parseKNum(d.metrics!.views), 0);
  const paid = deals.reduce((a, d) => a + releasedUsdc(d), 0);
  const committed = deals.reduce((a, d) => a + d.amountUsdc + (d.bonusUsdc ?? 0), 0);
  const execPct = Math.round((committed / c.spec.budgetUsdc) * 100);
  // 완료 캠페인은 대사·리포트와 같은 대본 상수를, 진행 중엔 딜 메트릭 평균을 쓴다.
  const cpmLabel =
    c.status === "completed"
      ? REPORT_SUMMARY.cpmVsIndustry
      : withMetrics.length
        ? `${Math.round(
            withMetrics.reduce((a, d) => a + parseKNum(d.metrics!.cpmDelta), 0) / withMetrics.length,
          )}%`
        : null;
  const maxViews = Math.max(1, ...deals.map((d) => parseKNum(d.metrics?.views)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold tracking-tight">성과</span>
            <Badge tone={c.status === "completed" ? "ok" : "neutral"}>
              {STATUS_LABEL[c.status] ?? c.status}
            </Badge>
          </div>
          <div className="text-[12.5px] text-[var(--k-muted)]">
            {c.spec.goal} · {c.spec.contentType} · 예산 {usdc(c.spec.budgetUsdc)}
          </div>
        </div>
        <Button size="sm" onClick={() => openReport(s)} disabled={deals.length === 0}>
          📄 리포트 다운로드
        </Button>
      </div>

      {/* KPI */}
      <div className="flex flex-wrap gap-2.5">
        <Stat
          label="총 조회수"
          value={totalViews > 0 ? fmtViews(totalViews) : "—"}
          sub={withMetrics.length > 0 ? `게시물 ${withMetrics.length}건 집계` : "게시물 집계 전"}
        />
        <Stat label="총 지급액" value={paid.toLocaleString()} sub="릴리즈 + 보너스 (USDC)" tone="money" />
        <Stat
          label="평균 CPM 절감"
          value={cpmLabel ?? "—"}
          sub="업계 평균 CPM 대비"
        />
        <Stat
          label="예산 집행률"
          value={`${execPct}%`}
          sub={`확정 ${committed.toLocaleString()} / ${c.spec.budgetUsdc.toLocaleString()} USDC`}
        />
      </div>

      {deals.length === 0 ? (
        <div className="k-card px-6 py-10 text-center text-[13px] text-[var(--k-muted)]">
          아직 체결된 딜이 없어요 — 협상이 끝나고 매듭이 묶이면 크리에이터별 성과가 채워집니다
        </div>
      ) : (
        <>
          {/* 조회수 비교 막대 */}
          <div className="k-card px-5 py-4">
            <SectionLabel>크리에이터별 조회수 비교</SectionLabel>
            <div className="mt-3 space-y-2.5">
              {deals.map((d) => {
                const cr = creatorById(d.creatorId);
                const v = parseKNum(d.metrics?.views);
                return (
                  <div key={d.creatorId} className="flex items-center gap-2.5">
                    <span className="w-[104px] shrink-0 truncate text-[12px] font-semibold">
                      {cr.handle}
                    </span>
                    <div className="h-[18px] flex-1 overflow-hidden rounded-md bg-black/[0.04]">
                      <motion.div
                        className="h-full rounded-md"
                        style={{ background: cr.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round((v / maxViews) * 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <span className="k-mono w-[64px] shrink-0 text-right text-[12px] font-bold">
                      {v > 0 ? fmtViews(v) : "집계 전"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 크리에이터별 성과 테이블 */}
          <div className="k-card px-5 py-4">
            <SectionLabel>크리에이터별 성과</SectionLabel>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--k-line)] text-[11px] uppercase tracking-wide text-[var(--k-muted)]">
                    <th className="py-2 pr-3 font-semibold">크리에이터</th>
                    <th className="py-2 pr-3 text-right font-semibold">조회수</th>
                    <th className="py-2 pr-3 text-right font-semibold">저장</th>
                    <th className="py-2 pr-3 text-right font-semibold">CTR</th>
                    <th className="py-2 pr-3 text-right font-semibold">지급액</th>
                    <th className="py-2 pr-3 font-semibold">게시물</th>
                    <th className="py-2 font-semibold">진행률</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d) => {
                    const cr = creatorById(d.creatorId);
                    const dealPaid = releasedUsdc(d);
                    return (
                      <tr key={d.creatorId} className="border-b border-[var(--k-line)] last:border-0">
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            <Face src={cr.photo} color={cr.color} size={28} alt={cr.handle} />
                            <div>
                              <div className="text-[13px] font-bold leading-tight">{cr.handle}</div>
                              <div className="text-[11px] text-[var(--k-muted)]">{cr.niche}</div>
                            </div>
                          </div>
                        </td>
                        <td className="k-mono py-2.5 pr-3 text-right text-[12.5px] font-bold">
                          {d.metrics?.views ?? "—"}
                        </td>
                        <td className="k-mono py-2.5 pr-3 text-right text-[12.5px]">
                          {d.metrics?.saves ?? "—"}
                        </td>
                        <td className="k-mono py-2.5 pr-3 text-right text-[12.5px]">
                          {d.metrics?.ctr ?? "—"}
                        </td>
                        <td className="k-mono py-2.5 pr-3 text-right text-[12.5px] font-bold text-[var(--k-money)]">
                          {dealPaid.toLocaleString()}
                          {d.bonusUsdc ? (
                            <span className="ml-1 text-[10.5px] font-semibold text-[var(--k-muted)]">
                              (보너스 {d.bonusUsdc})
                            </span>
                          ) : null}
                        </td>
                        <td className="max-w-[150px] truncate py-2.5 pr-3 text-[12px]">
                          {d.postUrl ? (
                            <a
                              href={postHref(d.postUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="k-mono text-[11.5px] underline-offset-2 hover:underline"
                            >
                              {d.postUrl}
                            </a>
                          ) : (
                            <span className="text-[var(--k-muted)]">업로드 대기</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-[64px] overflow-hidden rounded-full bg-black/[0.06]">
                              <div
                                className="h-full rounded-full bg-[var(--k-ink)] transition-all"
                                style={{ width: `${d.starPct}%` }}
                              />
                            </div>
                            <span className="k-mono text-[11.5px] font-bold">{d.starPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
