"use client";

import { Columns2, FileText } from "lucide-react";

export type ExportPdfType = "printable" | "comparison";

type ExportTypeModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (type: ExportPdfType) => void;
};

export default function ExportTypeModal({
  open,
  onClose,
  onSelect,
}: ExportTypeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-type-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="export-type-title"
          className="text-[15px] font-semibold tracking-tight text-zinc-50"
        >
          选择导出类型
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
          成品版用于投递；对照版用于回顾原文与改写差异。
        </p>

        <div className="mt-4 grid gap-2.5">
          <button
            type="button"
            onClick={() => onSelect("printable")}
            className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-3.5 py-3.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.07]"
          >
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100">
              <FileText className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-zinc-50">
                成品简历（投递用）
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-zinc-500">
                干净投递稿，含联系方式确认；不含原文对照。
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelect("comparison")}
            className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-3.5 py-3.5 text-left transition-colors hover:border-white/25 hover:bg-white/[0.07]"
          >
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100">
              <Columns2 className="h-4 w-4" strokeWidth={1.7} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-medium text-zinc-50">
                对照版（看改动）
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-zinc-500">
                每条经历上原文、下改写，方便回顾 AI 改了哪些。
              </span>
            </span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
