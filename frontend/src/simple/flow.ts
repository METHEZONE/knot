export type Role = "creator" | "brand";

export const creatorFlow = [
  ["온보딩", "/creator/onboarding"],
  ["제안받기", "/creator/offers"],
  ["협상하기", "/creator/negotiate"],
  ["결과", "/creator/result"],
  ["마일스톤", "/creator/milestones"],
] as const;

export const brandFlow = [
  ["온보딩", "/brand/onboarding"],
  ["매칭", "/brand/matching"],
  ["협상하기", "/brand/negotiate"],
  ["결과", "/brand/result"],
  ["정산", "/brand/settlement"],
] as const;

export const agreedTerms = [
  ["금액", "950 USDC"],
  ["콘텐츠", "Instagram Reel 1개 + Story 2개"],
  ["권리", "Organic usage 30 days"],
  ["마감", "2026-08-03"],
  ["조건", "브랜드 멘션, 광고 표기, 제출 URL 필요"],
] as const;

export const minimumMvpRoutes = [
  "/",
  ...creatorFlow.map(([, href]) => href),
  ...brandFlow.map(([, href]) => href),
] as const;
