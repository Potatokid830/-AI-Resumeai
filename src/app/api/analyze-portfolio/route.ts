import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { GenerateApiResponse } from "@/lib/generateTypes";
import { extractMediaInsights } from "@/lib/extractMediaInsights";
import { PORTFOLIO_STAR_SYSTEM } from "@/lib/prompts";
import {
  buildPortfolioSourceLabel,
  isValidFinalSections,
  normalizeGenerateResponse,
} from "@/lib/resumeSchema";

export const runtime = "nodejs";
/** 视频需经 Gemini Files 处理，适当放宽超时 */
export const maxDuration = 120;

type AnalyzeBody = {
  url?: string;
  fileName?: string;
  jdText?: string;
  userNotes?: string;
  /** 兼容：多文件时取主作品 */
  assets?: Array<{ url?: string; name?: string }>;
};

function getDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    apiKey,
  });
}

function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

function isValidResult(data: unknown): data is GenerateApiResponse {
  return isValidFinalSections(data);
}

function normalizeResult(
  data: GenerateApiResponse,
  fileName: string,
): GenerateApiResponse {
  return normalizeGenerateResponse(data, "result", {
    matchSubtitle: "作品集视觉解析完成 · 解锁查看完整 STAR",
    itemSource: "portfolio",
    portfolioLabel: buildPortfolioSourceLabel(fileName),
  });
}

export async function POST(request: Request) {
  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const primary =
    body.url && body.fileName
      ? { url: body.url, name: body.fileName }
      : body.assets?.find((item) => item.url && item.name);

  if (!primary?.url || !primary.name) {
    return NextResponse.json(
      { error: "请提供已直传云端的作品集文件 url" },
      { status: 400 },
    );
  }

  const jdText = String(body.jdText ?? "");
  const userNotes = String(body.userNotes ?? "");

  // —— 阶段一：视觉感知 ——
  let mediaInsight: string;
  let insightEngine: string;
  try {
    const stage1 = await extractMediaInsights(
      primary.url,
      primary.name,
      userNotes,
    );
    mediaInsight = stage1.insight;
    insightEngine = stage1.engine;
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: "视觉感知阶段失败", detail: message },
      { status: 502 },
    );
  }

  const openai = getDeepSeekClient();
  if (!openai) {
    return NextResponse.json(
      { error: "未配置 DEEPSEEK_API_KEY，请检查环境变量" },
      { status: 500 },
    );
  }

  // —— 阶段二：简历降维打击（DeepSeek + STAR）——
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PORTFOLIO_STAR_SYSTEM },
        {
          role: "user",
          content: `请将作品集洞察重写为 STAR 项目经历 JSON。

## 目标岗位 JD
${jdText || "（未提供，按通用创意/营销/产品岗表达）"}

## 用户简单描述
${userNotes || "（无）"}

## 文件信息
- 文件名：${primary.name}
- 云端 URL：${primary.url}
- 视觉引擎：${insightEngine}

## 阶段一 · 创意总监洞察（纯文本）
${mediaInsight}
`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "DeepSeek 返回空内容，请重试" },
        { status: 502 },
      );
    }

    const parsed = extractJsonPayload(content);
    if (!isValidResult(parsed)) {
      return NextResponse.json(
        { error: "作品集 JSON 结构不完整，请重试" },
        { status: 502 },
      );
    }

    return NextResponse.json(normalizeResult(parsed as GenerateApiResponse, primary.name));
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: "作品集 STAR 重写失败", detail: message },
      { status: 502 },
    );
  }
}
