"use client";

import { useMemo, useState } from "react";
import { Clapperboard, LoaderCircle, Sparkles } from "lucide-react";
import FileDropzone, { type UploadedFile } from "./FileDropzone";
import ResumeUpload, { type ResumeUploadState } from "./ResumeUpload";

const fieldClassName =
  "w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-[14px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow,background-color] duration-300 hover:border-white/[0.1] hover:bg-white/[0.03] focus:border-white/20 focus:bg-white/[0.04] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06),0_0_32px_-8px_rgba(255,255,255,0.12)]";

const PORTFOLIO_EXTENSIONS = [".mp4", ".mov", ".webm", ".pdf", ".pptx"] as const;

export type GenerateAssetRef = {
  name: string;
  url: string;
  size: number;
};

export type GeneratePayload = {
  jdText: string;
  experienceText: string;
  resumeUrl: string | null;
  resumeFileName: string | null;
  assetUrls: GenerateAssetRef[];
  /** 补充说明原文，供作品集管线使用 */
  userNotes: string;
};

type InputPanelProps = {
  isGenerating?: boolean;
  isAnalyzingPortfolio?: boolean;
  onGenerate?: (payload: GeneratePayload) => void;
  onAnalyzePortfolio?: (payload: GeneratePayload) => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPortfolioAsset(file: UploadedFile) {
  return (PORTFOLIO_EXTENSIONS as readonly string[]).includes(file.extension);
}

function buildExperienceText(files: UploadedFile[], notes: string) {
  const ready = files.filter((file) => file.status === "ready" && file.url);
  const sections: string[] = [];

  if (ready.length) {
    sections.push(
      [
        "【已上传项目文件（云端直传）】",
        ...ready.map(
          (file) =>
            `- ${file.name} (${formatFileSize(file.size)})\n  url: ${file.url}`,
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
  isAnalyzingPortfolio = false,
  onGenerate,
  onAnalyzePortfolio,
}: InputPanelProps) {
  const [jd, setJd] = useState("");
  const [resumeState, setResumeState] = useState<ResumeUploadState>({
    status: "idle",
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [notes, setNotes] = useState("");

  const busy = isGenerating || isAnalyzingPortfolio;

  const isUploading = useMemo(() => {
    if (resumeState.status === "uploading") return true;
    return files.some((file) => file.status === "uploading");
  }, [files, resumeState.status]);

  const portfolioReady = useMemo(
    () =>
      files.some(
        (file) =>
          file.status === "ready" &&
          Boolean(file.url) &&
          isPortfolioAsset(file),
      ),
    [files],
  );

  const buildPayload = (): GeneratePayload => {
    const resumeUrl =
      resumeState.status === "ready" ? resumeState.asset.url : null;
    const resumeFileName =
      resumeState.status === "ready" ? resumeState.asset.name : null;

    const assetUrls: GenerateAssetRef[] = files
      .filter((file) => file.status === "ready" && file.url)
      .map((file) => ({
        name: file.name,
        url: file.url as string,
        size: file.size,
      }));

    return {
      jdText: jd.trim(),
      experienceText: buildExperienceText(files, notes),
      resumeUrl,
      resumeFileName,
      assetUrls,
      userNotes: notes.trim(),
    };
  };

  return (
    <section className="relative flex min-h-0 flex-col border-b border-white/[0.06] bg-zinc-950 md:border-r md:border-b-0 md:border-white/[0.06]">
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6 pb-36 sm:px-7 sm:pt-8">
        <header className="mb-5 shrink-0">
          <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
            输入你的素材
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            大文件直传云端；视频 / PDF / PPT 可走作品集专属解析。
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
              disabled={busy}
              className={`${fieldClassName} min-h-[120px] disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              个人简历原件
            </span>
            <ResumeUpload
              state={resumeState}
              onStateChange={setResumeState}
              disabled={busy}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              项目文件
            </span>
            <FileDropzone
              files={files}
              onFilesChange={setFiles}
              disabled={busy}
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
              placeholder="(可选) 作品集一句话背景，例如口号、目标受众、你负责的环节..."
              disabled={busy}
              rows={3}
              className={`${fieldClassName} min-h-[88px] disabled:cursor-not-allowed disabled:opacity-60`}
            />
          </label>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent px-5 pt-10 pb-5 sm:px-7 sm:pb-6">
        <div className="pointer-events-auto flex flex-col items-center gap-2.5">
          {(isUploading || (!portfolioReady && files.some((f) => f.status === "ready"))) && (
            <p className="text-center text-[12px] text-zinc-500">
              {isUploading
                ? "文件正在直传云端，完成后即可生成"
                : "上传 mp4 / mov / pdf / pptx 后可启用作品集解析"}
            </p>
          )}

          <div className="flex w-full max-w-xl flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={() => onGenerate?.(buildPayload())}
              disabled={busy || isUploading}
              className="group relative inline-flex flex-1 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 disabled:cursor-not-allowed sm:flex-none"
            >
              <span
                aria-hidden
                className="absolute -inset-3 rounded-full bg-white/0 blur-xl transition-all duration-500 group-hover:bg-white/[0.12] group-disabled:opacity-0"
              />
              <span className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-50 px-6 py-3 text-[13.5px] font-medium tracking-tight text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_36px_-12px_rgba(255,255,255,0.28)] transition-[transform,background-color,opacity] duration-300 group-hover:scale-[1.02] group-hover:bg-white group-active:scale-[0.98] group-disabled:scale-100 group-disabled:bg-zinc-300 group-disabled:opacity-80 sm:w-auto sm:px-7">
                {isGenerating && !isAnalyzingPortfolio ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin text-zinc-700"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Sparkles className="h-4 w-4 text-zinc-700" strokeWidth={1.75} />
                )}
                {isGenerating && !isAnalyzingPortfolio
                  ? "重组中..."
                  : "✨ AI 深度重组"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onAnalyzePortfolio?.(buildPayload())}
              disabled={busy || isUploading || !portfolioReady}
              title={
                portfolioReady
                  ? "视觉大模型解析作品集并生成 STAR"
                  : "请先上传视频或 PDF / PPTX"
              }
              className={`group relative inline-flex flex-1 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/40 disabled:cursor-not-allowed sm:flex-none ${
                portfolioReady && !busy && !isUploading
                  ? ""
                  : "opacity-45"
              }`}
            >
              <span
                aria-hidden
                className={`absolute -inset-3 rounded-full blur-xl transition-all duration-500 group-disabled:opacity-0 ${
                  portfolioReady
                    ? "bg-amber-200/0 group-hover:bg-amber-200/15"
                    : "bg-transparent"
                }`}
              />
              <span
                className={`relative inline-flex w-full items-center justify-center gap-2 rounded-full border px-6 py-3 text-[13.5px] font-medium tracking-tight transition-[transform,background-color,border-color,color] duration-300 sm:w-auto sm:px-7 ${
                  portfolioReady && !busy && !isUploading
                    ? "border-amber-200/35 bg-amber-100 text-zinc-950 shadow-[0_12px_36px_-14px_rgba(251,191,36,0.55)] group-hover:scale-[1.02] group-hover:bg-amber-50 group-active:scale-[0.98]"
                    : "border-white/10 bg-white/[0.04] text-zinc-500"
                }`}
              >
                {isAnalyzingPortfolio ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Clapperboard className="h-4 w-4" strokeWidth={1.75} />
                )}
                {isAnalyzingPortfolio
                  ? "解析中..."
                  : "🎬 一键解析多媒体作品集"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
