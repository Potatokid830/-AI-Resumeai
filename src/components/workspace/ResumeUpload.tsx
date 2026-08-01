"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudUpload, FileText, LoaderCircle, RefreshCw, X } from "lucide-react";
import { uploadFileToBlob } from "@/lib/blobClientUpload";

const ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
const MAX_BYTES = 100 * 1024 * 1024;

export type ResumeBlobAsset = {
  name: string;
  size: number;
  url: string;
};

export type ResumeUploadState =
  | { status: "idle" }
  | {
      status: "uploading";
      name: string;
      size: number;
      progress: number;
      phase?: "uploading" | "finalizing";
    }
  | { status: "ready"; asset: ResumeBlobAsset }
  | { status: "error"; name: string; size: number; message: string };

function getExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ResumeUploadProps = {
  state: ResumeUploadState;
  onStateChange: (state: ResumeUploadState) => void;
  disabled?: boolean;
};

export default function ResumeUpload({
  state,
  onStateChange,
  disabled = false,
}: ResumeUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const startUpload = async (incoming: File) => {
    const ext = getExtension(incoming.name);
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
      setLocalError("仅支持 .pdf / .doc / .docx");
      return;
    }
    if (incoming.size > MAX_BYTES) {
      setLocalError("简历文件不能超过 100MB");
      return;
    }

    setLocalError(null);
    onStateChange({
      status: "uploading",
      name: incoming.name,
      size: incoming.size,
      progress: 0,
    });

    try {
      const blob = await uploadFileToBlob(incoming, {
        folder: "resumes",
        onProgress: ({ percentage, phase }) => {
          onStateChange({
            status: "uploading",
            name: incoming.name,
            size: incoming.size,
            progress: Math.round(percentage),
            phase,
          });
        },
      });

      onStateChange({
        status: "ready",
        asset: {
          name: incoming.name,
          size: incoming.size,
          url: blob.url,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "直传失败，请重试";
      onStateChange({
        status: "error",
        name: incoming.name,
        size: incoming.size,
        message,
      });
    }
  };

  const handleBrowse = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void startUpload(file);
    event.target.value = "";
  };

  const openPicker = () => {
    if (!disabled && state.status !== "uploading") inputRef.current?.click();
  };

  const isUploading = state.status === "uploading";
  const readyAsset = state.status === "ready" ? state.asset : null;
  const fileMeta =
    state.status === "uploading" || state.status === "error"
      ? { name: state.name, size: state.size }
      : readyAsset
        ? { name: readyAsset.name, size: readyAsset.size }
        : null;
  const displayError =
    localError || (state.status === "error" ? state.message : null);

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        disabled={disabled || isUploading}
        className="sr-only"
        onChange={handleBrowse}
      />

      <AnimatePresence mode="wait" initial={false}>
        {state.status === "idle" ? (
          <motion.button
            key="empty"
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            onClick={openPicker}
            disabled={disabled}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-3.5 text-left transition-colors hover:border-white/20 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300">
              <CloudUpload className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium tracking-tight text-zinc-200">
                上传个人简历原件
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                选择后直传云端 · 支持大文件（最大 100MB）
              </span>
            </span>
          </motion.button>
        ) : (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-950/60 text-zinc-300">
                {isUploading ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-medium tracking-tight text-zinc-100"
                  title={fileMeta?.name}
                >
                  {fileMeta?.name}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {isUploading
                    ? state.phase === "finalizing"
                      ? "正在确认云端写入…"
                      : `正在直传云端 ${state.progress}%`
                    : formatFileSize(fileMeta?.size ?? 0)}
                  {state.status === "ready" && " · 已就绪"}
                </p>
              </div>

              {!isUploading && (
                <>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={openPicker}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-2.5 text-[11px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
                    替换
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label="删除简历文件"
                    onClick={() => {
                      setLocalError(null);
                      onStateChange({ status: "idle" });
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </>
              )}
            </div>

            {isUploading && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>直传进度</span>
                  <span>{state.progress}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full bg-zinc-100"
                    initial={{ width: 0 }}
                    animate={{ width: `${state.progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {displayError && (
        <p className="text-[12px] text-amber-200/85" role="alert">
          {displayError}
        </p>
      )}
    </div>
  );
}
