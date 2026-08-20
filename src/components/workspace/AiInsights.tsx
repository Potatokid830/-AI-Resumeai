"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  MessageSquareQuote,
  PanelRightOpen,
  WandSparkles,
} from "lucide-react";

type AiInsightsProps = {
  polishAdvice: string;
  interviewDefense: string;
};

const ease = [0.22, 1, 0.36, 1] as const;

export default function AiInsights({
  polishAdvice,
  interviewDefense,
}: AiInsightsProps) {
  const [open, setOpen] = useState(false);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.55, ease, delay: 0.55 }}
      className={`flex flex-col gap-3 ${
        open
          ? "w-full lg:w-[300px] lg:max-w-[300px] lg:shrink-0"
          : "w-full lg:w-auto lg:max-w-none lg:shrink-0"
      }`}
      aria-label="AI 洞察"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-950/55 px-3 py-2.5 text-left transition-colors hover:border-white/15 hover:bg-zinc-950/70 lg:w-auto"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-zinc-300">
          <PanelRightOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 text-[11px] font-medium tracking-[0.16em] text-zinc-400 uppercase lg:flex-none">
          AI Insights
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="insights-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            <InsightCard
              delay={0}
              icon={<WandSparkles className="h-3.5 w-3.5" strokeWidth={1.75} />}
              title="经历打磨建议"
              body={polishAdvice}
            />
            <InsightCard
              delay={0.08}
              icon={
                <MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={1.75} />
              }
              title="面试防御话术"
              body={interviewDefense}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
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
