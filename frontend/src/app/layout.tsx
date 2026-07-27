import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import { SquiggleFilters } from "@/components/SquiggleFilters";
import { TopBar } from "@/components/TopBar";
import "./globals.css";

/**
 * 이서윤체 — 본문과 헤드라인을 같은 손글씨로 쓴다.
 *
 * Gaegu는 한글이 작게 렌더돼 잘 안 읽혔고, Caveat/나눔펜은 라틴과 한글 중
 * 한쪽만 제대로 커버했다. 이 폰트 하나로 둘 다 해결되므로 위계는 글꼴이 아니라
 * 크기와 굵기로 만든다.
 */
const hand = localFont({
  src: "./fonts/LeeSeoyun.ttf",
  variable: "--font-hand",
  display: "swap",
});

/**
 * Money, hashes, ids and policy JSON stay in mono. In a hand-drawn UI the
 * numbers are the one thing that must never look approximate.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "knot — 크리에이터와 브랜드를 잇는 매듭",
  description:
    "크리에이터의 에이전트와 브랜드의 에이전트가 사람이 정한 한도 안에서 직접 협상하고, 계약하고, 온체인으로 정산합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${hand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SquiggleFilters />
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
