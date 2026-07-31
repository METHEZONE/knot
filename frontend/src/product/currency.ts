"use client";

/**
 * 금액 표시 — 원화를 먼저, USDC를 옆에.
 *
 * 계약과 정산의 단위는 언제나 USDC다(온체인 값이 그렇다). 하지만 한국 사용자는
 * "650 USDC"가 얼마인지 즉시 감이 오지 않기 때문에, 화면에서는 환산된 원화를
 * 크게 보여주고 USDC를 옆에 단위처럼 붙인다. 설정에서 뒤집을 수 있다.
 *
 * 환율은 표시용 고정값이다. 시세를 가져오지 않으므로 화면에 항상 "표시 환율"로
 * 밝히고, 계산·계약·정산에는 절대 쓰지 않는다 — 그쪽은 USDC 정수 그대로다.
 */

import { useEffect, useState } from "react";

/** 표시 전용 고정 환율. 실제 체결 금액은 언제나 USDC 정수다. */
export const KRW_PER_USDC = 1_380;

export type CurrencyMode = "krwFirst" | "usdcFirst";

const KEY = "knot.currency";
const EVENT = "knot:currency";

export function readCurrencyMode(): CurrencyMode {
  if (typeof window === "undefined") return "krwFirst";
  try {
    const v = window.sessionStorage.getItem(KEY);
    return v === "usdcFirst" ? "usdcFirst" : "krwFirst";
  } catch {
    return "krwFirst";
  }
}

export function setCurrencyMode(mode: CurrencyMode): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCurrencyMode(): CurrencyMode {
  const [mode, setMode] = useState<CurrencyMode>("krwFirst");
  useEffect(() => {
    const sync = () => setMode(readCurrencyMode());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return mode;
}

export function usdcToKrw(usdc: number): number {
  return Math.round((usdc * KRW_PER_USDC) / 100) * 100;
}

/** 큰 쪽 / 작은 쪽으로 갈라 반환한다. 화면이 크기를 다르게 줄 수 있도록. */
export function splitAmount(
  usdc: number,
  mode: CurrencyMode,
): { primary: string; secondary: string } {
  const krw = `${usdcToKrw(usdc).toLocaleString("ko-KR")}원`;
  const usd = `${usdc.toLocaleString()} USDC`;
  return mode === "krwFirst"
    ? { primary: krw, secondary: usd }
    : { primary: usd, secondary: krw };
}
