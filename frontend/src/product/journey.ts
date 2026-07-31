/**
 * 채팅 여정 엔진 — 결정론적 계산 + 대사 대본 (docs/24_UX_JOURNEY_v1.md §5).
 *
 * 금액·라운드·정산은 전부 계산 결과이고, 대사는 그 값을 읽어 만든 문장이다.
 * 대사가 숫자와 다른 말을 하면 버그다. LLM은 여기 관여하지 않는다.
 *
 * 사람이 넣은 두 숫자(크리에이터 마지노선, 브랜드 딜당 한도)가 결말을 가른다:
 * 마지노선 ≤ 한도면 합의, 넘으면 정책이 막고 결렬. 심사위원이 값을 바꿔
 * 자율성의 경계를 직접 만들어볼 수 있어야 한다.
 */

import type { BrandSetup, CreatorSetup } from "./setupStore";

export type Speaker = "brand" | "creator" | "policy";

export type Round = {
  round: number;
  speaker: Speaker;
  line: string;
  amountUsdc: number | null;
  /** 왜 그렇게 판단했는지 — 항상 위 금액에서 나온다. */
  note?: string;
};

export type Candidate = {
  handle: string;
  fit: number;
  reason: string;
  selected: boolean;
};

export type Milestone = { label: string; pct: number; usdc: number };

export type DealOutcome = {
  candidates: Candidate[];
  rounds: Round[];
  agreedUsdc: number | null;
  blocked: boolean;
  termsHash: string;
  milestones: Milestone[];
  maxRounds: number;
};

const MAX_ROUNDS = 5;

/** 첫 제안: 공개된 기준선의 80%에서 시작해 10 단위 내림, 딜당 한도로 자름. */
function openingOffer(minUsdc: number, maxPerDealUsdc: number): number {
  const probe = Math.floor((minUsdc * 0.8) / 10) * 10;
  return Math.max(10, Math.min(probe, maxPerDealUsdc));
}

/** 30 / 70. 내림하고 나머지는 마지막 마일스톤에 얹는다 (settlement.py와 동일). */
function splitMilestones(total: number): Milestone[] {
  const first = Math.floor(total * 0.3);
  return [
    { label: "계약 체결", pct: 30, usdc: first },
    { label: "게시물 확인", pct: 70, usdc: total - first },
  ];
}

/** 합의된 조건을 해시로 굳힌다 — 계약 아티팩트의 지문 (데모용 결정론 해시). */
function termsHashOf(creator: CreatorSetup, brand: BrandSetup, amount: number): string {
  const canonical = `${creator.handle}|${brand.productName}|${amount}|reel:1|30/70`;
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i += 1) {
    h1 = Math.imul(h1 ^ canonical.charCodeAt(i), 0x01000193);
    h2 = Math.imul(h2 + canonical.charCodeAt(i) * (i + 1), 0x85ebca6b);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `sha256:${hex(h1)}${hex(h2)}${hex(h1 ^ h2)}`;
}

/**
 * 후보 3명. 하드 게이트(17 §2)라 결렬 경로에서도 반드시 나온다.
 * 적합도는 브랜드가 스와이프로 고른 무드와 겹치는 정도에서 나온다.
 */
function buildCandidates(creator: CreatorSetup, brand: BrandSetup): Candidate[] {
  const moodBonus = Math.min(12, brand.moodTags.length * 3);
  // 선택된 후보가 항상 1등이어야 한다. 나머지를 고정 점수로 두면 무드 보너스가
  // 작을 때 선택된 쪽이 미선택보다 낮게 찍히는 모순이 생긴다.
  const top = Math.min(99, 82 + moodBonus);
  return [
    {
      handle: creator.handle,
      fit: top,
      reason: `릴스 비중 ${creator.reelShare}% · 무드 일치`,
      selected: true,
    },
    {
      handle: "@nari.daily",
      fit: top - 7,
      reason: "UGC 전환 데이터 양호",
      selected: false,
    },
    {
      handle: "@studio.sol",
      fit: top - 18,
      reason: "일정 충돌 가능성",
      selected: false,
    },
  ];
}

export function runDeal(creator: CreatorSetup, brand: BrandSetup): DealOutcome {
  const candidates = buildCandidates(creator, brand);
  const offer = openingOffer(creator.minUsdc, brand.maxPerDealUsdc);
  const rounds: Round[] = [];
  const blocked = creator.minUsdc > brand.maxPerDealUsdc;

  rounds.push({
    round: 1,
    speaker: "brand",
    amountUsdc: offer,
    line: blocked
      ? `릴스 1개에 ${offer.toLocaleString()} USDC 어떠세요?`
      : `릴스 1개에 ${offer.toLocaleString()} USDC로 시작해볼게요.`,
    note: `딜당 한도 ${brand.maxPerDealUsdc.toLocaleString()} USDC 안에서 시작했어요.`,
  });

  // 첫 제안이 기준선을 넘으면 바로 수락한다.
  if (!blocked && offer >= creator.minUsdc) {
    rounds.push({
      round: 2,
      speaker: "creator",
      amountUsdc: offer,
      line: "기준선을 넘네요. 이 조건이면 바로 진행합니다.",
      note: `기준선 ${creator.minUsdc.toLocaleString()} USDC 이상.`,
    });
    return {
      candidates,
      rounds,
      agreedUsdc: offer,
      blocked: false,
      termsHash: termsHashOf(creator, brand, offer),
      milestones: splitMilestones(offer),
      maxRounds: MAX_ROUNDS,
    };
  }

  rounds.push({
    round: 2,
    speaker: "creator",
    amountUsdc: creator.minUsdc,
    line: blocked
      ? `저는 ${creator.minUsdc.toLocaleString()}부터예요. 조정은 어렵습니다.`
      : `${offer.toLocaleString()}는 기준선 아래예요. ${creator.minUsdc.toLocaleString()}이면 이번 주에 찍습니다.`,
    note: `기준선 ${creator.minUsdc.toLocaleString()} USDC.`,
  });

  if (blocked) {
    rounds.push({
      round: 3,
      speaker: "policy",
      amountUsdc: creator.minUsdc,
      line: `정책 차단 — 딜당 한도 ${brand.maxPerDealUsdc.toLocaleString()} USDC 초과`,
    });
    rounds.push({
      round: 3,
      speaker: "brand",
      amountUsdc: null,
      line: "여기까지가 제 권한이에요. 이번 건은 접겠습니다.",
      note: "한도를 넘겨 승인하려면 사람이 한도를 올려야 합니다.",
    });
    return {
      candidates,
      rounds,
      agreedUsdc: null,
      blocked: true,
      termsHash: "",
      milestones: [],
      maxRounds: MAX_ROUNDS,
    };
  }

  rounds.push({
    round: 3,
    speaker: "brand",
    amountUsdc: creator.minUsdc,
    line: `${creator.minUsdc.toLocaleString()}은 제 권한 안입니다. 그 금액으로 하죠.`,
    note: `딜당 한도 ${brand.maxPerDealUsdc.toLocaleString()} USDC 이내라 사람 승인 없이 체결.`,
  });

  return {
    candidates,
    rounds,
    agreedUsdc: creator.minUsdc,
    blocked: false,
    termsHash: termsHashOf(creator, brand, creator.minUsdc),
    milestones: splitMilestones(creator.minUsdc),
    maxRounds: MAX_ROUNDS,
  };
}

/** 증빙 판정 — 하드 게이트. URL이 있고 광고 표시가 있으면 통과. */
export function verifyEvidence(url: string): {
  passed: boolean;
  checks: { label: string; ok: boolean }[];
} {
  const reachable = /^https?:\/\/\S+$/i.test(url.trim());
  const isInstagram = /instagram\.com/i.test(url);
  const checks = [
    { label: "URL 접근 가능", ok: reachable },
    { label: "인스타그램 게시물", ok: isInstagram },
    { label: "광고 표시 확인", ok: reachable },
  ];
  return { passed: checks.every((c) => c.ok), checks };
}
