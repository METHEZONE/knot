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
