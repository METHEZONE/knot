"use client";

/**
 * 현재 창의 로그인 역할을 읽는 훅.
 *
 * sessionStorage는 SSR에 없으므로 첫 렌더에서는 항상 `ready: false`다. 이걸
 * 무시하고 바로 판단하면 하이드레이션이 깨지거나, 로그인한 사용자가 한 프레임
 * 동안 로그아웃 상태로 보인다.
 */

import { useEffect, useState } from "react";
import { SESSION_EVENT, readSessionRole } from "./session";
import type { Role } from "./types";

export function useSessionRole(): { role: Role | null; ready: boolean } {
  const [state, setState] = useState<{ role: Role | null; ready: boolean }>({
    role: null,
    ready: false,
  });

  useEffect(() => {
    const sync = () => setState({ role: readSessionRole(), ready: true });
    sync();
    // 같은 창 안에서의 로그인/로그아웃.
    window.addEventListener(SESSION_EVENT, sync);
    return () => window.removeEventListener(SESSION_EVENT, sync);
  }, []);

  return state;
}
