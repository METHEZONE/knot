"use client";

/**
 * 두 창이 공유하는 딜 상태.
 *
 * 신원은 창별(`sessionStorage`)이지만 **딜은 두 사람이 함께 보는 것**이므로
 * `localStorage`에 둔다. 브라우저의 `storage` 이벤트가 다른 창에서 발생한
 * 변경을 알려주기 때문에, 오른쪽 창에서 브랜드가 한도를 넣으면 왼쪽 크리에이터
 * 창이 즉시 반응한다. 이게 "두 사용자가 서로 협상한다"를 진짜로 만드는 부분이다.
 *
 * 프로덕션에서는 이 자리가 Firestore다. 여기 저장된 상대편 값을 화면에
 * 그리면 안 된다 — private 정책 노출 금지 규칙은 렌더 단계에서 지킨다.
 */

import { useEffect, useState } from "react";
import type { BrandSetup, CreatorSetup } from "./setupStore";

export type Board = {
  creator: CreatorSetup | null;
  brand: BrandSetup | null;
  /** 크리에이터가 제출한 증빙 URL. */
  evidenceUrl: string | null;
  /** 딜을 리셋한 횟수 — 값을 바꿔 다시 돌릴 때 스레드를 새로 그리는 키. */
  epoch: number;
};

const KEY = "knot.board";
const LOCAL_EVENT = "knot:board";

const EMPTY: Board = { creator: null, brand: null, evidenceUrl: null, epoch: 0 };

export function readBoard(): Board {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Board>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function writeBoard(patch: Partial<Board>): void {
  if (typeof window === "undefined") return;
  const next = { ...readBoard(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 시크릿 모드
  }
  // `storage` 이벤트는 다른 창에만 간다. 내 창은 직접 알린다.
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

export function resetDeal(): void {
  const board = readBoard();
  writeBoard({ evidenceUrl: null, epoch: board.epoch + 1 });
}

export function clearBoard(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

/** 두 창 모두에서 같은 딜을 구독한다. */
export function useBoard(): { board: Board; ready: boolean } {
  const [state, setState] = useState<{ board: Board; ready: boolean }>({
    board: EMPTY,
    ready: false,
  });

  useEffect(() => {
    const sync = () => setState({ board: readBoard(), ready: true });
    sync();
    window.addEventListener(LOCAL_EVENT, sync);
    // 다른 창의 변경.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LOCAL_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}
