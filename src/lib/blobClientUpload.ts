"use client";

import { upload } from "@vercel/blob/client";

export type BlobUploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, "_").slice(0, 120);
}

/**
 * 浏览器直传 Vercel Blob（先向 /api/upload 换 Token，再分片直传到云端）
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

  try {
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      // 显式开启分片直传，支持大 PDF / 视频作品集
      multipart: true,
      onUploadProgress: (event) => {
        options?.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percentage: event.percentage,
        });
      },
    });
    return blob;
  } catch (error) {
    const detail = await diagnoseTokenError();
    const base =
      error instanceof Error ? error.message : "上传失败，请稍后重试";
    throw new Error(detail ? `${base}（${detail}）` : base);
  }
}

async function diagnoseTokenError(): Promise<string | null> {
  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: "diagnose/ping.bin",
          clientPayload: null,
          multipart: true,
        },
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      error?: string;
      clientToken?: string;
    } | null;
    if (data?.error) return data.error;
    if (!res.ok) return `HTTP ${res.status}`;
    return null;
  } catch {
    return null;
  }
}
