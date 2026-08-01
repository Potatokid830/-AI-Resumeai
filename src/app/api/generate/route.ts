import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  ClarifyingAnswer,
  GenerateApiResponse,
  GeneratePhase,
} from "@/lib/generateTypes";
import {
  isTextExtractable,
  parseDocumentFromUrl,
} from "@/lib/parseDocument";
import {
  SYSTEM_PROMPT_DEEPDIVE,
  SYSTEM_PROMPT_FINAL,
} from "@/lib/prompts";
import {
  isValidFinalSections,
  normalizeGenerateResponse,
} from "@/lib/resumeSchema";

export const runtime = "nodejs";

function getDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  return new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    apiKey,
  });
}

function buildDeepDivePrompt(
  jdText: string,
  experienceText: string,
  resumeText: string,
) {
  return `请以资深 HR 总监视角做 Gap 分析，并给出 2-3 个锐利追问。严格返回 JSON。绝对不要捏造数据。

## 目标岗位描述 (JD)
${jdText || "（未提供）"}

## 原简历文本
${resumeText || "（未提供）"}

## 原始经历 / 项目素材
${experienceText || "（未提供）"}
`;
}

function buildFinalPrompt(
  jdText: string,
  experienceText: string,
  resumeText: string,
  answers: ClarifyingAnswer[],
) {
  const qa =
    answers.length > 0
      ? answers
          .map(
            (item, index) =>
              `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer || "（用户未作答）"}`,
          )
          .join("\n\n")
      : "（无补充回答）";

  return `请以资深 HR 总监视角，按「动词开局 + STAR + 颗粒度升维 + 绝对诚实」重组终版简历。严格返回 JSON。禁止捏造未提供的数据。

## 目标岗位描述 (JD)
${jdText || "（未提供）"}

## 原简历文本
${resumeText || "（未提供）"}

## 原始经历 / 项目素材
${experienceText || "（未提供）"}

## 用户对追问的补充回答
${qa}
`;
}

function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

function parseClarifyingAnswers(raw: string): ClarifyingAnswer[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as ClarifyingAnswer;
        if (typeof row.question !== "string") return null;
        return {
          question: row.question,
          answer: typeof row.answer === "string" ? row.answer : "",
        };
      })
      .filter((item): item is ClarifyingAnswer => Boolean(item));
  } catch {
    return [];
  }
}

function isValidDeepDive(data: unknown): data is GenerateApiResponse {
  if (!data || typeof data !== "object") return false;
  const value = data as GenerateApiResponse;
  return (
    value.phase === "deepdive" &&
    typeof value.matchScore === "number" &&
    typeof value.gapAnalysis === "string" &&
    Array.isArray(value.clarifyingQuestions) &&
    value.clarifyingQuestions.length >= 2 &&
    value.clarifyingQuestions.every((q) => typeof q === "string")
  );
}

function isValidFinal(data: unknown): data is GenerateApiResponse {
  if (!data || typeof data !== "object") return false;
  const value = data as GenerateApiResponse;
  return value.phase === "result" && isValidFinalSections(data);
}

function normalizeResponse(
  data: GenerateApiResponse,
  phase: GeneratePhase,
): GenerateApiResponse {
  return normalizeGenerateResponse(data, phase, { itemSource: "resume" });
}

type AssetUrlRef = {
  name?: string;
  url?: string;
  size?: number;
};

type GenerateRequestBody = {
  jdText?: string;
  experienceText?: string;
  resumeText?: string;
  resumeUrl?: string | null;
  resumeFileName?: string | null;
  assetUrls?: AssetUrlRef[];
  isFinal?: boolean;
  clarifyingAnswers?: ClarifyingAnswer[] | string;
};

async function enrichExperienceFromAssets(
  experienceText: string,
  assetUrls: AssetUrlRef[],
) {
  if (!assetUrls.length) return experienceText;

  const extractedBlocks: string[] = [];

  for (const asset of assetUrls.slice(0, 6)) {
    const url = typeof asset.url === "string" ? asset.url : "";
    const name = typeof asset.name === "string" ? asset.name : "asset";
    if (!url || !isTextExtractable(name)) continue;

    const parsed = await parseDocumentFromUrl(url, name);
    if (parsed.ok && parsed.text) {
      extractedBlocks.push(
        `【云端素材提取：${name}】\n${parsed.text.slice(0, 12_000)}`,
      );
    }
  }

  if (!extractedBlocks.length) return experienceText;
  return [experienceText, ...extractedBlocks].filter(Boolean).join("\n\n");
}

export async function POST(request: Request) {
  let body: GenerateRequestBody;

  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "请求体无效，请以 JSON 提交（含 Blob URL）" },
      { status: 400 },
    );
  }

  const jdText = String(body.jdText ?? "");
  let experienceText = String(body.experienceText ?? "");
  let resumeText = String(body.resumeText ?? "");
  const resumeUrl =
    typeof body.resumeUrl === "string" && body.resumeUrl.trim()
      ? body.resumeUrl.trim()
      : "";
  const resumeFileName =
    typeof body.resumeFileName === "string" ? body.resumeFileName : "resume.pdf";
  const isFinal = Boolean(body.isFinal);
  const clarifyingAnswers = Array.isArray(body.clarifyingAnswers)
    ? body.clarifyingAnswers
    : parseClarifyingAnswers(
        typeof body.clarifyingAnswers === "string"
          ? body.clarifyingAnswers
          : "",
      );
  const assetUrls = Array.isArray(body.assetUrls) ? body.assetUrls : [];

  // 从 Blob URL 拉取简历并解析纯文本
  if (resumeUrl) {
    const parsed = await parseDocumentFromUrl(resumeUrl, resumeFileName);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    resumeText = parsed.text;
  }

  try {
    experienceText = await enrichExperienceFromAssets(
      experienceText,
      assetUrls,
    );
  } catch {
    // 素材提取失败不阻断主流程，仍用前端附带的 url 文本
  }

  const openai = getDeepSeekClient();
  if (!openai) {
    return NextResponse.json(
      { error: "未配置 DEEPSEEK_API_KEY，请检查 .env.local" },
      { status: 500 },
    );
  }

  const phase: GeneratePhase = isFinal ? "result" : "deepdive";

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: isFinal ? SYSTEM_PROMPT_FINAL : SYSTEM_PROMPT_DEEPDIVE,
        },
        {
          role: "user",
          content: isFinal
            ? buildFinalPrompt(
                jdText,
                experienceText,
                resumeText,
                clarifyingAnswers,
              )
            : buildDeepDivePrompt(jdText, experienceText, resumeText),
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

    if (isFinal) {
      if (!isValidFinal(parsed)) {
        return NextResponse.json(
          { error: "终版 JSON 结构不完整，请重试" },
          { status: 502 },
        );
      }
      return NextResponse.json(normalizeResponse(parsed, "result"));
    }

    if (!isValidDeepDive(parsed)) {
      return NextResponse.json(
        { error: "追问阶段 JSON 结构不完整，请重试" },
        { status: 502 },
      );
    }

    return NextResponse.json(normalizeResponse(parsed, "deepdive"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: "DeepSeek 调用失败", detail: message },
      { status: 502 },
    );
  }
}
