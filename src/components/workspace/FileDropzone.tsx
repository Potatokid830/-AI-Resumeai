"use client";

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CloudUpload,
  FileText,
  FileType2,
  LoaderCircle,
  Presentation,
  X,
} from "lucide-react";
import { uploadFileToBlob } from "@/lib/blobClientUpload";

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".pptx",
  ".docx",
  ".xlsx",
  ".csv",
  ".mp4",
  ".webm",
  ".mov",
] as const;
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");
const MAX_BYTES = 100 * 1024 * 1024;

export type UploadedFile = {
  id: string;
  name: string;
  size: number;
  extension: string;
  status: "uploading" | "ready" | "error";
  progress: number;
  url?: string;
  error?: string;
};

function getExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function isAcceptedFile(file: File) {
  const ext = getExtension(file.name);
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateFileName(name: string, max = 22) {
  if (name.length <= max) return name;
  const ext = getExtension(name);
  const base = ext ? name.slice(0, -ext.length) : name;
  const keep = Math.max(8, max - ext.length - 1);
  return `${base.slice(0, keep)}…${ext}`;
}

function FileIcon({
  extension,
  uploading,
}: {
  extension: string;
  uploading?: boolean;
}) {
  const className = "h-4 w-4 shrink-0 text-zinc-300";
  if (uploading) {
    return <LoaderCircle className={`${className} animate-spin`} strokeWidth={1.75} />;
  }
  if (extension === ".pdf") return <FileText className={className} strokeWidth={1.75} />;
  if (extension === ".pptx")
    return <Presentation className={className} strokeWidth={1.75} />;
  return <FileType2 className={className} strokeWidth={1.75} />;
}

type FileDropzoneProps = {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
};

export default function FileDropzone({
  files,
  onFilesChange,
  disabled = false,
}: FileDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragDepth = useRef(0);
  const filesRef = useRef(files);
  filesRef.current = files;

  const patchFile = useCallback(
    (id: string, patch: Partial<UploadedFile>) => {
      const next = filesRef.current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      filesRef.current = next;
      onFilesChange(next);
    },
    [onFilesChange],
  );

  const uploadOne = useCallback(
    async (id: string, file: File) => {
      try {
        const blob = await uploadFileToBlob(file, {
          folder: "assets",
          onProgress: ({ percentage }) => {
            patchFile(id, {
              status: "uploading",
              progress: Math.round(percentage),
            });
          },
        });
        patchFile(id, {
          status: "ready",
          progress: 100,
          url: blob.url,
          error: undefined,
        });
      } catch (err) {
        patchFile(id, {
          status: "error",
          progress: 0,
          error: err instanceof Error ? err.message : "直传失败",
        });
      }
    },
    [patchFile],
  );

  const ingestFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (!list.length) return;

      const staged: { meta: UploadedFile; file: File }[] = [];
      let message: string | null = null;

      for (const file of list) {
        if (!isAcceptedFile(file)) {
          message = "支持 pdf / pptx / docx / xlsx / csv / 视频";
          continue;
        }
        if (file.size > MAX_BYTES) {
          message = "单个文件不能超过 100MB";
          continue;
        }
        const already = filesRef.current.some(
          (item) => item.name === file.name && item.size === file.size,
        );
        if (already) continue;

        const id = `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
        staged.push({
          file,
          meta: {
            id,
            name: file.name,
            size: file.size,
            extension: getExtension(file.name),
            status: "uploading",
            progress: 0,
          },
        });
      }

      setError(message);
      if (!staged.length) return;

      const next = [...filesRef.current, ...staged.map((item) => item.meta)];
      filesRef.current = next;
      onFilesChange(next);

      for (const item of staged) {
        void uploadOne(item.meta.id, item.file);
      }
    },
    [onFilesChange, uploadOne],
  );

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (disabled) return;
    ingestFiles(event.dataTransfer.files);
  };

  const handleBrowse = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) ingestFiles(event.target.files);
    event.target.value = "";
  };

  const removeFile = (id: string) => {
    const next = files.filter((file) => file.id !== id);
    filesRef.current = next;
    onFilesChange(next);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <motion.div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="上传项目文件"
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        animate={
          isDragging
            ? {
                scale: 1.01,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: "rgba(250,250,250,0.45)",
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.08), 0 0 48px -12px rgba(255,255,255,0.22)",
              }
            : {
                scale: 1,
                backgroundColor: "rgba(255,255,255,0.02)",
                borderColor: "rgba(255,255,255,0.12)",
                boxShadow: "0 0 0 0 rgba(0,0,0,0)",
              }
        }
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className={`relative flex min-h-[148px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-7 text-center outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-white/[0.035]"
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={handleBrowse}
        />

        <motion.div
          animate={{
            y: isDragging ? -2 : 0,
            opacity: isDragging ? 1 : 0.9,
          }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center"
        >
          <div
            className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border ${
              isDragging
                ? "border-white/20 bg-white/10"
                : "border-white/[0.08] bg-white/[0.03]"
            }`}
          >
            <CloudUpload
              className={`h-5 w-5 ${isDragging ? "text-zinc-100" : "text-zinc-400"}`}
              strokeWidth={1.6}
              aria-hidden
            />
          </div>

          <p className="max-w-[280px] text-[13px] leading-relaxed tracking-tight text-zinc-300">
            {isDragging
              ? "松开即可直传云端"
              : "拖拽大文件至此，将直传 Vercel Blob（绕过 4.5MB 限制）"}
          </p>
          <p className="mt-2 text-[11px] text-zinc-600">
            pdf / pptx / docx / xlsx / csv / 视频 · 最大 100MB
          </p>
        </motion.div>
      </motion.div>

      {error && (
        <p className="text-[12px] text-amber-200/80" role="alert">
          {error}
        </p>
      )}

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2"
          >
            {files.map((file) => (
              <motion.li
                key={file.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 8, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-zinc-950/60">
                    <FileIcon
                      extension={file.extension}
                      uploading={file.status === "uploading"}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-medium tracking-tight text-zinc-200"
                      title={file.name}
                    >
                      {truncateFileName(file.name)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      {file.status === "uploading"
                        ? `正在直传云端 ${file.progress}%`
                        : file.status === "error"
                          ? file.error || "上传失败"
                          : `${formatFileSize(file.size)} · 已就绪`}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={disabled || file.status === "uploading"}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeFile(file.id);
                    }}
                    aria-label={`移除 ${file.name}`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>

                {file.status === "uploading" && (
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      className="h-full rounded-full bg-zinc-100"
                      initial={{ width: 0 }}
                      animate={{ width: `${file.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
