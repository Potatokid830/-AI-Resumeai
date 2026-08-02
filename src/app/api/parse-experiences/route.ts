import { NextResponse } from "next/server";
import {
  deepseekChatCompletion,
  getDeepSeekClient,
} from "@/lib/deepseekCall";
import type {
  ParsedExperience,
  ParsedExperienceType,
  ParseExperiencesResponse,
} from "@/lib/generateTypes";
import { parseDocumentFromUrl } from "@/lib/parseDocument";
import { SYSTEM_PROMPT_PARSE_EXPERIENCES } from "@/lib/prompts";
import {
  extractContactHeuristics,
  mergeContact,
  normalizeContact,
} from "@/lib/resumeContact";

export const runtime = "nodejs";
export const maxDuration = 60;

type ParseBody = {
  resumeUrl?: string;
  resumeFileName?: string;
  jdText?: string;
};

const EXPERIENCE_TYPES: ParsedExperienceType[] = [
  "experience",
  "project",
  "education",
  "other",
];

function extractJsonPayload(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw);
}

function normalizeType(value: unknown): ParsedExperienceType {
  if (typeof value === "string" && EXPERIENCE_TYPES.includes(value as ParsedExperienceType)) {
    return value as ParsedExperienceType;
  }
  return "experience";
}

/**
 * 将模型切段结果转为带稳定顺序 id 的经历列表。
 * id 一律服务端写死为 exp_1, exp_2…，忽略模型若返回的 id。
 */
function stampExperiences(raw: unknown): ParsedExperience[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { experiences?: unknown }).experiences;
  if (!Array.isArray(list)) return [];

  const stamped: ParsedExperience[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const original =
      typeof item.original === "string" ? item.original.trim() : "";
    if (!original) continue;

    const title =
      typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : `经历 ${stamped.length + 1}`;

    stamped.push({
      id: `exp_${stamped.length + 1}`,
      title,
      original,
      type: normalizeType(item.type),
    });
  }
  return stamped;
}

export async function POST(request: Request) {
  let body: ParseBody;
  try {
    body = (await request.json()) as ParseBody;
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const resumeUrl =
    typeof body.resumeUrl === "string" ? body.resumeUrl.trim() : "";
  const resumeFileName =
    typeof body.resumeFileName === "string" && body.resumeFileName.trim()
      ? body.resumeFileName.trim()
      : "resume.pdf";
  const jdText = typeof body.jdText === "string" ? body.jdText : "";

  if (!resumeUrl) {
    return NextResponse.json(
      { error: "请先上传简历并完成云端直传" },
      { status: 400 },
    );
  }

  const parsedDoc = await parseDocumentFromUrl(resumeUrl, resumeFileName);
  if (!parsedDoc.ok) {
    return NextResponse.json({ error: parsedDoc.error }, { status: 400 });
  }

  const resumeText = parsedDoc.text.trim();
  if (!resumeText) {
    return NextResponse.json(
      { error: "未能从简历中提取到文本，请换一份 PDF/DOCX 重试" },
      { status: 400 },
    );
  }

  const openai = getDeepSeekClient();
  if (!openai) {
    return NextResponse.json(
      { error: "未配置 DEEPSEEK_API_KEY，请检查环境变量" },
      { status: 500 },
    );
  }

  try {
    const completion = await deepseekChatCompletion(
      openai,
      "parse-experiences",
      {
        temperature: 0.2,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT_PARSE_EXPERIENCES },
          {
            role: "user",
            content: `请切分以下简历中的经历段落。严格返回 JSON。

## 目标岗位 JD（可选，仅供标题对齐参考）
${jdText.trim() || "（未提供）"}

## 简历全文
${resumeText.slice(0, 40_000)}
`,
          },
        ],
      },
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "DeepSeek 返回空内容，请重试" },
        { status: 502 },
      );
    }

    let payload: unknown;
    try {
      payload = extractJsonPayload(content);
    } catch {
      return NextResponse.json(
        { error: "经历列表 JSON 解析失败，请重试" },
        { status: 502 },
      );
    }

    const experiences = stampExperiences(payload);
    if (!experiences.length) {
      return NextResponse.json(
        { error: "未识别到可用的经历段落，请检查简历内容后重试" },
        { status: 422 },
      );
    }

    const fromModel = normalizeContact(
      payload && typeof payload === "object"
        ? (payload as { contact?: unknown }).contact
        : undefined,
    );
    const contact = mergeContact(
      fromModel,
      extractContactHeuristics(resumeText),
    );

    console.log(
      "[parse-experiences]",
      experiences.map((item) => ({ id: item.id, title: item.title })),
      {
        contact: {
          name: Boolean(contact.name),
          phone: Boolean(contact.phone),
          email: Boolean(contact.email),
        },
      },
    );

    const response: ParseExperiencesResponse = { experiences, contact };
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { error: "解析经历失败", detail: message },
      { status: 502 },
    );
  }
}
