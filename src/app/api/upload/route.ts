import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 客户端直传上限（绕过 Vercel 4.5MB Request Body 限制） */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Client Upload Token 签发路由
 * 浏览器 `upload()` → POST /api/upload (blob.generate-client-token) → 返回 clientToken
 * 上传完成后 Vercel 可能回调 blob.upload-completed（本地开发通常不触发）
 */
export async function POST(request: Request): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        error:
          "缺少 BLOB_READ_WRITE_TOKEN。请在 Vercel Storage 创建 Blob Store，并将 Token 写入 .env.local / Vercel 环境变量后重启开发服务器。",
      },
      { status: 500 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "无效的上传请求体，期望 JSON（handleUpload event）" },
      { status: 400 },
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname) => {
        // MVP：不强制登录；限制体积与类型（支持通配）
        console.log("[blob] generate client token for", pathname);
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/octet-stream",
            "text/*",
            "image/*",
            "video/*",
            "audio/*",
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({
            purpose: "resumeai-workspace",
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // 生产环境 webhook；本地 localhost 通常收不到
        console.log("[blob] upload completed", blob.pathname, blob.url);
      },
    });

    // 成功时必须返回 { clientToken } 或 upload-completed 的 ok 响应
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传 Token 签发失败";
    console.error("[blob] handleUpload error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
