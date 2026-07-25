import type { Metadata } from "next";
import { Caveat, Gaegu, Geist_Mono } from "next/font/google";
import { SquiggleFilters } from "@/components/SquiggleFilters";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

/** Body/UI hand. Gaegu carries Latin and Hangul, so Korean copy stays in-world. */
const hand = Gaegu({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

/** Headlines and figures — a faster, more confident hand than the body font. */
const display = Caveat({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
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
  title: "KNOT — Agentic Promotions",
  description:
    "KNOT ties creators and brands together: agents match, negotiate, escrow, and verify promotions end to end.",
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
