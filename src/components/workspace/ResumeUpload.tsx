"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, RefreshCw, Upload, X } from "lucide-react";

const ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

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
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  error?: string | null;
};

export default function ResumeUpload({
  file,
  onFileChange,
  disabled = false,
  error,
}: ResumeUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateAndSet = (incoming: File | undefined) => {
    if (!incoming) return;

    const ext = getExtension(incoming.name);
    if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
      setLocalError("仅支持 .pdf / .doc / .docx");
      return;
    }
    if (incoming.size > MAX_BYTES) {
      setLocalError("简历文件不能超过 10MB");
      return;
    }

    setLocalError(null);
    onFileChange(incoming);
  };

  const handleBrowse = (event: ChangeEvent<HTMLInputElement>) => {
    validateAndSet(event.target.files?.[0]);
    event.target.value = "";
  };

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const displayError = localError || error;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={handleBrowse}
      />

      <AnimatePresence mode="wait" initial={false}>
        {!file ? (
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
              <Upload className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium tracking-tight text-zinc-200">
                上传个人简历原件
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                支持 .pdf / .doc / .docx（最大 10MB）
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
            className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-950/60 text-zinc-300">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium tracking-tight text-zinc-100" title={file.name}>
                {file.name}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {formatFileSize(file.size)}
              </p>
            </div>

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
                onFileChange(null);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
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
