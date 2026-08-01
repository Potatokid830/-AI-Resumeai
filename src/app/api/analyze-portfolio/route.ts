import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { GenerateApiResponse } from "@/lib/generateTypes";
import { extractMediaInsights } from "@/lib/extractMediaInsights";

export const runtime = "nodejs";
/** 视频需经 Gemini Files 处理，适当放宽超时 */
export const maxDuration = 120;

const PORTFOLIO_STAR_SYSTEM = `你是一位拥有 10 年硅谷/一线大厂招聘经验的资深 HR 总监兼业务面经专家。
你将收到「视觉大模型/创意总监」对多媒体作品集的专业洞察，以及用户的简单描述与可选 JD。
请把洞察「降维打击」为可直接放进简历的项目经历：动词开局、STAR 法则、结果导向；绝对不要捏造未提供的投放数据。

# 强制输出格式（只返回合法 JSON）
{
  "phase": "result",
  "matchScore": number,
  "matchSubtitle": string,
  "optimizedResume": {
    "role": string,
    "company": string,
    "matchedKeywords": string[],
    "summaryHtml": string,
    "bullets": [
      { "letter": "S"|"T"|"A"|"R", "label": string, "html": string }
    ]
  },
  "gapAnalysis": string,
  "interviewDefense": string,
  "clarifyingQuestions": []
}

说明：summaryHtml / bullets[].html 可含 <mark>JD关键词</mark>；interviewDefense 用第一人称。`;

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
  if (!data || typeof data !== "object") return false;
  const value = data as GenerateApiResponse;
  return (
    typeof value.matchScore === "number" &&
    typeof value.gapAnalysis === "string" &&
    typeof value.interviewDefense === "string" &&
    typeof value.optimizedResume === "object" &&
    value.optimizedResume !== null &&
    Array.isArray(value.optimizedResume.bullets)
  );
}

function normalizeResult(data: GenerateApiResponse): GenerateApiResponse {
  return {
    ...data,
    phase: "result",
    matchScore: Math.min(100, Math.max(0, Math.round(data.matchScore))),
    matchSubtitle:
      typeof data.matchSubtitle === "string" && data.matchSubtitle.trim()
        ? data.matchSubtitle
        : "作品集视觉解析完成 · 解锁查看完整 STAR",
    clarifyingQuestions: [],
    interviewDefense: data.interviewDefense || "",
    optimizedResume: data.optimizedResume,
  };
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
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
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

    return NextResponse.json(normalizeResult(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: "作品集 STAR 重写失败", detail: message },
      { status: 502 },
    );
  }
}
