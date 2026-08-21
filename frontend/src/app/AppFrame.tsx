"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/auth/AuthProvider";
import { TopBar } from "@/components/TopBar";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const isDemoWorkspace =
    pathname === "/auth" ||
    pathname === "/b" ||
    pathname.startsWith("/b/") ||
    pathname === "/c" ||
    pathname.startsWith("/c/");

  return (
    <AuthProvider>
      {!isDemoWorkspace && <TopBar />}
      <main
        className={
          isLanding || isDemoWorkspace
            ? "w-full flex-1"
            : "mx-auto w-full max-w-6xl flex-1 px-4 py-8"
        }
      >
        {children}
      </main>
    </AuthProvider>
  );
}
