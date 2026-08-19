"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircleQuestion, Sparkles } from "lucide-react";

type DeepDivePanelProps = {
  questions: string[];
  gapAnalysis?: string;
  matchScore?: number;
  matchSubtitle?: string;
  isSubmitting?: boolean;
  /** embedded：结果页内嵌可选深化；standalone：独立追问页（旧链路） */
  variant?: "standalone" | "embedded";
  onSubmit: (answers: string[]) => void;
  onSkip: () => void;
};

const fieldClassName =
  "mt-2 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-[13.5px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow,background-color] duration-300 hover:border-white/15 focus:border-white/25 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.07)]";

export default function DeepDivePanel({
  questions,
  gapAnalysis,
  matchScore,
  matchSubtitle,
  isSubmitting = false,
  variant = "standalone",
  onSubmit,
  onSkip,
}: DeepDivePanelProps) {
  const [answers, setAnswers] = useState<string[]>(() =>
    questions.map(() => ""),
  );

  useEffect(() => {
    setAnswers(questions.map(() => ""));
  }, [questions]);

  const canSubmit = useMemo(
    () => answers.some((item) => item.trim().length > 0) && !isSubmitting,
    [answers, isSubmitting],
  );

  const isEmbedded = variant === "embedded";

  return (
    <motion.div
      key="deepdive"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={isEmbedded ? "w-full" : "w-full max-w-2xl"}
    >
      <div
        className={`border border-white/[0.08] bg-zinc-950/55 shadow-[0_24px_80px_-48px_rgba(255,255,255,0.12)] backdrop-blur-xl ${
          isEmbedded
            ? "rounded-2xl p-4 sm:p-5"
            : "rounded-[28px] p-5 sm:p-7"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200">
            <MessageCircleQuestion className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.16em] text-zinc-500 uppercase">
              {isEmbedded ? "可选深化" : "AI Mentor · Deep Dive"}
            </p>
            <h2
              className={`mt-1 font-[family-name:var(--font-display)] font-semibold tracking-tight text-zinc-50 ${
                isEmbedded ? "text-base" : "text-xl"
              }`}
            >
              {isEmbedded ? "回答几个问题，匹配度可以更高" : "AI 导师追问"}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-400">
              {isEmbedded
                ? "补充真实细节即可，不另扣次数；跳过则保留当前结果。"
                : matchSubtitle ||
                  "先补齐关键细节，再合成无模板感的终版 STAR 简历。"}
              {!isEmbedded && typeof matchScore === "number" && (
                <span className="ml-1 text-zinc-500">
                  初步匹配约 {matchScore}%
                </span>
              )}
            </p>
          </div>
        </div>

        {gapAnalysis && !isEmbedded && (
          <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[13px] leading-relaxed text-zinc-400">
            {gapAnalysis}
          </div>
        )}

        <div className={isEmbedded ? "mt-4 space-y-4" : "mt-6 space-y-5"}>
          {questions.map((question, index) => (
            <div key={`${index}-${question}`}>
              <label className="block">
                <span className="flex items-start gap-2 text-[13.5px] leading-relaxed font-medium text-zinc-200">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] text-zinc-400">
                    {index + 1}
                  </span>
                  {question}
                </span>
                <textarea
                  value={answers[index] ?? ""}
                  disabled={isSubmitting}
                  rows={isEmbedded ? 2 : 3}
                  placeholder="用白话补充即可，例如数据、反馈、你具体做了什么……"
                  onChange={(event) => {
                    const next = [...answers];
                    next[index] = event.target.value;
                    setAnswers(next);
                  }}
                  className={`${fieldClassName} disabled:opacity-60`}
                />
              </label>
            </div>
          ))}
        </div>

        <div className={isEmbedded ? "mt-5 space-y-2" : "mt-7 space-y-2.5"}>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(answers.map((item) => item.trim()))}
            className="group relative inline-flex w-full items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 disabled:cursor-not-allowed"
          >
            <span
              aria-hidden
              className="absolute -inset-2 rounded-full bg-white/0 blur-xl transition-all duration-500 group-hover:bg-white/[0.1] group-disabled:opacity-0"
            />
            <span
              className={`relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-50 font-medium tracking-tight text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_36px_-12px_rgba(255,255,255,0.28)] transition-[transform,background-color,opacity] duration-300 group-hover:scale-[1.01] group-hover:bg-white group-active:scale-[0.985] group-disabled:scale-100 group-disabled:bg-zinc-300 group-disabled:opacity-80 ${
                isEmbedded
                  ? "px-5 py-3 text-[13.5px]"
                  : "px-6 py-3.5 text-[14px]"
              }`}
            >
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              {isSubmitting
                ? "正在优化..."
                : isEmbedded
                  ? "根据回答重新优化"
                  : "✨ 补充完毕，生成终版简历"}
            </span>
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSkip}
            className="inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-[13px] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEmbedded ? "暂不补充" : "跳过补充，直接生成"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
