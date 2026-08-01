import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/regenerate-item
 *
 * 预期请求体：
 * {
 *   id: string;
 *   original: string;
 *   userSupplement: string;
 *   jdText: string;
 * }
 *
 * 预期响应：更新后的单个 ResumeSectionItem
 *
 * TODO: 调 DeepSeek 按 HR_CORE 重写单条 item（对照编辑器 / 按需深挖）
 */
export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error: "Not implemented",
      detail: "单段重生成接口骨架已预留，实现待下一期",
    },
    { status: 501 },
  );
}
