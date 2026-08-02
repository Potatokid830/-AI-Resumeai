"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CircleDashed,
  Copy,
  FileDown,
  LoaderCircle,
  Lock,
  Sparkles,
} from "lucide-react";
import type {
  GenerateApiResponse,
  ResumeSection,
  ResumeSectionItem,
} from "@/lib/generateTypes";
import { buildResumePlainText } from "@/lib/resumePlainText";
import AiInsights from "./AiInsights";
import DeepDivePanel from "./DeepDivePanel";
import MarkHtml from "./MarkHtml";
import MatchScore from "./MatchScore";
import Toast from "./Toast";
import type { WorkspaceStatus } from "./types";

function isItemLocked(
  sectionIndex: number,
  itemIndex: number,
  sections: ResumeSection[],
  contentUnlocked: boolean,
) {
  if (contentUnlocked) return false;
  if (sections.length > 1) return sectionIndex > 0;
  const half = Math.ceil(sections[0].items.length / 2);
  return itemIndex >= half;
}

function RevisedBody({ item }: { item: ResumeSectionItem }) {
  return (
    <>
      <p className="mt-1.5 text-[14px] leading-[1.55] text-zinc-800">
        {item.revisedHtml ? (
          <MarkHtml html={item.revisedHtml} variant="light" />
        ) : (
          <span className="whitespace-pre-wrap">
            {item.revised || "（无改写）"}
          </span>
        )}
      </p>
      {item.changeReason ? (
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
          {item.changeReason}
        </p>
      ) : null}
    </>
  );
}

function PortfolioItemBlock({ item }: { item: ResumeSectionItem }) {
  const label =
    item.sourceLabel?.trim() ||
    item.original?.trim() ||
    "基于上传作品集提炼";
  return (
    <div className="space-y-3 rounded-xl border border-amber-200/50 bg-amber-50/40 p-4">
      <p className="text-[12.5px] font-medium tracking-tight text-amber-950/80">
        📎 {label}
      </p>
      <div>
        <p className="text-[11px] font-medium tracking-[0.12em] text-zinc-500 uppercase">
          提炼经历
        </p>
        <RevisedBody item={item} />
      </div>
    </div>
  );
}

function formatEnhancedByLabel(names: string[]) {
  if (!names.length) return "";
  if (names.length === 1) return `📎 已用作品《${names[0]}》增强`;
  return `📎 已用作品《${names[0]}》等 ${names.length} 个文件增强`;
}

function ResumeItemBlock({ item }: { item: ResumeSectionItem }) {
  if (item.source === "portfolio") {
    return <PortfolioItemBlock item={item} />;
  }

  const enhancedLabel =
    item.enhancedBy?.length ? formatEnhancedByLabel(item.enhancedBy) : "";

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200/80 bg-white/60 p-4">
      {enhancedLabel ? (
        <p className="text-[12.5px] font-medium tracking-tight text-emerald-800/90">
          {enhancedLabel}
        </p>
      ) : null}
      <div>
        <p className="text-[11px] font-medium tracking-[0.12em] text-zinc-500 uppercase">
          原文
        </p>
        <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-[1.55] text-zinc-600">
          {item.original || "（无原文）"}
        </p>
      </div>
      <div className="h-px bg-zinc-200/80" />
      <div>
        <p className="text-[11px] font-medium tracking-[0.12em] text-zinc-500 uppercase">
          改写
        </p>
        <RevisedBody item={item} />
      </div>
    </div>
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

const panelMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.45, ease },
};

function EmptyState({ error }: { error?: string | null }) {
  return (
    <motion.div
      key="idle"
      {...panelMotion}
      className="flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <CircleDashed
          className="h-5 w-5 text-zinc-600"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <p className="text-sm tracking-tight text-zinc-500">
        准备就绪，等待输入...
      </p>
      {error && (
        <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-amber-200/80">
          {error}
        </p>
      )}
    </motion.div>
  );
}

const PORTFOLIO_PIPELINE = [
  {
    id: "gemini",
    label: "Gemini Vision",
    detail: "正在让 Gemini 视觉引擎审阅您的作品…",
  },
  {
    id: "deepseek",
    label: "DeepSeek STAR",
    detail: "正在让 DeepSeek 重构 STAR 简历…",
  },
] as const;

function LoadingState({
  hint,
  variant = "default",
  portfolioStep = 0,
}: {
  hint: string;
  variant?: "default" | "portfolio";
  portfolioStep?: number;
}) {
  const isPortfolio = variant === "portfolio";
  const activeStep = Math.min(
    PORTFOLIO_PIPELINE.length - 1,
    Math.max(0, portfolioStep),
  );

  return (
    <motion.div
      key={isPortfolio ? "loading-portfolio" : "loading"}
      {...panelMotion}
      className="flex w-full max-w-lg flex-col gap-5 px-2"
    >
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Sparkles
          className={`h-4 w-4 animate-pulse ${isPortfolio ? "text-amber-200" : "text-zinc-300"}`}
          strokeWidth={1.75}
        />
        <span className="relative overflow-hidden">
          <span className="animate-[shimmer_2s_linear_infinite] bg-[linear-gradient(90deg,rgba(161,161,170,0.45)_0%,rgba(250,250,250,0.95)_45%,rgba(161,161,170,0.45)_100%)] bg-[length:200%_100%] bg-clip-text text-transparent">
            {isPortfolio ? PORTFOLIO_PIPELINE[activeStep].detail : hint}
          </span>
        </span>
      </div>

      {isPortfolio ? (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/15 bg-zinc-950/50 p-5 shadow-[0_20px_60px_-40px_rgba(251,191,36,0.35)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between text-[11px] tracking-[0.14em] text-zinc-500 uppercase">
            <span>Dual-Engine Pipeline</span>
            <span className="text-amber-200/70">
              STAGE {activeStep + 1}/{PORTFOLIO_PIPELINE.length}
            </span>
          </div>

          <ol className="mb-5 space-y-2">
            {PORTFOLIO_PIPELINE.map((step, index) => {
              const done = index < activeStep;
              const active = index === activeStep;
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[12.5px] ${
                    active
                      ? "border-amber-200/25 bg-amber-100/[0.06] text-amber-50"
                      : done
                        ? "border-white/[0.06] bg-white/[0.02] text-zinc-400"
                        : "border-white/[0.04] text-zinc-600"
                  }`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-medium ${
                      active
                        ? "bg-amber-200/20 text-amber-100"
                        : done
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-white/[0.04] text-zinc-600"
                    }`}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className="font-medium tracking-tight">{step.label}</span>
                  {active && (
                    <LoaderCircle
                      className="ml-auto h-3.5 w-3.5 animate-spin text-amber-200/80"
                      strokeWidth={1.75}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 12 }).map((_, index) => (
              <motion.div
                key={index}
                className="aspect-video rounded-md bg-gradient-to-br from-zinc-800 to-zinc-900"
                animate={{
                  opacity: [0.25, 0.9, 0.35],
                  scale: [1, 1.02, 1],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: index * 0.12,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-zinc-500">
            <span className="text-amber-200/80">$</span> gemini.review | deepseek.star
            --portfolio
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-zinc-950/40 p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
          <div className="h-3 w-1/3 animate-pulse rounded-md bg-white/[0.08]" />
          <div className="h-2.5 w-1/2 animate-pulse rounded-md bg-white/[0.05]" />
          <div className="mt-4 space-y-2.5">
            <div className="h-2.5 w-full animate-pulse rounded-md bg-white/[0.06]" />
            <div className="h-2.5 w-[92%] animate-pulse rounded-md bg-white/[0.05]" />
            <div className="h-2.5 w-[85%] animate-pulse rounded-md bg-white/[0.04]" />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ResultState({
  result,
  contentUnlocked,
  onUnlockRequest,
  onRegisterExport,
}: {
  result: GenerateApiResponse;
  contentUnlocked: boolean;
  onUnlockRequest?: () => void;
  onRegisterExport?: (fn: (() => Promise<void>) | null) => void;
}) {
  const sections = result.sections ?? [];
  const exportRef = useRef<HTMLElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!contentUnlocked) {
      onUnlockRequest?.();
      return;
    }
    try {
      await navigator.clipboard.writeText(buildResumePlainText(result));
      setCopied(true);
      showToast("已复制到剪贴板");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("复制失败，请检查浏览器权限");
    }
  }, [contentUnlocked, onUnlockRequest, result, showToast]);

  const handleDownloadPdf = useCallback(async () => {
    if (!contentUnlocked) {
      onUnlockRequest?.();
      return;
    }

    const element = exportRef.current;
    if (!element || exporting) return;

    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const filename = `优化简历_MatchScore_${result.matchScore}.pdf`;

      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(element)
        .save();

      showToast("PDF 已开始下载");
    } catch {
      showToast("PDF 导出失败，请重试");
    } finally {
      setExporting(false);
    }
  }, [contentUnlocked, exporting, onUnlockRequest, result.matchScore, showToast]);

  useEffect(() => {
    onRegisterExport?.(handleDownloadPdf);
    return () => onRegisterExport?.(null);
  }, [handleDownloadPdf, onRegisterExport]);

  if (!sections.length) {
    return <EmptyState error="终版简历数据缺失，请重新生成" />;
  }

  const teaser = !contentUnlocked;
  const hasLockedContent =
    teaser &&
    (sections.length > 1 ||
      (sections.length === 1 && sections[0].items.length > 1));

  return (
    <motion.div
      key="result"
      {...panelMotion}
      className="flex w-full max-w-5xl flex-col gap-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.08 }}
        className="no-export"
      >
        <MatchScore
          score={result.matchScore}
          subtitle={result.matchSubtitle}
        />
      </motion.div>

      <div className="no-export mb-0 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-100"
        >
          {copied ? (
            <Check
              className="h-3.5 w-3.5 text-emerald-300"
              strokeWidth={1.75}
            />
          ) : (
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          复制纯文本
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={exporting}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-50 px-3 py-1.5 text-[12px] font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {exporting ? (
            <LoaderCircle
              className="h-3.5 w-3.5 animate-spin"
              strokeWidth={1.75}
            />
          ) : (
            <FileDown className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          {exporting ? "导出中..." : "下载 A4 PDF"}
        </button>
      </div>

      <div className="relative">
        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.18 }}
            className="min-w-0 flex-1"
          >
            <article
              id="resume-export-container"
              ref={exportRef}
              className="resume-a4-sheet rounded-2xl border border-zinc-200/80 p-7 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.55)] sm:p-8"
            >
              {result.targetRole ? (
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                  {result.targetRole}
                </h2>
              ) : null}

              <div className={result.targetRole ? "mt-6 space-y-8" : "space-y-8"}>
                {sections.map((section, sectionIndex) => (
                  <section key={section.id}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">
                        {section.title}
                      </h3>
                      <span className="text-[11px] tracking-[0.12em] text-zinc-400 uppercase">
                        {section.type}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {section.items.map((item, itemIndex) => {
                        const locked = isItemLocked(
                          sectionIndex,
                          itemIndex,
                          sections,
                          contentUnlocked,
                        );
                        return (
                          <div
                            key={item.id}
                            className={
                              locked
                                ? "pointer-events-none blur-md select-none opacity-60"
                                : ""
                            }
                            aria-hidden={locked}
                          >
                            <ResumeItemBlock item={item} />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          </motion.div>

          <div
            className={`no-export ${
              teaser
                ? "pointer-events-none blur-md select-none opacity-60"
                : ""
            }`}
            aria-hidden={teaser}
          >
            <AiInsights
              polishAdvice={result.gapAnalysis}
              interviewDefense={result.interviewDefense}
            />
          </div>
        </div>

        {hasLockedContent && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4">
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/20 to-zinc-950/55"
            />
            <button
              type="button"
              onClick={onUnlockRequest}
              className="pointer-events-auto group relative inline-flex max-w-md items-center justify-center gap-2 rounded-full bg-zinc-50 px-5 py-3.5 text-center text-[13.5px] font-medium tracking-tight text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.35),0_18px_50px_-12px_rgba(255,255,255,0.45)] transition-[transform,background-color] duration-300 hover:scale-[1.02] hover:bg-white active:scale-[0.985] sm:text-[14px]"
            >
              <Lock className="h-4 w-4 shrink-0" strokeWidth={1.85} aria-hidden />
              解锁完整简历解析与面试话术
            </button>
          </div>
        )}
      </div>

      <Toast message={toast} />
    </motion.div>
  );
}

type OutputPanelProps = {
  status: WorkspaceStatus;
  result: GenerateApiResponse | null;
  error?: string | null;
  loadingHint?: string;
  loadingVariant?: "default" | "portfolio";
  portfolioStep?: number;
  contentUnlocked?: boolean;
  onDeepDiveSubmit?: (answers: string[]) => void;
  onDeepDiveSkip?: () => void;
  onUnlockRequest?: () => void;
  onRegisterExport?: (fn: (() => Promise<void>) | null) => void;
};

export default function OutputPanel({
  status,
  result,
  error,
  loadingHint = "AI 正在对齐 JD 关键词...",
  loadingVariant = "default",
  portfolioStep = 0,
  contentUnlocked = false,
  onDeepDiveSubmit,
  onDeepDiveSkip,
  onUnlockRequest,
  onRegisterExport,
}: OutputPanelProps) {
  const showTopAligned =
    (status === "result" && Boolean(result?.sections?.length)) ||
    (status === "deepdive" && Boolean(result));

  return (
    <section className="relative flex min-h-0 flex-col bg-zinc-900/40">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04)_0%,transparent_55%)]" />

      <div
        className={`relative flex min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 ${
          showTopAligned
            ? "items-start justify-center"
            : "items-center justify-center"
        }`}
      >
        <AnimatePresence mode="wait">
          {status === "idle" && <EmptyState error={error} />}
          {status === "loading" && (
            <LoadingState
              hint={loadingHint}
              variant={loadingVariant}
              portfolioStep={portfolioStep}
            />
          )}
          {status === "deepdive" && result && (
            <DeepDivePanel
              questions={result.clarifyingQuestions}
              gapAnalysis={result.gapAnalysis}
              matchScore={result.matchScore}
              matchSubtitle={result.matchSubtitle}
              onSubmit={(answers) => onDeepDiveSubmit?.(answers)}
              onSkip={() => onDeepDiveSkip?.()}
            />
          )}
          {status === "result" && result && (
            <ResultState
              result={result}
              contentUnlocked={contentUnlocked}
              onUnlockRequest={onUnlockRequest}
              onRegisterExport={onRegisterExport}
            />
          )}
        </AnimatePresence>

        {status === "deepdive" && error && (
          <p className="absolute bottom-6 left-1/2 max-w-sm -translate-x-1/2 text-center text-[12px] text-amber-200/85">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
