"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import type {
  AssetBinding,
  AssetBindTarget,
  ParsedExperience,
  ResumeContact,
} from "@/lib/generateTypes";
import { normalizeContact } from "@/lib/resumeContact";
import FileDropzone, { type UploadedFile } from "./FileDropzone";
import ResumeUpload, { type ResumeUploadState } from "./ResumeUpload";

const fieldClassName =
  "w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-[14px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow,background-color] duration-300 hover:border-white/[0.1] hover:bg-white/[0.03] focus:border-white/20 focus:bg-white/[0.04] focus:shadow-[0_0_0_3px_rgba(255,255,255,0.06),0_0_32px_-8px_rgba(255,255,255,0.12)]";

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
  /**
   * 阶段1 解析快照：阶段2 增强必须直接使用，禁止后端二次切段。
   */
  experiencesSnapshot: ParsedExperience[];
  /** 作品 → 归属（经历 id 或 new） */
  assetBindings: AssetBinding[];
  /** 阶段1 从简历抽取的联系方式 */
  contact: ResumeContact;
};

type ParseStatus = "idle" | "loading" | "ready" | "error";

type InputPanelProps = {
  isGenerating?: boolean;
  onGenerate?: (payload: GeneratePayload) => void | Promise<void>;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  onGenerate,
}: InputPanelProps) {
  const [jd, setJd] = useState("");
  const [resumeState, setResumeState] = useState<ResumeUploadState>({
    status: "idle",
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [notes, setNotes] = useState("");
  const [experiences, setExperiences] = useState<ParsedExperience[]>([]);
  const [contact, setContact] = useState<ResumeContact>({});
  const [parseStatus, setParseStatus] = useState<ParseStatus>("idle");
  const [parseError, setParseError] = useState<string | null>(null);
  /** assetId → bindTo；默认 new */
  const [bindings, setBindings] = useState<Record<string, AssetBindTarget>>({});
  const parsedResumeUrlRef = useRef<string | null>(null);
  const parseAbortRef = useRef<AbortController | null>(null);

  const busy = isGenerating;

  // 文件增删时同步 bindings：新文件默认 new，移除的删掉
  useEffect(() => {
    setBindings((prev) => {
      const next: Record<string, AssetBindTarget> = {};
      for (const file of files) {
        next[file.id] = prev[file.id] ?? "new";
      }
      return next;
    });
  }, [files]);

  // 经历列表刷新后：若绑定指向已不存在的 id，回退为 new
  useEffect(() => {
    const validIds = new Set(experiences.map((item) => item.id));
    setBindings((prev) => {
      let changed = false;
      const next: Record<string, AssetBindTarget> = { ...prev };
      for (const [assetId, bindTo] of Object.entries(next)) {
        if (bindTo !== "new" && !validIds.has(bindTo)) {
          next[assetId] = "new";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [experiences]);

  const isUploading = useMemo(() => {
    if (resumeState.status === "uploading") return true;
    return files.some((file) => file.status === "uploading");
  }, [files, resumeState.status]);

  const resumeReady =
    resumeState.status === "ready" && Boolean(resumeState.asset.url);
  const jdReady = jd.trim().length > 0;
  const parseReady = parseStatus === "ready" && experiences.length > 0;
  const canGenerate =
    !busy && !isUploading && resumeReady && parseReady && jdReady;

  const generateBlockReason = useMemo(() => {
    if (busy) return null;
    if (isUploading) return "文件正在上传，请稍候";
    if (!resumeReady) return "请先上传简历";
    if (parseStatus === "loading") return "请等待简历解析完成";
    if (parseStatus === "error") return "简历解析失败，请重试后再生成";
    if (!parseReady) return "请等待简历解析完成";
    if (!jdReady) return "请先填写目标岗位 JD";
    return null;
  }, [
    busy,
    isUploading,
    jdReady,
    parseReady,
    parseStatus,
    resumeReady,
  ]);

  const parseExperiences = async (resumeUrl: string, resumeFileName: string) => {
    parseAbortRef.current?.abort();
    const controller = new AbortController();
    parseAbortRef.current = controller;

    setParseStatus("loading");
    setParseError(null);
    setExperiences([]);
    setContact({});

    try {
      const response = await fetch("/api/parse-experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          resumeUrl,
          resumeFileName,
          jdText: jd.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        experiences?: ParsedExperience[];
        contact?: ResumeContact;
        error?: string;
        detail?: string;
      } | null;

      if (!response.ok) {
        const detail = payload?.detail ? `：${payload.detail}` : "";
        throw new Error(
          `${payload?.error ?? `解析失败（${response.status}）`}${detail}`,
        );
      }

      const list = Array.isArray(payload?.experiences)
        ? payload.experiences
        : [];
      if (!list.length) {
        throw new Error("未识别到经历段落");
      }

      setExperiences(list);
      setContact(normalizeContact(payload?.contact ?? {}));
      setParseStatus("ready");
      parsedResumeUrlRef.current = resumeUrl;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setExperiences([]);
      setContact({});
      setParseStatus("error");
      setParseError(
        err instanceof Error && err.message
          ? err.message
          : "解析经历失败，请重试",
      );
      parsedResumeUrlRef.current = null;
    }
  };

  // 简历直传成功后自动切段；换简历则清空旧快照并重新解析
  useEffect(() => {
    if (resumeState.status !== "ready") {
      if (resumeState.status === "idle" || resumeState.status === "uploading") {
        parseAbortRef.current?.abort();
        setExperiences([]);
        setContact({});
        setParseStatus("idle");
        setParseError(null);
        parsedResumeUrlRef.current = null;
      }
      return;
    }

    const { url, name } = resumeState.asset;
    if (parsedResumeUrlRef.current === url && parseStatus === "ready") {
      return;
    }

    void parseExperiences(url, name);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在简历 ready/url 变化时触发；JD 变更不强制重切
  }, [resumeState]);

  useEffect(() => {
    return () => parseAbortRef.current?.abort();
  }, []);

  const buildPayload = (): GeneratePayload => {
    const resumeUrl =
      resumeState.status === "ready" ? resumeState.asset.url : null;
    const resumeFileName =
      resumeState.status === "ready" ? resumeState.asset.name : null;

    const readyFiles = files.filter(
      (file) => file.status === "ready" && file.url,
    );

    const assetUrls: GenerateAssetRef[] = readyFiles.map((file) => ({
      name: file.name,
      url: file.url as string,
      size: file.size,
    }));

    const assetBindings: AssetBinding[] = readyFiles.map((file) => ({
      assetId: file.id,
      name: file.name,
      url: file.url as string,
      size: file.size,
      bindTo: bindings[file.id] ?? "new",
    }));

    return {
      jdText: jd.trim(),
      experienceText: buildExperienceText(files, notes),
      resumeUrl,
      resumeFileName,
      assetUrls,
      userNotes: notes.trim(),
      experiencesSnapshot: experiences,
      assetBindings,
      contact,
    };
  };

  const handleBindingChange = (assetId: string, bindTo: AssetBindTarget) => {
    setBindings((prev) => ({ ...prev, [assetId]: bindTo }));
  };

  return (
    <section className="relative flex min-h-0 flex-col border-b border-white/[0.06] bg-zinc-950 md:border-r md:border-b-0 md:border-white/[0.06]">
      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6 pb-36 sm:px-7 sm:pt-8">
        <header className="mb-5 shrink-0">
          <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-zinc-100 sm:text-xl">
            输入你的素材
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            简历与目标 JD 必填；作品可选，可绑定到某条经历或标为新项目。
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

            {resumeState.status === "ready" && (
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                {parseStatus === "loading" && (
                  <p className="flex items-center gap-2 text-[12.5px] text-zinc-400">
                    <LoaderCircle
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={1.75}
                    />
                    正在解析简历经历，供作品配对…
                  </p>
                )}
                {parseStatus === "error" && (
                  <div className="space-y-2">
                    <p className="text-[12.5px] leading-relaxed text-amber-200/85">
                      {parseError || "解析经历失败"}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (resumeState.status === "ready") {
                          void parseExperiences(
                            resumeState.asset.url,
                            resumeState.asset.name,
                          );
                        }
                      }}
                      className="text-[12px] font-medium text-zinc-300 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
                    >
                      重试解析
                    </button>
                  </div>
                )}
                {parseStatus === "ready" && experiences.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[12px] text-zinc-400">
                      已识别 {experiences.length} 段经历
                    </p>
                    <ol className="space-y-1.5">
                      {experiences.map((exp) => (
                        <li
                          key={exp.id}
                          className="text-[12.5px] leading-snug text-zinc-300"
                        >
                          <span className="min-w-0 truncate block">{exp.title}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-zinc-500 uppercase">
              项目文件
            </span>
            <FileDropzone
              files={files}
              onFilesChange={setFiles}
              disabled={busy}
              experiences={experiences}
              bindings={bindings}
              onBindingChange={handleBindingChange}
            />
            {files.some((file) => file.status === "ready") &&
              parseStatus !== "ready" && (
                <p className="text-[12px] text-zinc-500">
                  {parseStatus === "loading"
                    ? "经历列表解析中，完成后可改选归属；当前默认为「新项目」"
                    : "尚未识别简历经历时，作品默认归属「新项目」；解析成功后可改选对应经历"}
                </p>
              )}
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
          {isUploading ? (
            <p className="text-center text-[12px] text-zinc-500">
              文件正在上传，完成后即可生成
            </p>
          ) : generateBlockReason ? (
            <p className="text-center text-[12px] text-zinc-500">
              {generateBlockReason}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (!canGenerate) return;
              void onGenerate?.(buildPayload());
            }}
            disabled={!canGenerate}
            title={generateBlockReason ?? "根据 JD 与简历生成匹配简历"}
            className="group relative inline-flex w-full max-w-xl items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 disabled:cursor-not-allowed"
          >
            <span
              aria-hidden
              className="absolute -inset-3 rounded-full bg-white/0 blur-xl transition-all duration-500 group-hover:bg-white/[0.12] group-disabled:opacity-0"
            />
            <span className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-50 px-6 py-3 text-[13.5px] font-medium tracking-tight text-zinc-950 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_12px_36px_-12px_rgba(255,255,255,0.28)] transition-[transform,background-color,opacity] duration-300 group-hover:scale-[1.02] group-hover:bg-white group-active:scale-[0.98] group-disabled:scale-100 group-disabled:bg-zinc-300 group-disabled:opacity-80 sm:px-7">
              {isGenerating ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin text-zinc-700"
                  strokeWidth={1.75}
                />
              ) : (
                <Sparkles className="h-4 w-4 text-zinc-700" strokeWidth={1.75} />
              )}
              {isGenerating ? "生成中..." : "生成匹配简历"}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
