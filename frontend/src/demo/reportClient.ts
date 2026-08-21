"use client";

/**
 * 리포트 클라이언트 — DemoState 스냅샷을 /api/knot/report로 form POST(새 탭)해
 * 인쇄용 리포트를 연다. store를 import하지 않아 어디서든(뷰·store 액션) 재사용 가능.
 * (script.ts의 creatorById는 순수 데이터 조회라 순환 참조가 없다.)
 */

import type { Deal, DemoState } from "@/demo/engine/types";
import { creatorById } from "@/demo/engine/script";

/** 릴리즈된 마일스톤 + 보너스 = 실제 지급액 */
export function releasedUsdc(d: Deal): number {
  return (
    d.milestones.filter((m) => m.status === "released").reduce((a, m) => a + m.usdc, 0) +
    (d.bonusUsdc ?? 0)
  );
}

/** 리포트 라우트로 보내는 캠페인 스냅샷 — 라우트는 이 값만으로 렌더한다. */
export function buildReportPayload(s: DemoState) {
  const c = s.campaign!;
  return {
    brand: s.brand
      ? { name: s.brand.name, url: s.brand.url, agentName: s.brand.agentName, color: s.brand.color }
      : null,
    spec: c.spec,
    status: c.status,
    deals: c.deals.map((d) => {
      const cr = creatorById(d.creatorId);
      return {
        handle: cr.handle,
        name: cr.name,
        niche: cr.niche,
        amountUsdc: d.amountUsdc,
        bonusUsdc: d.bonusUsdc,
        paidUsdc: releasedUsdc(d),
        progressPct: d.starPct,
        postUrl: d.postUrl,
        metrics: d.metrics,
        milestones: d.milestones,
        txs: d.txs,
      };
    }),
    generatedAt: Date.now(),
  };
}

/** form POST(target=_blank)로 리포트 새 탭 열기 — 사용자는 브라우저 인쇄로 PDF 저장. */
export function openReport(s: DemoState) {
  if (!s.campaign) return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "/api/knot/report";
  form.target = "_blank";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "payload";
  input.value = JSON.stringify(buildReportPayload(s));
  form.appendChild(input);
  document.body.appendChild(form);
  form.submit();
  form.remove();
}
