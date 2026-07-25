"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 상단바는 최소한만 — 워드마크와, 감사 화면으로 가는 작은 링크 하나.
 *
 * 역할 스위처와 알림 벨은 데모 화면에서 내렸다. 지금 이 제품이 보여줄 건
 * 하나(매니저끼리 딜 치는 것)뿐이고, 그 옆에 배지 달린 벨과 탭이 있으면
 * 시선이 갈라진다. 두 기능 다 감사 화면 쪽에는 그대로 살아 있다.
 */
export function TopBar() {
  const pathname = usePathname();
  const onStage = pathname === "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="display text-2xl leading-none">knot</span>
          <span className="hidden text-sm text-muted sm:inline">
            크리에이터 × 브랜드, 매니저끼리
          </span>
        </Link>

        <Link
          href={onStage ? "/brand" : "/"}
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          {onStage ? "감사 화면" : "데모로 돌아가기"}
        </Link>
      </div>
    </header>
  );
}
