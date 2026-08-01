"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

export default function HeroContent() {
  return (
    <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 h-[min(70vh,560px)] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(9,9,11,0.72)_0%,rgba(9,9,11,0.35)_48%,transparent_72%)] blur-2xl"
      />

      <div className="relative">
        <motion.p
          className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,8vw,5.5rem)] leading-none font-semibold tracking-[-0.04em]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease, delay: 0.08 }}
        >
          <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
            ResumeAI
          </span>
        </motion.p>

        <motion.h1
          className="mt-6 text-balance text-[clamp(1.5rem,3.8vw,2.35rem)] leading-snug font-medium tracking-tight text-zinc-200"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease, delay: 0.22 }}
        >
          重塑你的职业轨迹
          <span className="mt-2 block text-[0.72em] font-normal tracking-[-0.02em] text-zinc-500">
            Rewrite Your Career.
          </span>
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-lg text-pretty text-[15px] leading-relaxed text-zinc-400 sm:text-base"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease, delay: 0.36 }}
        >
          深度解析 JD，让 AI 赋能你的经历。
        </motion.p>

        <motion.div
          className="mt-11"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.95, ease, delay: 0.5 }}
        >
          <Link
            href="/workspace"
            className="group relative inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <span
              aria-hidden
              className="absolute -inset-4 rounded-full bg-white/0 blur-2xl transition-all duration-500 group-hover:bg-white/[0.14]"
            />

            <span className="relative inline-flex items-center gap-2.5 rounded-full bg-zinc-50 px-9 py-3.5 text-[15px] font-medium tracking-tight text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_36px_-12px_rgba(255,255,255,0.32),0_10px_28px_-14px_rgba(0,0,0,0.75)] transition-[transform,box-shadow,background-color] duration-300 group-hover:scale-[1.03] group-hover:bg-white group-hover:shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_16px_44px_-12px_rgba(255,255,255,0.42),0_12px_32px_-14px_rgba(0,0,0,0.8)] group-active:scale-[0.975]">
              开始创作
              <Sparkles
                className="h-4 w-4 text-zinc-700 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110 group-hover:text-zinc-900"
                strokeWidth={1.75}
                aria-hidden
              />
            </span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
