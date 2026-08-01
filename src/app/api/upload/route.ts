import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Client Upload Token 签发路由
 * 浏览器 `upload({ multipart: true })` → POST /api/upload → 返回 clientToken
 * 随后浏览器直传 Vercel Blob `/api/blob/mpu` 完成分片上传
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
      onBeforeGenerateToken: async (pathname, _clientPayload, multipart) => {
        console.log("[blob] generate client token", {
          pathname,
          multipart,
        });

        return {
          // 严格：允许最大 100MB（含 multipart 分片直传）
          maximumSizeInBytes: 100 * 1024 * 1024,
          // 大文件分片耗时长，默认短过期会导致 /mpu 400
          validUntil: Date.now() + 60 * 60 * 1000, // 1 小时
          addRandomSuffix: true,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({
            purpose: "resumeai-workspace",
            pathname,
            multipart,
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[blob] upload completed", blob.pathname, blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传 Token 签发失败";
    console.error("[blob] handleUpload error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
