"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/auth/AuthProvider";
import { TopBar } from "@/components/TopBar";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <AuthProvider>
      <TopBar />
      <main className={isLanding ? "w-full flex-1" : "mx-auto w-full max-w-6xl flex-1 px-4 py-8"}>{children}</main>
    </AuthProvider>
  );
}
