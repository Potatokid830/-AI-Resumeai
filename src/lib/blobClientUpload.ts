"use client";

import { upload } from "@vercel/blob/client";

export type BlobUploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

const MULTIPART_THRESHOLD = 4.5 * 1024 * 1024;

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, "_").slice(0, 120);
}

/**
 * 浏览器直传 Vercel Blob（先向 /api/upload 换 Token，再上传到云端）
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

  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    multipart: file.size >= MULTIPART_THRESHOLD,
    onUploadProgress: (event) => {
      options?.onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percentage: event.percentage,
      });
    },
  });

  return blob;
}
