"use client";

import { upload } from "@vercel/blob/client";

export type BlobUploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

/**
 * 浏览器直传 Vercel Blob
 * pathname 使用原始 file.name，避免自定义前缀导致 Token/pathname 校验冲突
 */
export async function uploadFileToBlob(
  file: File,
  options?: {
    folder?: string;
    onProgress?: (progress: BlobUploadProgress) => void;
  },
) {
  // 暂时忽略 folder 前缀，直接使用原始文件名（保留扩展名供 Blob 推断 contentType）
  void options?.folder;
  const pathname = file.name;

  try {
    const blob = await upload(pathname, file, {
      // Store 为 Private 时必须用 private，否则 /mpu 会 400
      access: "private",
      handleUploadUrl: "/api/upload",
      multipart: true,
      contentType: file.type || "application/octet-stream",
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
    const detail = await diagnoseUploadError();
    const base =
      error instanceof Error ? error.message : "上传失败，请稍后重试";
    throw new Error(detail ? `${base}（${detail}）` : base);
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
      clientToken?: string;
    } | null;
    if (data?.error) return data.error;
    if (!res.ok) return `HTTP ${res.status}`;
    return null;
  } catch {
    return null;
  }
}
