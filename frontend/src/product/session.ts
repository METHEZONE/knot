/**
 * 창(탭) 단위 로그인 세션.
 *
 * 데모는 브라우저 창 두 개를 좌우로 띄워 두 유저를 동시에 보여주는 방식이다.
 * 그래서 세션을 `sessionStorage`에 둔다 — localStorage나 쿠키는 창끼리 공유되기
 * 때문에 왼쪽 창을 브랜드로, 오른쪽 창을 크리에이터로 만들 수가 없다.
 * sessionStorage는 창마다 독립이라 이 요구와 정확히 맞는다.
 *
 * 이 세션은 PLANS.md의 프라이버시 규칙을 구조로 강제하는 역할도 한다:
 * 로그인한 역할의 화면만 열리므로, 상대방의 private 정책(크리에이터 최저가·
 * 금지주제, 브랜드 hard cap, 내부 스코어)에는 애초에 접근할 수 없다.
 *
 * 실제 인증(Firebase Google + Solana wallet)이 붙으면 이 모듈의 뒷면만 바뀌고
 * 화면 쪽 계약은 그대로 유지된다.
 */

import type { Role } from "./types";

const STORAGE_KEY = "knot.session.role";

/** 세션이 바뀌면 이미 마운트된 컴포넌트들이 다시 읽도록 알린다. */
export const SESSION_EVENT = "knot:session";

/** 로그인 직후 각 역할이 처음 보는 화면. */
export const ROLE_ENTRY: Record<Role, string> = {
  brand: "/brand/product",
  creator: "/creator/connect",
};

/** 상단바에 "누구로 로그인했는지" 보여주는 데 쓴다 — 창을 나란히 놓고 봐야 하므로 필수. */
export const ROLE_LABEL: Record<Role, { who: string; org: string }> = {
  brand: { who: "Yuna", org: "Glow Bar Labs" },
  creator: { who: "Mina", org: "Mina Studio" },
};

function isRole(value: string | null): value is Role {
  return value === "brand" || value === "creator";
}

export function readSessionRole(): Role | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    return isRole(value) ? value : null;
  } catch {
    return null;
  }
}

export function signIn(role: Role): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, role);
  } catch {
    // 시크릿 모드에서 저장이 막히면 세션 없이 동작한다.
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}
