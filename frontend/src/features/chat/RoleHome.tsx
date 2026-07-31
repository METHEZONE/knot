"use client";

/**
 * 역할 홈 = 매니저 채팅창.
 *
 * 온보딩이 안 끝났으면 그 역할의 첫 단계로 보낸다 — 설정 없이 채팅창에
 * 들어오면 매니저가 할 말이 없다.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ManagerChat } from "@/features/chat/ManagerChat";
import { useBoard } from "@/product/dealBoard";
import type { Role } from "@/product/types";

const FIRST_STEP: Record<Role, string> = {
  creator: "/creator/connect",
  brand: "/brand/product",
};

export function RoleHome({ role }: { role: Role }) {
  const router = useRouter();
  const { board, ready } = useBoard();
  const mine = role === "creator" ? board.creator : board.brand;

  useEffect(() => {
    if (ready && !mine) router.replace(FIRST_STEP[role]);
  }, [ready, mine, role, router]);

  if (!ready || !mine) {
    return <div className="py-24 text-center text-muted">불러오는 중…</div>;
  }
  return <ManagerChat role={role} />;
}
