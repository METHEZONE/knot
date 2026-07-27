/**
 * 창 단위 온보딩 상태.
 *
 * 세션과 같은 이유로 `sessionStorage`에 둔다 — 왼쪽 창의 크리에이터 설정과
 * 오른쪽 창의 브랜드 설정이 섞이면 두 사용자 시연이 성립하지 않는다.
 */

export type BlockedCategory =
  | "gambling"
  | "loanCrypto"
  | "dietSupplement"
  | "medicalProcedure"
  | "alcohol"
  | "adult";

export const BLOCKED_CATEGORY_LABEL: Record<BlockedCategory, string> = {
  gambling: "도박",
  loanCrypto: "대출·코인",
  dietSupplement: "다이어트 보조제",
  medicalProcedure: "의료 시술",
  alcohol: "주류",
  adult: "성인",
};

export type CreatorSetup = {
  handle: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  reelShare: number;
  toneKeywords: string[];
  capturedAt: string;
  minUsdc: number;
  blocked: BlockedCategory[];
};

export type BrandSetup = {
  productUrl: string;
  productName: string;
  priceKrw: number;
  summary: string;
  category: string;
  moodTags: string[];
  totalUsdc: number;
  maxPerDealUsdc: number;
};

const CREATOR_KEY = "knot.setup.creator";
const BRAND_KEY = "knot.setup.brand";

export const SETUP_EVENT = "knot:setup";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 시크릿 모드
  }
  window.dispatchEvent(new Event(SETUP_EVENT));
}

export const readCreatorSetup = () => read<CreatorSetup>(CREATOR_KEY);
export const readBrandSetup = () => read<BrandSetup>(BRAND_KEY);
export const writeCreatorSetup = (v: CreatorSetup) => write(CREATOR_KEY, v);
export const writeBrandSetup = (v: BrandSetup) => write(BRAND_KEY, v);

/**
 * 인스타 사용자이름으로 찾은 사전 수집 결과.
 *
 * 실제 수집은 운영자 머신의 로컬 수집기가 하고, 여기서는 그 결과를 재생만
 * 한다(17 §3). 그래서 화면에는 항상 `capturedAt`이 함께 나가야 하며, 라이브
 * 스크래핑을 암시하는 문구를 쓰지 않는다.
 */
export function lookupInstagram(handle: string): Omit<
  CreatorSetup,
  "minUsdc" | "blocked"
> {
  const clean = handle.replace(/^@/, "").trim() || "demobeauty";
  // 사용자이름에서 결정론적으로 뽑는다 — 같은 핸들이면 항상 같은 카드.
  let h = 0x811c9dc5;
  for (let i = 0; i < clean.length; i += 1) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const seed = h >>> 0;
  const followers = 40_000 + (seed % 160_000);
  const engagementRate = Number((0.028 + ((seed >> 7) % 40) / 1000).toFixed(3));
  return {
    handle: `@${clean}`,
    followers,
    avgViews: Math.round(followers * (1.1 + ((seed >> 3) % 90) / 100)),
    engagementRate,
    reelShare: 50 + ((seed >> 5) % 35),
    toneKeywords: ["차분한 설명", "성분 중심", "루틴 공유"],
    capturedAt: "2026-07-26",
  };
}

/** 추천 마지노선 — 팔로워 규모 × 참여율에서 결정론적으로 계산한다. */
export function suggestedMinUsdc(followers: number, engagementRate: number): number {
  const raw = (followers / 1000) * 4 * (1 + engagementRate * 8);
  return Math.max(150, Math.round(raw / 50) * 50);
}

/** 제품 링크에서 뽑아낸 값. 데모에서는 URL로부터 결정론적으로 만든다. */
export function extractProduct(url: string): Omit<
  BrandSetup,
  "moodTags" | "totalUsdc" | "maxPerDealUsdc" | "productUrl"
> {
  const known = url.toLowerCase();
  if (known.includes("lockin") || known.includes("coffee")) {
    return {
      productName: "LOCK IN COFFEE 콜드브루",
      priceKrw: 4_500,
      summary: "기능성 버섯 추출물을 넣은 집중용 콜드브루.",
      category: "wellness",
    };
  }
  return {
    productName: "데일리 SPF 모이스처라이저",
    priceKrw: 28_000,
    summary: "자외선 차단과 보습을 한 번에 끝내는 데일리 크림.",
    category: "beauty",
  };
}
