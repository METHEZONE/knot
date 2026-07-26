import { RoleGate } from "@/product/RoleGate";

/** 크리에이터로 로그인한 창에서만 `/creator/**`가 열린다. */
export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate role="creator">{children}</RoleGate>;
}
