"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MessageSquareQuote, WandSparkles } from "lucide-react";

type AiInsightsProps = {
  polishAdvice: string;
  interviewDefense: string;
};

const ease = [0.22, 1, 0.36, 1] as const;

export default function AiInsights({
  polishAdvice,
  interviewDefense,
}: AiInsightsProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease, delay: 0.55 }}
      className="flex w-full flex-col gap-3 lg:max-w-[300px] lg:shrink-0"
      aria-label="AI 洞察"
    >
      <div className="mb-0.5 flex items-center gap-2 px-0.5">
        <span className="text-[11px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
          AI Insights
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
      </div>

      <InsightCard
        delay={0.68}
        icon={<WandSparkles className="h-3.5 w-3.5" strokeWidth={1.75} />}
        title="经历打磨建议"
        body={polishAdvice}
      />

      <InsightCard
        delay={0.82}
        icon={<MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={1.75} />}
        title="面试防御话术"
        body={interviewDefense}
      />
    </motion.aside>
  );
}

function InsightCard({
  icon,
  title,
  body,
  delay,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease, delay }}
      className="rounded-2xl border border-white/[0.08] bg-zinc-950/55 p-4 shadow-[0_16px_48px_-36px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300">
          {icon}
        </span>
        <h3 className="text-[13px] font-medium tracking-tight text-zinc-100">
          {title}
        </h3>
      </div>
      <p className="text-[12.5px] leading-relaxed text-zinc-400">{body}</p>
    </motion.div>
  );
}
