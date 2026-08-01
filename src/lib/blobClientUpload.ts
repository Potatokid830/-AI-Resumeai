"use client";

import { upload } from "@vercel/blob/client";

export type BlobUploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
  /** uploading=传字节；finalizing=分片已满，等待 complete */
  phase: "uploading" | "finalizing";
};

const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;
/** 小于此值用单次直传，避免小文件走 MPU complete 卡住 */
const MULTIPART_MIN_BYTES = 8 * 1024 * 1024;

function sanitizeFileName(name: string) {
  const cleaned = name
    .replace(/[%#?&=+]/g, "_")
    .replace(/[^\w.\-()\u4e00-\u9fff]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
  return cleaned || "upload.bin";
}

function guessContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

/**
 * 浏览器直传 Private Vercel Blob
 */
export async function uploadFileToBlob(
  file: File,
  options?: {
    folder?: string;
    onProgress?: (progress: BlobUploadProgress) => void;
  },
) {
  const folder = options?.folder ?? "workspace";
  const pathname = `${folder}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const useMultipart = file.size >= MULTIPART_MIN_BYTES;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let reachedHighWater = false;

  try {
    const blob = await upload(pathname, file, {
      access: "private",
      handleUploadUrl: "/api/upload",
      multipart: useMultipart,
      contentType: guessContentType(file),
      abortSignal: controller.signal,
      onUploadProgress: (event) => {
        const percentage = Math.min(99, Math.round(event.percentage));
        // 分片场景：接近完成时 UI 进入 finalizing，避免假死在 100%
        if (event.percentage >= 99 || (useMultipart && event.percentage >= 95)) {
          reachedHighWater = true;
          options?.onProgress?.({
            loaded: event.loaded,
            total: event.total,
            percentage: 99,
            phase: "finalizing",
          });
          return;
        }
        options?.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percentage,
          phase: "uploading",
        });
      },
    });

    options?.onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      phase: "finalizing",
    });

    return blob;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        reachedHighWater
          ? "上传已到 99%，但云端确认超时。请压缩 PDF 后重试，或检查网络后重新上传。"
          : "上传超时，请检查网络后重试。",
      );
    }

    const message =
      error instanceof Error ? error.message : "上传失败，请稍后重试";

    if (/client token|retrieve the client/i.test(message)) {
      const detail = await diagnoseUploadError();
      throw new Error(detail ? `${message}（${detail}）` : message);
    }

    throw new Error(message);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function diagnoseUploadError(): Promise<string | null> {
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: "diagnose.pdf",
          clientPayload: null,
          multipart: true,
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (data?.error) return data.error;
    if (!res.ok) return `HTTP ${res.status}`;
    return null;
  } catch {
    return null;
  }
}
