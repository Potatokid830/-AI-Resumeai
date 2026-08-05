"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";

type EducationEnrichCardProps = {
  disabled?: boolean;
  onApply: (text: string) => void;
  onDismiss: () => void;
};

export default function EducationEnrichCard({
  disabled = false,
  onApply,
  onDismiss,
}: EducationEnrichCardProps) {
  const [text, setText] = useState("");
  const canApply = text.trim().length > 0 && !disabled;

  return (
    <div
      role="region"
      aria-label="教育栏可选补充"
      className="no-export rounded-2xl border border-sky-200/20 bg-sky-100/[0.06] px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sky-100/90">
          <GraduationCap className="h-4 w-4" strokeWidth={1.7} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium tracking-tight text-zinc-100">
            教育栏可以更充实（可选）
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
            目前多半只有学校 / 专业 / 时间。可补充相关课程、GPA、获奖等；不填不影响导出，系统不会编造。内容将原样写入第一条教育经历。
          </p>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={disabled}
            rows={3}
            placeholder={"例如：\nGPA 3.7/4.0\n相关课程：微观经济学、财务报表分析\n获奖：校级奖学金"}
            className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 disabled:opacity-60"
          />

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onDismiss}
              disabled={disabled}
              className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:opacity-60"
            >
              忽略
            </button>
            <button
              type="button"
              onClick={() => onApply(text)}
              disabled={!canApply}
              className="rounded-full bg-zinc-50 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              写入教育栏
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
