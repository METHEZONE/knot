import type { Metadata } from "next";
import { Gaegu, Geist_Mono, Nanum_Pen_Script } from "next/font/google";
import { SquiggleFilters } from "@/components/SquiggleFilters";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

/** Body/UI hand. Gaegu carries Hangul and Latin, so Korean copy stays in-world. */
const hand = Gaegu({
  variable: "--font-hand",
  // next/font's bundled data for Gaegu only declares the latin subset, so
  // asking for "korean" fails to typecheck. Dropping `subsets` with
  // `preload: false` loads the full face (all unicode ranges), which is what
  // Korean copy needs; the browser still only downloads the ranges it uses.
  weight: ["300", "400", "700"],
  preload: false,
});

/**
 * Headlines — the same hand as the /knot landing. Caveat was the wrong choice
 * for a Korean product: it has no Hangul, so every Korean headline silently
 * fell back to the body font.
 */
const display = Nanum_Pen_Script({
  variable: "--font-display",
  weight: ["400"],
  preload: false,
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
    "크리에이터의 매니저와 브랜드의 매니저가 사람이 정한 한도 안에서 직접 협상하고, 계약하고, 온체인으로 정산합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hand.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SquiggleFilters />
        <ToastProvider>
          <TopBar />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
