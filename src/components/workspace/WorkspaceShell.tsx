"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FileDown } from "lucide-react";
import type {
  ClarifyingAnswer,
  GenerateApiResponse,
} from "@/lib/generateTypes";
import {
  VIP_DAILY_CAP_MESSAGE,
  checkGenerationAccess,
  consumeFinalGeneration,
  isContentUnlocked,
  isDevBypassEnabled,
  isVip,
} from "@/lib/usage";
import PaywallModal from "@/components/PaywallModal";
import InputPanel, { type GeneratePayload } from "./InputPanel";
import OutputPanel from "./OutputPanel";
import Toast from "./Toast";
import type { WorkspaceStatus } from "./types";

const REQUEST_TIMEOUT_MS = 90_000;
const PORTFOLIO_TIMEOUT_MS = 120_000;
/** Gemini 视觉阶段展示时长后切到 DeepSeek 文案 */
const PORTFOLIO_STAGE_FLIP_MS = 14_000;
const CODE_PURCHASE_URL = "https://m.tb.cn/resumeai-pro";

type SessionPayload = {
  jdText: string;
  experienceText: string;
  resumeUrl: string | null;
  resumeFileName: string | null;
  assetUrls: GeneratePayload["assetUrls"];
  userNotes: string;
  experiencesSnapshot: GeneratePayload["experiencesSnapshot"];
  questions: string[];
};

function isGenerateApiResponse(data: unknown): data is GenerateApiResponse {
  if (!data || typeof data !== "object") return false;
  const value = data as GenerateApiResponse;
  if (value.phase === "deepdive") {
    return (
      typeof value.matchScore === "number" &&
      typeof value.gapAnalysis === "string" &&
      Array.isArray(value.clarifyingQuestions) &&
      value.clarifyingQuestions.length > 0
    );
  }
  if (value.phase === "result") {
    return (
      typeof value.matchScore === "number" &&
      typeof value.gapAnalysis === "string" &&
      typeof value.interviewDefense === "string" &&
      Array.isArray(value.sections) &&
      value.sections.length > 0
    );
  }
  return false;
}

export default function WorkspaceShell() {
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [result, setResult] = useState<GenerateApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [contentUnlocked, setContentUnlocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "alert">(
    "default",
  );
  const [loadingHint, setLoadingHint] = useState("AI 正在对齐 JD 关键词...");
  const [loadingVariant, setLoadingVariant] = useState<"default" | "portfolio">(
    "default",
  );
  const [portfolioStep, setPortfolioStep] = useState(0);
  const [isAnalyzingPortfolio, setIsAnalyzingPortfolio] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<SessionPayload | null>(null);
  const exportHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const canExport = status === "result" && Boolean(result?.sections?.length);

  const refreshUnlockState = useCallback(() => {
    setContentUnlocked(isContentUnlocked());
  }, []);

  useEffect(() => {
    refreshUnlockState();
  }, [refreshUnlockState]);

  useEffect(() => {
    if (!isAnalyzingPortfolio) {
      setPortfolioStep(0);
      return;
    }
    setPortfolioStep(0);
    setLoadingHint("正在让 Gemini 视觉引擎审阅您的作品…");
    const flipId = window.setTimeout(() => {
      setPortfolioStep(1);
      setLoadingHint("正在让 DeepSeek 重构 STAR 简历…");
    }, PORTFOLIO_STAGE_FLIP_MS);
    return () => window.clearTimeout(flipId);
  }, [isAnalyzingPortfolio]);

  const showToast = useCallback(
    (
      message: string,
      options?: { durationMs?: number; variant?: "default" | "alert" },
    ) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToastVariant(options?.variant ?? "default");
      setToast(message);
      toastTimer.current = setTimeout(
        () => setToast(null),
        options?.durationMs ?? 2200,
      );
    },
    [],
  );

  /** 鉴权：不扣费，仅拦截无额度 / VIP 日上限 */
  const guardAccess = useCallback(() => {
    const gate = checkGenerationAccess();
    if (gate.allowed) return true;
    if (gate.reason === "vip_daily_cap") {
      showToast(`🚨 ${VIP_DAILY_CAP_MESSAGE}`, {
        durationMs: 5600,
        variant: "alert",
      });
      return false;
    }
    setIsPaywallOpen(true);
    return false;
  }, [showToast]);

  const openPaywall = useCallback(() => {
    setIsPaywallOpen(true);
  }, []);

  const requestGenerate = useCallback(
    async (options: {
      payload: GeneratePayload;
      isFinal: boolean;
      clarifyingAnswers?: ClarifyingAnswer[];
    }) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      try {
        // 仅传文本 + Blob URL，不再附带文件本体（规避 4.5MB Payload）
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            jdText: options.payload.jdText,
            experienceText: options.payload.experienceText,
            isFinal: options.isFinal,
            resumeUrl: options.payload.resumeUrl,
            resumeFileName: options.payload.resumeFileName,
            assetUrls: options.payload.assetUrls,
            clarifyingAnswers: options.clarifyingAnswers ?? [],
          }),
        });

        const payloadJson = (await response.json().catch(() => null)) as
          | (GenerateApiResponse & { error?: string; detail?: string })
          | null;

        if (!response.ok) {
          const detail = payloadJson?.detail
            ? `：${payloadJson.detail}`
            : "";
          throw new Error(
            `${payloadJson?.error ?? `请求失败（${response.status}）`}${detail}`,
          );
        }

        if (!isGenerateApiResponse(payloadJson)) {
          throw new Error("返回数据格式异常，请重试一次");
        }

        return payloadJson;
      } finally {
        window.clearTimeout(timeoutId);
      }
    },
    [],
  );

  const handleAnalyzePortfolio = useCallback(
    async (payload: GeneratePayload) => {
      if (status === "loading") return;
      if (!guardAccess()) return;

      const portfolioAsset =
        payload.assetUrls.find((item) =>
          /\.(mp4|mov|webm|pdf|pptx)$/i.test(item.name),
        ) ?? payload.assetUrls[0];

      if (!portfolioAsset?.url) {
        setError("请先上传并直传成功视频或 PDF / PPTX 作品集文件");
        return;
      }

      refreshUnlockState();
      setIsAnalyzingPortfolio(true);
      setLoadingVariant("portfolio");
      setLoadingHint("正在让 Gemini 视觉引擎审阅您的作品…");
      setError(null);
      setStatus("loading");
      setResult(null);

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(
          () => controller.abort(),
          PORTFOLIO_TIMEOUT_MS,
        );

        let data: GenerateApiResponse;
        try {
          const response = await fetch("/api/analyze-portfolio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              url: portfolioAsset.url,
              fileName: portfolioAsset.name,
              jdText: payload.jdText,
              userNotes: payload.userNotes || payload.experienceText,
              assets: payload.assetUrls,
            }),
          });

          const payloadJson = (await response.json().catch(() => null)) as
            | (GenerateApiResponse & { error?: string; detail?: string })
            | null;

          if (!response.ok) {
            const detail = payloadJson?.detail
              ? `：${payloadJson.detail}`
              : "";
            throw new Error(
              `${payloadJson?.error ?? `解析失败（${response.status}）`}${detail}`,
            );
          }

          if (!isGenerateApiResponse(payloadJson)) {
            throw new Error("作品集返回数据格式异常，请重试一次");
          }
          data = payloadJson;
        } finally {
          window.clearTimeout(timeoutId);
        }

        // 【扣费节点】作品集终版成功后计费（与深度重组一致）
        consumeFinalGeneration();

        setResult({
          ...data,
          matchSubtitle:
            data.matchSubtitle?.trim() ||
            "作品集视觉解析完成 · 解锁查看完整 STAR",
        });
        setStatus("result");
        refreshUnlockState();
      } catch (err) {
        let message = "作品集解析失败，请稍后重试";
        if (err instanceof DOMException && err.name === "AbortError") {
          message = "请求超时，请检查网络后重试";
        } else if (err instanceof TypeError) {
          message = "网络异常，无法连接服务器";
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }
        setError(message);
        setResult(null);
        setStatus("idle");
      } finally {
        setIsAnalyzingPortfolio(false);
        setLoadingVariant("default");
      }
    },
    [guardAccess, refreshUnlockState, status],
  );

  const handleGenerate = useCallback(
    async (payload: GeneratePayload) => {
      if (status === "loading") return;
      if (!guardAccess()) return;

      refreshUnlockState();
      setIsAnalyzingPortfolio(false);
      setLoadingVariant("default");
      setError(null);
      setStatus("loading");
      setResult(null);

      try {
        if (isVip()) {
          // VIP：两步深挖（Gap 不计费）
          setLoadingHint("AI 正在做 Gap 分析并准备追问...");
          const data = await requestGenerate({
            payload,
            isFinal: false,
          });

          sessionRef.current = {
            jdText: payload.jdText,
            experienceText: payload.experienceText,
            resumeUrl: payload.resumeUrl,
            resumeFileName: payload.resumeFileName,
            assetUrls: payload.assetUrls,
            userNotes: payload.userNotes,
            experiencesSnapshot: payload.experiencesSnapshot,
            questions: data.clarifyingQuestions,
          };

          setResult({
            ...data,
            matchSubtitle: data.matchSubtitle?.trim() || "仍有关键细节待补充",
          });
          setStatus("deepdive");
          return;
        }

        // Freemium：跳过追问，一次性基础版重组 → 直接出结果
        setLoadingHint("AI 正在重组基础版简历...");
        const data = await requestGenerate({
          payload,
          isFinal: true,
        });

        // 【扣费节点】免费基础版终版成功后计费
        consumeFinalGeneration();

        setResult({
          ...data,
          matchSubtitle:
            data.matchSubtitle?.trim() || "基础版已生成 · 解锁查看完整解析",
        });
        setStatus("result");
        refreshUnlockState();
      } catch (err) {
        let message = "生成失败，请稍后重试";
        if (err instanceof DOMException && err.name === "AbortError") {
          message = "请求超时，请检查网络后重试";
        } else if (err instanceof TypeError) {
          message = "网络异常，无法连接服务器";
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }
        setError(message);
        setResult(null);
        setStatus("idle");
      }
    },
    [guardAccess, refreshUnlockState, requestGenerate, status],
  );

  const handleDeepDiveSubmit = useCallback(
    async (answers: string[]) => {
      const session = sessionRef.current;
      if (!session || status === "loading") return;
      if (!guardAccess()) return;

      const clarifyingAnswers: ClarifyingAnswer[] = session.questions.map(
        (question, index) => ({
          question,
          answer: answers[index] ?? "",
        }),
      );

      setLoadingHint("正在把细节揉进终版 STAR...");
      setStatus("loading");

      try {
        const data = await requestGenerate({
          payload: {
            jdText: session.jdText,
            experienceText: session.experienceText,
            resumeUrl: session.resumeUrl,
            resumeFileName: session.resumeFileName,
            assetUrls: session.assetUrls,
            userNotes: session.userNotes,
            experiencesSnapshot: session.experiencesSnapshot,
          },
          isFinal: true,
          clarifyingAnswers,
        });

        // 【扣费节点】VIP 终版成功后计入每日用量
        consumeFinalGeneration();

        setResult({
          ...data,
          matchSubtitle: data.matchSubtitle?.trim() || "已完成 JD 对齐分析",
        });
        setStatus("result");
        refreshUnlockState();
      } catch (err) {
        let message = "终版生成失败，请重试";
        if (err instanceof DOMException && err.name === "AbortError") {
          message = "请求超时，请检查网络后重试";
        } else if (err instanceof TypeError) {
          message = "网络异常，无法连接服务器";
        } else if (err instanceof Error && err.message) {
          message = err.message;
        }
        setError(message);
        setStatus("deepdive");
      }
    },
    [guardAccess, refreshUnlockState, requestGenerate, status],
  );

  const handleDeepDiveSkip = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    void handleDeepDiveSubmit(session.questions.map(() => ""));
  }, [handleDeepDiveSubmit]);

  const handleNavExport = useCallback(() => {
    if (!canExport) return;
    if (!contentUnlocked) {
      openPaywall();
      return;
    }
    void exportHandlerRef.current?.()?.catch(() => {
      showToast("PDF 导出失败，请重试");
    });
  }, [canExport, contentUnlocked, openPaywall, showToast]);

  const handleRegisterExport = useCallback((fn: (() => Promise<void>) | null) => {
    exportHandlerRef.current = fn;
  }, []);

  const handleGetCode = useCallback(() => {
    showToast("正在跳转购买页...");
    window.setTimeout(() => {
      window.open(CODE_PURCHASE_URL, "_blank", "noopener,noreferrer");
    }, 350);
  }, [showToast]);

  const handleRedeemSuccess = useCallback(
    (type: "onetime" | "vip") => {
      setIsPaywallOpen(false);
      refreshUnlockState();
      showToast(
        type === "onetime"
          ? "单次卡已生效：全文已解锁，并可再生成 1 份终版"
          : "VIP 月卡已激活，完整内容与导出已解锁",
      );
    },
    [refreshUnlockState, showToast],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-zinc-100 transition-colors hover:text-white"
          >
            ResumeAI
          </Link>
          {isDevBypassEnabled() && (
            <span
              title="开发旁路已开启：跳过付费墙与次数限制。测付费墙请设 NEXT_PUBLIC_DEV_BYPASS_PAYWALL=false"
              className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-emerald-300/90"
            >
              DEV UNLOCK
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={!canExport}
          aria-disabled={!canExport}
          title={
            !canExport
              ? "生成结果后可导出"
              : contentUnlocked
                ? "导出 PDF"
                : "解锁后可导出"
          }
          onClick={handleNavExport}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
            canExport
              ? "cursor-pointer border-white/15 bg-white/[0.06] text-zinc-200 hover:border-white/25 hover:bg-white/[0.1] hover:text-white"
              : "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-zinc-600"
          }`}
        >
          <FileDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          导出 PDF
        </button>
      </header>

      <main className="relative grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <InputPanel
          isGenerating={status === "loading" && !isAnalyzingPortfolio}
          isAnalyzingPortfolio={isAnalyzingPortfolio}
          onGenerate={handleGenerate}
          onAnalyzePortfolio={handleAnalyzePortfolio}
        />
        <OutputPanel
          status={status}
          result={result}
          error={error}
          loadingHint={loadingHint}
          loadingVariant={loadingVariant}
          portfolioStep={portfolioStep}
          contentUnlocked={contentUnlocked}
          onDeepDiveSubmit={handleDeepDiveSubmit}
          onDeepDiveSkip={handleDeepDiveSkip}
          onUnlockRequest={openPaywall}
          onRegisterExport={handleRegisterExport}
        />
      </main>

      <PaywallModal
        open={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        onGetCode={handleGetCode}
        onRedeemSuccess={handleRedeemSuccess}
      />
      <Toast message={toast} variant={toastVariant} />
    </div>
  );
}
