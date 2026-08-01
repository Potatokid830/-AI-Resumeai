"use client";

import { motion } from "framer-motion";

const enterEase = [0.22, 1, 0.36, 1] as const;

function BeforeCard() {
  return (
    <div className="h-full w-full rounded-[22px] border border-white/[0.06] bg-zinc-900/35 p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-[0.22em] text-zinc-600 uppercase">
          Before
        </span>
        <span className="rounded-full bg-zinc-800/70 px-2 py-0.5 text-[9px] text-zinc-600">
          Draft
        </span>
      </div>

      <div className="mb-4 space-y-1.5">
        <div className="h-2.5 w-24 rounded-sm bg-zinc-700/60" />
        <div className="h-1.5 w-36 rounded-sm bg-zinc-800/70" />
        <div className="h-1.5 w-28 rounded-sm bg-zinc-800/50" />
      </div>

      <div className="mb-3 h-px w-full bg-zinc-800/70" />

      <p className="mb-2 text-[10px] font-medium tracking-wide text-zinc-600">
        工作经历
      </p>
      <ul className="space-y-2 text-[11px] leading-relaxed text-zinc-600">
        <li>负责产品相关工作，日常跟进需求</li>
        <li>和各个部门沟通，完成了不少任务</li>
        <li>参与过一些项目优化，效果还可以</li>
        <li className="text-zinc-700">帮忙写文档、开会、整理表格……</li>
      </ul>

      <div className="mt-4 space-y-1.5">
        <div className="h-1.5 w-full rounded-sm bg-zinc-800/45" />
        <div className="h-1.5 w-4/5 rounded-sm bg-zinc-800/35" />
        <div className="h-1.5 w-3/5 rounded-sm bg-zinc-800/25" />
      </div>
    </div>
  );
}

function AfterCard() {
  return (
    <div className="relative h-full w-full">
      <div
        aria-hidden
        className="absolute -inset-px rounded-[22px] bg-gradient-to-br from-white/40 via-zinc-300/15 to-transparent"
      />
      <div
        aria-hidden
        className="absolute -inset-10 rounded-[40px] bg-white/[0.035] blur-3xl"
      />

      <div className="relative h-full w-full rounded-[22px] border border-white/15 bg-zinc-900/50 p-5 shadow-[0_0_48px_-16px_rgba(255,255,255,0.16),0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[10px] font-medium tracking-[0.22em] text-zinc-300 uppercase">
            After · STAR
          </span>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] text-zinc-200">
            Optimized
          </span>
        </div>

        <div className="mb-4">
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-tight text-zinc-50">
            Product Manager
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            字节跳动 · 增长方向
          </p>
        </div>

        <div className="mb-3 h-px w-full bg-gradient-to-r from-white/25 via-white/10 to-transparent" />

        <div className="space-y-2.5 text-[11px] leading-relaxed">
          <p>
            <span className="mr-1.5 font-semibold text-zinc-200">S</span>
            <span className="text-zinc-400">
              核心转化漏斗注册完成率仅 38%，远低于行业基准
            </span>
          </p>
          <p>
            <span className="mr-1.5 font-semibold text-zinc-200">T</span>
            <span className="text-zinc-400">
              在 6 周内将完成率提升至 55%，且不影响获客成本
            </span>
          </p>
          <p>
            <span className="mr-1.5 font-semibold text-zinc-200">A</span>
            <span className="text-zinc-400">
              主导 3 轮用户访谈，重构引导流程并 A/B 验证 4 个方案
            </span>
          </p>
          <p>
            <span className="mr-1.5 font-semibold text-zinc-100">R</span>
            <span className="bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text font-medium text-transparent">
              完成率 +44.7%，月新增激活用户 +12.6 万
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function FaintCard() {
  return (
    <div className="h-full w-full rounded-[22px] border border-white/[0.04] bg-zinc-900/20 p-5 backdrop-blur-md">
      <div className="mb-3 h-2 w-20 rounded-sm bg-zinc-800/55" />
      <div className="space-y-1.5">
        <div className="h-1.5 w-full rounded-sm bg-zinc-800/35" />
        <div className="h-1.5 w-5/6 rounded-sm bg-zinc-800/25" />
        <div className="h-1.5 w-2/3 rounded-sm bg-zinc-800/18" />
      </div>
      <div className="mt-5 space-y-1.5">
        <div className="h-1.5 w-full rounded-sm bg-zinc-800/30" />
        <div className="h-1.5 w-4/5 rounded-sm bg-zinc-800/22" />
        <div className="h-1.5 w-3/4 rounded-sm bg-zinc-800/16" />
        <div className="h-1.5 w-1/2 rounded-sm bg-zinc-800/12" />
      </div>
    </div>
  );
}

function floatTransition(duration: number, delay = 0) {
  return {
    duration,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay,
  };
}

export default function HeroBackground() {
  return (
    <div
      aria-hidden
      className="noise-overlay pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-zinc-950" />

      <div className="absolute top-[-28%] left-1/2 h-[78vh] w-[90vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.02)_38%,transparent_68%)]" />
      <div className="absolute bottom-[-18%] left-[-12%] h-[55vh] w-[55vw] bg-[radial-gradient(ellipse_at_center,rgba(161,161,170,0.05)_0%,transparent_70%)]" />
      <div className="absolute right-[-8%] bottom-[8%] h-[45vh] w-[42vw] bg-[radial-gradient(ellipse_at_center,rgba(228,228,231,0.04)_0%,transparent_70%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,9,11,0.15)_0%,rgba(9,9,11,0.55)_42%,rgba(9,9,11,0.88)_72%,rgba(9,9,11,0.96)_100%)]" />

      <motion.div
        className="absolute top-[16%] left-1/2 hidden h-[300px] w-[210px] -translate-x-1/2 blur-[1px] md:block lg:h-[340px] lg:w-[240px]"
        style={{ rotate: -3 }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{
          opacity: 0.3,
          scale: 1,
          y: [0, -12, 0],
        }}
        transition={{
          opacity: { duration: 1.2, ease: enterEase },
          scale: { duration: 1.2, ease: enterEase },
          y: floatTransition(10),
        }}
      >
        <FaintCard />
      </motion.div>

      <div className="absolute top-[28%] left-[-18%] h-[260px] w-[180px] opacity-[0.28] blur-[0.5px] sm:left-[-6%] sm:opacity-40 md:top-[20%] md:left-[6%] md:h-[340px] md:w-[240px] md:opacity-45 lg:left-[10%] xl:left-[12%]">
        <motion.div
          className="h-full w-full"
          style={{ rotate: -9 }}
          initial={{ opacity: 0, x: -24 }}
          animate={{
            opacity: 1,
            x: 0,
            y: [0, -16, 0],
          }}
          transition={{
            opacity: { duration: 1.1, ease: enterEase, delay: 0.15 },
            x: { duration: 1.1, ease: enterEase, delay: 0.15 },
            y: floatTransition(7.8, 0.3),
          }}
        >
          <BeforeCard />
        </motion.div>
      </div>

      <div className="absolute top-[26%] right-[-16%] h-[280px] w-[190px] opacity-[0.38] sm:right-[-4%] sm:opacity-55 md:top-[18%] md:right-[5%] md:h-[360px] md:w-[250px] md:opacity-65 lg:right-[9%] xl:right-[11%]">
        <motion.div
          className="h-full w-full"
          style={{ rotate: 8 }}
          initial={{ opacity: 0, x: 24 }}
          animate={{
            opacity: 1,
            x: 0,
            y: [0, -20, 0],
          }}
          transition={{
            opacity: { duration: 1.15, ease: enterEase, delay: 0.28 },
            x: { duration: 1.15, ease: enterEase, delay: 0.28 },
            y: floatTransition(8.6, 0.6),
          }}
        >
          <AfterCard />
        </motion.div>
      </div>

      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-zinc-950 to-transparent sm:w-28" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950 to-transparent sm:w-28" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-950/80 to-transparent" />
    </div>
  );
}
