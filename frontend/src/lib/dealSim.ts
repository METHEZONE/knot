/**
 * 데모 스테이지용 협상 시뮬레이션.
 *
 * LLM이 아니라 결정론적 규칙이다 — 백엔드의 정책 검사
 * (`backend/libs/policies/{creator,brand}.py`)와 같은 규칙을 프론트에서
 * 재현한 것이고, 같은 입력이면 항상 같은 결과가 나온다. 그래서 데모에서
 * 보이는 숫자는 연출이 아니라 계산 결과다.
 *
 * 두 유저가 넣은 값이 실제로 결말을 바꾼다:
 * - 크리에이터 최저 단가 ≤ 브랜드 딜당 한도  →  합의
 * - 크리에이터 최저 단가 >  브랜드 딜당 한도  →  정책이 막고 결렬
 *
 * 정산 분할은 백엔드 `settlement.py`와 동일하게 내림 처리하고 나머지를
 * 마지막 마일스톤에 몰아준다.
 */

export interface CreatorSetup {
  handle: string;
  /** 이 금액 밑으로는 에이전트가 자동 거절한다. */
  minBaseUsdc: number;
}

export interface BrandSetup {
  name: string;
  /**
   * 사람 승인 없이 한 건에 쓸 수 있는 상한. 데모에서 사람이 정하는 값은
   * 이거 하나다 — 총예산 같은 나머지 한도는 결말을 바꾸지 않으므로 화면에
   * 올리지 않는다.
   */
  maxPerDealUsdc: number;
}

export type DealStepKind = "offer" | "counter" | "accept" | "block" | "walkaway";

export interface DealStep {
  kind: DealStepKind;
  /** 이 말을 한 쪽. `block`은 정책 엔진이라 어느 쪽도 아니다. */
  from: "brand" | "creator" | "policy";
  round: number;
  amountUsdc: number | null;
  /** 에이전트가 하는 말. */
  line: string;
  /** 왜 그렇게 판단했는지 — 항상 위 숫자에서 나온다. */
  reason?: string;
}

export interface Milestone {
  label: string;
  pct: number;
  usdc: number;
}

export interface DealResult {
  steps: DealStep[];
  /** 합의된 금액. 결렬이면 null. */
  agreedUsdc: number | null;
  milestones: Milestone[];
  maxRounds: number;
}

const MAX_ROUNDS = 5;

/** 첫 제안은 공개된 레이트카드의 80%에서 시작해 10 단위로 내림. */
function openingOffer(creator: CreatorSetup, brand: BrandSetup): number {
  const probe = Math.floor((creator.minBaseUsdc * 0.8) / 10) * 10;
  return Math.max(10, Math.min(probe, brand.maxPerDealUsdc));
}

/** 30 / 70 분할. 내림하고 나머지는 마지막 마일스톤에 더한다. */
function splitMilestones(total: number): Milestone[] {
  const first = Math.floor(total * 0.3);
  return [
    { label: "계약 체결", pct: 30, usdc: first },
    { label: "게시물 확인", pct: 70, usdc: total - first },
  ];
}

export function simulateDeal(creator: CreatorSetup, brand: BrandSetup): DealResult {
  const steps: DealStep[] = [];
  const offer = openingOffer(creator, brand);

  steps.push({
    kind: "offer",
    from: "brand",
    round: 1,
    amountUsdc: offer,
    line: `릴스 1개, 기본 ${offer.toLocaleString()} USDC 어떠세요?`,
    reason: `딜당 한도 ${brand.maxPerDealUsdc.toLocaleString()} USDC 안에서 시작했어요.`,
  });

  // 최저 단가 이상이면 그대로 수락한다.
  if (offer >= creator.minBaseUsdc) {
    steps.push({
      kind: "accept",
      from: "creator",
      round: 2,
      amountUsdc: offer,
      line: "제 최저 단가를 넘네요. 이 조건으로 할게요.",
      reason: `최저 단가 ${creator.minBaseUsdc.toLocaleString()} USDC 이상이라 바로 수락.`,
    });
    return {
      steps,
      agreedUsdc: offer,
      milestones: splitMilestones(offer),
      maxRounds: MAX_ROUNDS,
    };
  }

  // 아니면 최저 단가로 역제안한다.
  steps.push({
    kind: "counter",
    from: "creator",
    round: 2,
    amountUsdc: creator.minBaseUsdc,
    line: `제 최저 단가가 ${creator.minBaseUsdc.toLocaleString()} USDC예요. 여기로 맞춰주실 수 있나요?`,
    reason: `${offer.toLocaleString()} USDC는 최저 단가보다 낮아서 그대로는 못 받아요.`,
  });

  // 브랜드 쪽 한도를 넘으면 정책이 막는다 — 사람에게 묻지 않고 결렬.
  if (creator.minBaseUsdc > brand.maxPerDealUsdc) {
    steps.push({
      kind: "block",
      from: "policy",
      round: 3,
      amountUsdc: creator.minBaseUsdc,
      line: `정책 차단 — 딜당 한도 ${brand.maxPerDealUsdc.toLocaleString()} USDC 초과`,
      reason: "브랜드가 정한 한도를 넘는 금액이라 에이전트가 서명할 수 없어요.",
    });
    steps.push({
      kind: "walkaway",
      from: "brand",
      round: 3,
      amountUsdc: null,
      line: "이번 건은 한도를 넘어서 여기서 접겠습니다.",
      reason: "한도를 넘겨 승인하려면 사람이 직접 한도를 올려야 해요.",
    });
    return { steps, agreedUsdc: null, milestones: [], maxRounds: MAX_ROUNDS };
  }

  steps.push({
    kind: "accept",
    from: "brand",
    round: 3,
    amountUsdc: creator.minBaseUsdc,
    line: "한도 안에 들어옵니다. 그 금액으로 계약하죠.",
    reason: `딜당 한도 ${brand.maxPerDealUsdc.toLocaleString()} USDC 이내라 사람 승인 없이 체결.`,
  });

  return {
    steps,
    agreedUsdc: creator.minBaseUsdc,
    milestones: splitMilestones(creator.minBaseUsdc),
    maxRounds: MAX_ROUNDS,
  };
}
