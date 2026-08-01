import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Outfit, Syne } from "next/font/google";
import MotionProvider from "@/components/MotionProvider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ResumeAI — Rewrite Your Career",
  description: "深度解析 JD，让 AI 赋能你的经历。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${outfit.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-950 text-zinc-50 font-sans">
        <MotionProvider>{children}</MotionProvider>
        <Analytics />
      </body>
    </html>
  );
}
