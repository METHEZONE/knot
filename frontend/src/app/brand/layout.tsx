import { RoleGate } from "@/product/RoleGate";

/** 브랜드로 로그인한 창에서만 `/brand/**`가 열린다. */
export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate role="brand">{children}</RoleGate>;
}
