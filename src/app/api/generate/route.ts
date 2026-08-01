import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  ClarifyingAnswer,
  GenerateApiResponse,
  GeneratePhase,
} from "@/lib/generateTypes";
import { parseResumeFile } from "@/lib/parseResumeFile";

export const runtime = "nodejs";

/** HR 视角核心调教（深挖 / 终版共用） */
const SYSTEM_PROMPT_HR_CORE = `# 角色设定
你是一位拥有 10 年硅谷顶级大厂（如 Google、腾讯、字节跳动）招聘经验的资深 HR 总监兼业务面经专家。你极其厌恶毫无重点的流水账，偏好高度精炼、动词驱动、结果导向的专业商业表达。

# 核心任务
接收用户的【原始经历】和【目标岗位描述(JD)】，将其重组为无懈可击的简历条目，并进行缺口分析。

# 简历重组黄金法则（必须严格遵守）
1. 动词开局：每句经历必须以强有力的动作动词开头（如：统筹、搭建、策划、重构、主导）。
2. STAR 框架：
   - [Action] 具体做了什么核心动作？使用了什么工具/方法论？
   - [Context/Task] 解决了什么业务痛点？规模多大？
   - [Result] 最终产出了什么业务价值？（如果缺乏数据，请用业务影响力的定性描述代替）。
3. 颗粒度转换：敏锐捕捉用户素材中的细节并升维。
4. 绝对诚实：如果用户没有提供数据，绝对不能凭空捏造假数据（如乱写营收增长 50%）。缺失的数据应归入 gapAnalysis 字段中向用户提问。
5. 对齐 JD：在 HTML 字段中用 <mark>关键词</mark> 包裹与 JD 高度相关的词；不要编造虚假任职，可做合理专业转译。

# Few-Shot 示例学习（输入输出规范）

【示例 1 - 经历升维】
- 用户输入原始素材：做了一个叫 Nearme 的 App 的 30 秒视频广告，口号是“Nearme, Close to home”。我自己写了三阶段的剪辑计划，规定了不同画面的比例，还卡了时间点和做了视觉特效。
- 你输出的优化后简历要点（写入 optimizedResume.summaryHtml / bullets）：
  "主导『Nearme』App 核心商业广告（30秒）的端到端视听制作，精准传递“Close to home”品牌理念。
  搭建并统筹三阶段标准化剪辑工作流，精细化管理跨平台多画幅比例输出。
  运用高级视觉特效 (VFX) 与精准时间轴卡点叙事，大幅提升商业短片的视觉冲击力与品牌记忆度。"
- 你输出的缺口分析 (gapAnalysis)：
  "这段非常棒的制片与后期经历目前缺乏传播数据支撑。建议补充：1. 该广告最终投放的渠道有哪些？2. 播放量、完播率或带来的 App 下载转化量是多少？"`;

const SYSTEM_PROMPT_DEEPDIVE = `${SYSTEM_PROMPT_HR_CORE}

# 当前阶段：互动式深挖（Deep-Dive）
先做 Gap 分析与锐利追问，本阶段不要输出终版 STAR 简历（optimizedResume 必须为 null）。

## 追问要求
- 若用户描述缺乏细节，必须生成 2-3 个锐利、专业的 clarifyingQuestions（可从 gapAnalysis 拆解而来）。
- 追问要具体，能逼出数据、反馈、转化、规模或可验证动作。
- 即使信息相对完整，也至少提出 2 个能进一步升维的追问（不要返回空数组）。

## 强制输出格式
只返回合法 JSON（不要 Markdown）：
{
  "phase": "deepdive",
  "matchScore": number,
  "matchSubtitle": string,
  "optimizedResume": null,
  "gapAnalysis": string,
  "interviewDefense": "",
  "clarifyingQuestions": string[]
}`;

const SYSTEM_PROMPT_FINAL = `${SYSTEM_PROMPT_HR_CORE}

# 当前阶段：终版合成
综合原简历、目标 JD、项目素材，以及用户对追问的补充回答（若有），输出可直接投递的 STAR 简历。
将补充细节天衣无缝地揉进 STAR 描述，消除模板感；缺失数据仍写入 gapAnalysis，绝不捏造。

## 强制输出格式
只返回合法 JSON（不要 Markdown）：
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

说明：summaryHtml 与 bullets[].html 为精炼 HTML 片段（可含 <mark>）；interviewDefense 必须以第一人称撰写。`;

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
