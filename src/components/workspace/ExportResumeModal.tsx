"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResumeContact } from "@/lib/resumeContact";
import {
  CORE_CONTACT_LABELS,
  missingCoreContactFields,
  normalizeContact,
  type CoreContactField,
} from "@/lib/resumeContact";

type ExportResumeModalProps = {
  open: boolean;
  initialContact: ResumeContact;
  onClose: () => void;
  /** 用户确认导出（可含补填后的 contact） */
  onConfirmExport: (contact: ResumeContact) => void;
};

export default function ExportResumeModal({
  open,
  initialContact,
  onClose,
  onConfirmExport,
}: ExportResumeModalProps) {
  const [draft, setDraft] = useState<ResumeContact>({});

  useEffect(() => {
    if (open) setDraft(normalizeContact(initialContact));
  }, [open, initialContact]);

  const missing = useMemo(
    () => missingCoreContactFields(draft),
    [draft],
  );
  const complete = missing.length === 0;
  const mode = complete ? "confirm" : "fill";

  if (!open) return null;

  const setField = (key: keyof ResumeContact, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-resume-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="export-resume-title"
          className="text-[15px] font-semibold tracking-tight text-zinc-50"
        >
          {mode === "confirm" ? "确认联系方式后导出" : "补充联系方式（可选）"}
        </h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
          {mode === "confirm"
            ? "请扫一眼自动抽取的姓名 / 电话 / 邮箱，确认无误再导出成品简历。"
            : `未抽全：${missing.map((k) => CORE_CONTACT_LABELS[k]).join("、")}。可补填，也可忽略后直接导出（缺项留空，不会编造）。`}
        </p>

        <div className="mt-4 space-y-3">
          {(
            [
              ["name", "姓名", complete],
              ["phone", "电话", complete],
              ["email", "邮箱", complete],
              ["city", "城市（可选）", false],
              ["linkedIn", "LinkedIn（可选）", false],
            ] as const
          ).map(([key, label, emphasize]) => (
            <label key={key} className="block">
              <span
                className={`mb-1 block text-[11px] ${
                  emphasize ||
                  (missing as CoreContactField[]).includes(
                    key as CoreContactField,
                  )
                    ? "text-zinc-300"
                    : "text-zinc-500"
                }`}
              >
                {label}
              </span>
              <input
                value={draft[key] ?? ""}
                onChange={(event) => setField(key, event.target.value)}
                placeholder={mode === "fill" ? "可留空" : undefined}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
          >
            取消
          </button>
          {mode === "fill" ? (
            <>
              <button
                type="button"
                onClick={() => onConfirmExport(normalizeContact(draft))}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
              >
                忽略，直接导出
              </button>
              <button
                type="button"
                onClick={() => onConfirmExport(normalizeContact(draft))}
                className="rounded-full bg-zinc-50 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white"
              >
                保存并导出
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onConfirmExport(normalizeContact(draft))}
              className="rounded-full bg-zinc-50 px-3.5 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white"
            >
              确认导出
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
