"use client";

import { useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import FileDropzone, { type UploadedFile } from "./FileDropzone";
import ResumeUpload from "./ResumeUpload";

const fieldClassName =
  "w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-[14px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow,background-color] duration-300 hover:border-white/[0.1] hover:bg-white/[0.03] focus:border-white/20 focus:bg-white/[0.04] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06),0_0_32px_-8px_rgba(255,255,255,0.12)]";

export type GeneratePayload = {
  jdText: string;
  experienceText: string;
  resumeFile: File | null;
};

type InputPanelProps = {
  isGenerating?: boolean;
  onGenerate?: (payload: GeneratePayload) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildExperienceText(files: UploadedFile[], notes: string) {
  const sections: string[] = [];

  if (files.length) {
    sections.push(
      [
        "【已上传项目文件】",
        ...files.map(
          (file) => `- ${file.name} (${formatFileSize(file.size)})`,
        ),
      ].join("\n"),
    );
  }

  if (notes.trim()) {
    sections.push(`【补充说明】\n${notes.trim()}`);
  }

  return sections.join("\n\n");
}

export default function InputPanel({
  isGenerating = false,
  onGenerate,
}: InputPanelProps) {
  const [jd, setJd] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [notes, setNotes] = useState("");

  const handleClick = () => {
    onGenerate?.({
      jdText: jd.trim(),
      experienceText: buildExperienceText(files, notes),
      resumeFile,
    });
  };

  return (
    <section className="relative flex min-h-0 flex-col border-b border-white/[0.06] bg-zinc-950 md:border-r md:border-b-0 md:border-white/[0.06]">
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6 pb-28 sm:px-7 sm:pt-8">
        <header className="mb-5 shrink-0">
          <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
            输入你的素材
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            越具体，重组后的 STAR 话术越精准。
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1">
          <label className="flex shrink-0 flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              目标岗位 JD
            </span>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="在此粘贴目标岗位 JD (建议提取核心职责和要求)..."
              disabled={isGenerating}
              className={`${fieldClassName} min-h-[120px] disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              个人简历原件
            </span>
            <ResumeUpload
              file={resumeFile}
              onFileChange={setResumeFile}
              disabled={isGenerating}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              项目文件
            </span>
            <FileDropzone
              files={files}
              onFilesChange={setFiles}
              disabled={isGenerating}
            />
          </div>

          <label className="flex shrink-0 flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              补充说明
              <span className="ml-1.5 normal-case tracking-normal text-zinc-600">
                可选
              </span>
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="(可选) 你还有什么想补充的背景信息吗？"
              disabled={isGenerating}
              rows={3}
              className={`${fieldClassName} min-h-[88px] disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-5 pt-10 pb-5 sm:px-7 sm:pb-6">
        <div className="pointer-events-auto flex justify-center">
          <button
            type="button"
            onClick={handleClick}
            disabled={isGenerating}
            className="group relative inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed"
          >
            <span
              aria-hidden
              className="absolute -inset-3 rounded-full bg-white/0 blur-xl transition-all duration-500 group-hover:bg-white/[0.12] group-disabled:opacity-0"
            />
            <span className="relative inline-flex items-center gap-2 rounded-full bg-zinc-50 px-7 py-3 text-[14px] font-medium tracking-tight text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_36px_-12px_rgba(255,255,255,0.28),0_8px_24px_-12px_rgba(0,0,0,0.7)] transition-[transform,box-shadow,background-color,opacity] duration-300 group-hover:scale-[1.03] group-hover:bg-white group-hover:shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_16px_44px_-12px_rgba(255,255,255,0.4),0_10px_28px_-12px_rgba(0,0,0,0.75)] group-active:scale-[0.975] group-disabled:scale-100 group-disabled:bg-zinc-300 group-disabled:opacity-80">
              {isGenerating ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin text-zinc-700"
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <Sparkles
                  className="h-4 w-4 text-zinc-700 transition-transform duration-300 group-hover:rotate-12 group-hover:text-zinc-900"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              {isGenerating ? "重组中..." : "AI 深度重组"}
              {!isGenerating && (
                <span className="hidden font-normal text-zinc-500 sm:inline">
                  (Generate)
                </span>
              )}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
