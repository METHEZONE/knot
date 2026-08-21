"use client";

/** /b — 브랜드 워크스페이스 창 (호스트: 시퀀스를 굴리는 쪽). 로그인 필요. */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "@/demo/demo.css";
import { useAuth } from "@/auth/AuthProvider";
import { useDemo, initDemo } from "@/demo/engine/store";
import { useKnotSession } from "@/demo/auth/session";
import { Onboard } from "@/demo/brand/Onboard";
import { BrandApp } from "@/demo/brand/BrandApp";

export default function BrandDemoPage() {
  const router = useRouter();
  const s = useDemo();
  const session = useKnotSession();
  const auth = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDemo("host");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || auth.status === "loading") return;
    if (!session || auth.status !== "authenticated" || auth.context?.account.role !== "BRAND") {
      router.replace("/auth?role=brand");
    }
  }, [auth.context?.account.role, auth.status, ready, session, router]);

  if (!ready || auth.status === "loading" || !session || auth.context?.account.role !== "BRAND") {
    return <div data-knot-demo className="min-h-screen" />;
  }
  return (
    <div data-knot-demo className="min-h-screen">
      {s.stage === "workspace" ? <BrandApp /> : <Onboard />}
    </div>
  );
}
