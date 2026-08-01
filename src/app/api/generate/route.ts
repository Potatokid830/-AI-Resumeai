import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  ClarifyingAnswer,
  GenerateApiResponse,
  GeneratePhase,
} from "@/lib/generateTypes";
import { parseResumeFile } from "@/lib/parseResumeFile";

export const runtime = "nodejs";

const SYSTEM_PROMPT_DEEPDIVE = `你是一位顶级的硅谷大厂 HR，同时也是一位极其严苛且专业的面试官与职业规划师。
当前处于「互动式深挖」阶段：先做 Gap 分析，再提出锐利追问，不要急着输出终版 STAR 简历。

## 输入说明
用户可能同时提供原简历、目标 JD、项目素材。你需要识别描述中缺失的量化证据、业务结果与可验证细节。

## 追问要求（必须严格执行）
- 如果用户描述缺乏细节，必须生成 2-3 个锐利、专业的 clarifyingQuestions。
- 追问要具体，能逼出数据、反馈、转化、规模或可验证动作。
- 示例：用户说“做了一个商业植物陈列项目，结合了 ESG 理念”，你应追问类似：
  1. 针对 CBD 的植物租摆，具体的 ESG 减碳或环保指标是如何量化的？
  2. 最终的商业分析报告获得了怎样的反馈或转化率？
- 即使信息相对完整，也至少提出 2 个能进一步升维的追问（不要返回空数组）。

## 强制输出格式
只返回合法 JSON（不要 Markdown），字段如下：
{
  "phase": "deepdive",
  "matchScore": number,                 // 基于现有信息的初步匹配度预估 0-100
  "matchSubtitle": string,              // 一句克制的缺口解读
  "optimizedResume": null,
  "gapAnalysis": string,                // 当前信息缺口与为什么要追问
  "interviewDefense": "",               // 本阶段可为空字符串
  "clarifyingQuestions": string[]       // 2-3 个追问
}`;

const SYSTEM_PROMPT_FINAL = `你是一位顶级的硅谷大厂 HR，同时也是一位极其严苛且专业的面试官与职业规划师。
当前处于「终版合成」阶段：综合原简历、目标 JD、项目素材，以及用户对追问的补充回答，输出可直接投递的 STAR 简历。

## 核心任务
1. 将补充细节天衣无缝地揉进 STAR 法则描述，消除模板感。
2. 对齐 JD 关键词，并在 HTML 字段用 <mark>关键词</mark> 包裹。
3. 给出匹配度、缺口分析与面试防御话术。
4. 若素材含画面比例、时间轴卡点、视觉特效、分镜脚本等，转化为「视听叙事 / 制片统筹 / 后期技术」专业表述。
5. 不要编造用户未提供的虚假任职；可做合理专业转译。

## 强制输出格式
只返回合法 JSON（不要 Markdown），字段如下：
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
}`;

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
  return `请先做 Gap 分析，并给出 2-3 个锐利追问。严格返回 JSON。

## 目标岗位 JD
${jdText || "（未提供）"}

## 原简历文本
${resumeText || "（未提供）"}

## 项目素材
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

  return `请综合全部信息合成终版 STAR 简历。严格返回 JSON。

## 目标岗位 JD
${jdText || "（未提供）"}

## 原简历文本
${resumeText || "（未提供）"}

## 项目素材
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
  return (
    value.phase === "result" &&
    typeof value.matchScore === "number" &&
    typeof value.gapAnalysis === "string" &&
    typeof value.interviewDefense === "string" &&
    typeof value.optimizedResume === "object" &&
    value.optimizedResume !== null &&
    Array.isArray(value.optimizedResume.bullets)
  );
}

function normalizeResponse(
  data: GenerateApiResponse,
  phase: GeneratePhase,
): GenerateApiResponse {
  return {
    ...data,
    phase,
    matchSubtitle:
      typeof data.matchSubtitle === "string" && data.matchSubtitle.trim()
        ? data.matchSubtitle
        : phase === "deepdive"
          ? "仍有关键细节待补充"
          : "已完成 JD 对齐分析",
    matchScore: Math.min(100, Math.max(0, Math.round(data.matchScore))),
    clarifyingQuestions: Array.isArray(data.clarifyingQuestions)
      ? data.clarifyingQuestions.filter(Boolean).slice(0, 3)
      : [],
    interviewDefense:
      typeof data.interviewDefense === "string" ? data.interviewDefense : "",
    optimizedResume: phase === "result" ? data.optimizedResume : null,
  };
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "请求体无效，请以 FormData 提交" },
      { status: 400 },
    );
  }

  const jdText = String(formData.get("jdText") ?? "");
  const experienceText = String(formData.get("experienceText") ?? "");
  const resumeTextField = String(formData.get("resumeText") ?? "");
  const isFinal = String(formData.get("isFinal") ?? "") === "true";
  const clarifyingAnswers = parseClarifyingAnswers(
    String(formData.get("clarifyingAnswers") ?? ""),
  );
  const resumeField = formData.get("resumeFile");

  let resumeText = resumeTextField;

  if (!resumeText && resumeField instanceof File && resumeField.size > 0) {
    const parsed = await parseResumeFile(resumeField);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    resumeText = parsed.text;
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
