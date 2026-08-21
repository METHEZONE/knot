"use client";

/**
 * 신규 앱(/b·/c) 세션 — 구글/이메일(Firebase), 팬텀 지갑, 데모 페르소나를
 * 하나의 로컬 세션으로 통일한다. Firebase 로그인은 AuthProvider와 별개로
 * 여기서도 스냅샷을 남겨 /b·/c 게이트가 동기적으로 판단할 수 있게 한다.
 */

import { useSyncExternalStore } from "react";

export type KnotRole = "brand" | "creator";

export type KnotSession = {
  method: "google" | "email" | "wallet" | "persona";
  role: KnotRole;
  name: string;
  email: string | null;
  photo: string | null;
  wallet: string | null;
  at: number;
};

const KEY = "knot-session-v1";
const listeners = new Set<() => void>();
let cached: KnotSession | null | undefined;

function read(): KnotSession | null {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as KnotSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

function notify() {
  listeners.forEach((l) => l());
}

export function getSession(): KnotSession | null {
  return read();
}

export function saveSession(s: Omit<KnotSession, "at">) {
  cached = { ...s, at: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    // 저장 실패해도 메모리 세션으로 동작
  }
  notify();
}

export function clearSession() {
  cached = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  notify();
}

export function updateSession(patch: Partial<KnotSession>) {
  const cur = read();
  if (!cur) return;
  saveSession({ ...cur, ...patch });
}

export function useKnotSession(): KnotSession | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => null,
  );
}

export function shortAddress(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}
