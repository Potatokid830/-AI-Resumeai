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
  isVip,
} from "@/lib/usage";
import PaywallModal from "@/components/PaywallModal";
import InputPanel, { type GeneratePayload } from "./InputPanel";
import OutputPanel from "./OutputPanel";
import Toast from "./Toast";
import type { WorkspaceStatus } from "./types";

const REQUEST_TIMEOUT_MS = 90_000;
const CODE_PURCHASE_URL = "https://m.tb.cn/resumeai-pro";

type SessionPayload = {
  jdText: string;
  experienceText: string;
  resumeFile: File | null;
  resumeText: string;
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
      typeof value.optimizedResume === "object" &&
      value.optimizedResume !== null &&
      Array.isArray(value.optimizedResume.bullets)
    );
  }
  return false;
}

export default function WorkspaceShell() {
  const [status, setStatus] = useState<WorkspaceStatus>("idle");
  const [result, setResult] = useState<GenerateApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isVipUser, setIsVipUser] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"default" | "alert">(
    "default",
  );
  const [loadingHint, setLoadingHint] = useState("AI 正在对齐 JD 关键词...");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<SessionPayload | null>(null);
  const exportHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const canExport = status === "result" && Boolean(result?.optimizedResume);

  useEffect(() => {
    setIsVipUser(isVip());
  }, []);

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
      resumeText?: string;
    }) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      try {
        const formData = new FormData();
        formData.append("jdText", options.payload.jdText);
        formData.append("experienceText", options.payload.experienceText);
        formData.append("isFinal", options.isFinal ? "true" : "false");

        if (options.resumeText) {
          formData.append("resumeText", options.resumeText);
        } else if (options.payload.resumeFile) {
          formData.append(
            "resumeFile",
            options.payload.resumeFile,
            options.payload.resumeFile.name,
          );
        }

        if (options.clarifyingAnswers?.length) {
          formData.append(
            "clarifyingAnswers",
            JSON.stringify(options.clarifyingAnswers),
          );
        }

        const response = await fetch("/api/generate", {
          method: "POST",
          body: formData,
          signal: controller.signal,
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

  const handleGenerate = useCallback(
    async (payload: GeneratePayload) => {
      if (status === "loading") return;
      if (!guardAccess()) return;

      const vip = isVip();
      setIsVipUser(vip);
      setError(null);
      setStatus("loading");
      setResult(null);

      try {
        if (vip) {
          // VIP：两步深挖（Gap 不计费）
          setLoadingHint("AI 正在做 Gap 分析并准备追问...");
          const data = await requestGenerate({
            payload,
            isFinal: false,
          });

          sessionRef.current = {
            jdText: payload.jdText,
            experienceText: payload.experienceText,
            resumeFile: payload.resumeFile,
            resumeText: "",
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
          matchSubtitle: data.matchSubtitle?.trim() || "基础版已生成 · 解锁查看完整解析",
        });
        setStatus("result");
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
    [guardAccess, requestGenerate, status],
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
            resumeFile: session.resumeFile,
          },
          isFinal: true,
          clarifyingAnswers,
          resumeText: session.resumeText || undefined,
        });

        // 【扣费节点】VIP 终版成功后计入每日用量
        consumeFinalGeneration();

        setResult({
          ...data,
          matchSubtitle: data.matchSubtitle?.trim() || "已完成 JD 对齐分析",
        });
        setStatus("result");
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
    [guardAccess, requestGenerate, status],
  );

  const handleDeepDiveSkip = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    void handleDeepDiveSubmit(session.questions.map(() => ""));
  }, [handleDeepDiveSubmit]);

  const handleNavExport = useCallback(() => {
    if (!canExport) return;
    if (!isVipUser) {
      openPaywall();
      return;
    }
    void exportHandlerRef.current?.();
  }, [canExport, isVipUser, openPaywall]);

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
      setIsVipUser(isVip());
      showToast(
        type === "onetime"
          ? "单次卡已到账，可再生成 1 份终版简历"
          : "VIP 月卡已激活，完整内容与导出已解锁",
      );
    },
    [showToast],
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-50">
      <header className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5 sm:px-6">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-zinc-100 transition-colors hover:text-white"
        >
          ResumeAI
        </Link>

        <button
          type="button"
          disabled={!canExport}
          aria-disabled={!canExport}
          title={
            !canExport
              ? "生成结果后可导出"
              : isVipUser
                ? "导出 PDF"
                : "VIP 专属导出"
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
          isGenerating={status === "loading"}
          onGenerate={handleGenerate}
        />
        <OutputPanel
          status={status}
          result={result}
          error={error}
          loadingHint={loadingHint}
          isVip={isVipUser}
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
