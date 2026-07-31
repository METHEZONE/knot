"use client";

/** 금액 한 덩어리 — 원화가 크고 USDC가 옆단위 (설정에서 뒤집힘). */

import { splitAmount, useCurrencyMode } from "@/product/currency";

export function Money({
  usdc,
  size = "md",
}: {
  usdc: number;
  size?: "sm" | "md" | "lg";
}) {
  const mode = useCurrencyMode();
  const { primary, secondary } = splitAmount(usdc, mode);
  const primaryClass =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-[15px]" : "text-xl";

  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={`font-mono ${primaryClass}`}>{primary}</span>
      <span className="font-mono text-xs text-muted">{secondary}</span>
    </span>
  );
}
