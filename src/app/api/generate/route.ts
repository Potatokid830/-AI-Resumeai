import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  AssetBinding,
  ClarifyingAnswer,
  GenerateApiResponse,
  GeneratePhase,
  ParsedExperience,
  ResumeSection,
} from "@/lib/generateTypes";
import {
  isTextExtractable,
  parseDocumentFromUrl,
} from "@/lib/parseDocument";
import {
  PORTFOLIO_STAR_SYSTEM,
  PROMPT_ENHANCE_WITH_PORTFOLIO,
  SYSTEM_PROMPT_DEEPDIVE,
  SYSTEM_PROMPT_FINAL,
} from "@/lib/prompts";
import { readAssetInsight, type AssetInsight } from "@/lib/readAssetInsight";
import {
  applyExperienceSnapshotStamps,
  buildPortfolioSourceLabel,
  isValidFinalSections,
  normalizeGenerateResponse,
} from "@/lib/resumeSchema";

export const runtime = "nodejs";
/** Vercel 免费版硬上限 60s */
export const maxDuration = 60;

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

function buildFinalPromptWithSnapshot(
  jdText: string,
  resumeText: string,
  answers: ClarifyingAnswer[],
  snapshot: ParsedExperience[],
  enhanceMap: Map<string, AssetInsight[]>,
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

  const experienceBlocks = snapshot
    .map((exp) => {
      const insights = enhanceMap.get(exp.id) ?? [];
      const insightBlock =
        insights.length > 0
          ? `
${PROMPT_ENHANCE_WITH_PORTFOLIO}

### 配对作品洞察
${insights
  .map(
    (ins, i) =>
      `#### 作品 ${i + 1}：${ins.fileName}（引擎：${ins.engine}）\n${ins.insight}`,
  )
  .join("\n\n")}`
          : "\n（本段无配对作品，按原经历正常改写即可。）";

      return `### 经历 ${exp.id}
- title: ${exp.title}
- type: ${exp.type}
- **item.id 必须输出为：${exp.id}**
- original（须完整保留，勿删减）:
"""
${exp.original}
"""
${insightBlock}`;
    })
    .join("\n\n");

  return `请输出整份简历 sections JSON。经历条目必须以下方「经历快照」为准：
- 每条经历的 item.id 必须与快照 id 完全一致
- original 请原样回传快照原文（服务端会再强制覆盖）
- 有作品洞察的经历请遵循作品增强指令

## 目标岗位描述 (JD)
${jdText || "（未提供）"}

## 原简历全文（供教育/技能等非经历段参考）
${resumeText || "（未提供）"}

## 经历快照（增强与改写的唯一依据，勿重新切段）
${experienceBlocks || "（无）"}

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

function parseExperiencesSnapshot(raw: unknown): ParsedExperience[] {
  if (!Array.isArray(raw)) return [];
  const list: ParsedExperience[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const original = typeof item.original === "string" ? item.original.trim() : "";
    if (!id || !original) continue;
    list.push({
      id,
      title:
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : id,
      original,
      type:
        item.type === "project" ||
        item.type === "education" ||
        item.type === "other" ||
        item.type === "experience"
          ? item.type
          : "experience",
    });
  }
  return list;
}

function parseAssetBindings(raw: unknown): AssetBinding[] {
  if (!Array.isArray(raw)) return [];
  const list: AssetBinding[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const assetId = typeof item.assetId === "string" ? item.assetId : "";
    const name = typeof item.name === "string" ? item.name : "";
    const url = typeof item.url === "string" ? item.url : "";
    const bindTo = typeof item.bindTo === "string" ? item.bindTo : "new";
    if (!assetId || !url) continue;
    list.push({
      assetId,
      name: name || "asset",
      url,
      size: typeof item.size === "number" ? item.size : 0,
      bindTo,
    });
  }
  return list;
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
  if (!isValidFinalSections(data)) return false;
  const value = data as { phase?: string };
  // 允许模型省略 phase；normalize 时会写回 result
  return value.phase === "result" || value.phase === undefined;
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
  userNotes?: string;
  resumeText?: string;
  resumeUrl?: string | null;
  resumeFileName?: string | null;
  assetUrls?: AssetUrlRef[];
  isFinal?: boolean;
  clarifyingAnswers?: ClarifyingAnswer[] | string;
  assetBindings?: AssetBinding[];
  experiencesSnapshot?: ParsedExperience[];
};

async function enrichExperienceFromAssets(
  experienceText: string,
  assetUrls: AssetUrlRef[],
) {
  if (!assetUrls.length) return experienceText;

  const t0 = Date.now();
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

  console.log(
    `[timing][generate] enrichExperienceFromAssets assets=${assetUrls.length} blocks=${extractedBlocks.length} ms=${Date.now() - t0}`,
  );

  if (!extractedBlocks.length) return experienceText;
  return [experienceText, ...extractedBlocks].filter(Boolean).join("\n\n");
}

const MAX_ASSET_BINDINGS = 3;
const MAX_NEW_PORTFOLIO_ASSETS = 2;

async function buildPortfolioSectionsFromNewAssets(
  openai: OpenAI,
  jdText: string,
  userNotes: string,
  newAssets: AssetInsight[],
): Promise<{ sections: ResumeSection[]; warnings: string[] }> {
  const sections: ResumeSection[] = [];
  const warnings: string[] = [];

  const toProcess = newAssets.slice(0, MAX_NEW_PORTFOLIO_ASSETS);
  const skipped = newAssets.slice(MAX_NEW_PORTFOLIO_ASSETS);
  if (skipped.length > 0) {
    warnings.push(
      `本次最多处理 ${MAX_NEW_PORTFOLIO_ASSETS} 个「新项目」作品，超出部分未处理：${skipped.map((a) => `《${a.fileName}》`).join("、")}`,
    );
  }

  const tPhase = Date.now();
  for (const asset of toProcess) {
    const tAsset = Date.now();
    try {
      const tDs = Date.now();
      const completion = await openai.chat.completions.create({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
        temperature: 0.45,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PORTFOLIO_STAR_SYSTEM },
          {
            role: "user",
            content: `请将作品集洞察重写为 STAR 项目经历 JSON（sections/items）。original 可空。

## 目标岗位 JD
${jdText || "（未提供）"}

## 用户简单描述
${userNotes || "（无）"}

## 文件信息
- 文件名：${asset.fileName}
- 视觉引擎：${asset.engine}

## 作品洞察
${asset.insight}
`,
          },
        ],
      });
      console.log(
        `[timing][generate] deepseek portfolio-new file=${asset.fileName} ms=${Date.now() - tDs}`,
      );

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        warnings.push(`作品《${asset.fileName}》处理失败，可重试`);
        continue;
      }
      const parsed = extractJsonPayload(content);
      if (!isValidFinalSections(parsed)) {
        warnings.push(`作品《${asset.fileName}》处理失败，可重试`);
        continue;
      }

      const normalized = normalizeGenerateResponse(
        parsed as GenerateApiResponse,
        "result",
        {
          itemSource: "portfolio",
          portfolioLabel: buildPortfolioSourceLabel(asset.fileName),
        },
      );
      if (normalized.sections?.length) {
        sections.push(...normalized.sections);
      } else {
        warnings.push(`作品《${asset.fileName}》处理失败，可重试`);
      }
    } catch (error) {
      console.warn("[generate] portfolio new-asset failed", asset.fileName, error);
      warnings.push(`作品《${asset.fileName}》处理失败，可重试`);
    } finally {
      console.log(
        `[timing][generate] portfolio-new-asset file=${asset.fileName} totalMs=${Date.now() - tAsset}`,
      );
    }
  }

  console.log(
    `[timing][generate] buildPortfolioSectionsFromNewAssets count=${toProcess.length} sections=${sections.length} ms=${Date.now() - tPhase}`,
  );

  return { sections, warnings };
}

export async function POST(request: Request) {
  const tRequest = Date.now();
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
  const assetBindings = parseAssetBindings(body.assetBindings);
  const experiencesSnapshot = parseExperiencesSnapshot(body.experiencesSnapshot);
  const userNotes = String(body.userNotes ?? "").slice(0, 2_000);

  console.log(
    `[timing][generate] START isFinal=${isFinal} resumeUrl=${Boolean(resumeUrl)} assetBindings=${assetBindings.length} assetUrls=${assetUrls.length} snapshot=${experiencesSnapshot.length}`,
  );

  // 从 Blob URL 拉取简历并解析纯文本
  if (resumeUrl) {
    const tResume = Date.now();
    const parsed = await parseDocumentFromUrl(resumeUrl, resumeFileName);
    console.log(
      `[timing][generate] resume parseDocumentFromUrl file=${resumeFileName} ms=${Date.now() - tResume} ok=${parsed.ok}`,
    );
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
    // 素材提取失败不阻断主流程
  }

  const openai = getDeepSeekClient();
  if (!openai) {
    return NextResponse.json(
      { error: "未配置 DEEPSEEK_API_KEY，请检查 .env.local" },
      { status: 500 },
    );
  }

  const phase: GeneratePhase = isFinal ? "result" : "deepdive";

  // —— 终版：按 assetBindings 读作品并分组（增强 / 新增）——
  const enhanceMap = new Map<string, AssetInsight[]>();
  const newAssets: AssetInsight[] = [];
  const enhancedByMap: Record<string, string[]> = {};
  const processingWarnings: string[] = [];

  if (isFinal && assetBindings.length > 0) {
    const snapshotIds = new Set(experiencesSnapshot.map((e) => e.id));
    const bindingsToProcess = assetBindings.slice(0, MAX_ASSET_BINDINGS);
    const bindingsSkipped = assetBindings.slice(MAX_ASSET_BINDINGS);
    if (bindingsSkipped.length > 0) {
      processingWarnings.push(
        `本次最多处理 ${MAX_ASSET_BINDINGS} 个作品，超出部分未处理：${bindingsSkipped.map((b) => `《${b.name}》`).join("、")}`,
      );
    }

    const tAssets = Date.now();
    for (const binding of bindingsToProcess) {
      const tOne = Date.now();
      const insight = await readAssetInsight({
        assetId: binding.assetId,
        fileName: binding.name,
        url: binding.url,
        userNotes,
      });
      console.log(
        `[timing][generate] readAssetInsight bindTo=${binding.bindTo} file=${binding.name} engine=${insight.engine} ms=${Date.now() - tOne}`,
      );

      if (binding.bindTo === "new" || !snapshotIds.has(binding.bindTo)) {
        if (binding.bindTo !== "new" && !snapshotIds.has(binding.bindTo)) {
          console.warn(
            "[generate] bindTo 不在 snapshot 中，降级为 new",
            binding.bindTo,
          );
          processingWarnings.push(
            `作品《${binding.name}》所选经历无效，已按「新项目」处理`,
          );
        }
        newAssets.push(insight);
        continue;
      }

      const list = enhanceMap.get(binding.bindTo) ?? [];
      list.push(insight);
      enhanceMap.set(binding.bindTo, list);
      const names = enhancedByMap[binding.bindTo] ?? [];
      names.push(binding.name);
      enhancedByMap[binding.bindTo] = names;
    }
    console.log(
      `[timing][generate] readAllAssetInsights count=${bindingsToProcess.length} enhanceExps=${enhanceMap.size} newAssets=${newAssets.length} ms=${Date.now() - tAssets}`,
    );
  }

  try {
    const useSnapshotFinal =
      isFinal && experiencesSnapshot.length > 0;

    const tDeepseek = Date.now();
    const completion = await openai.chat.completions.create({
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: isFinal ? SYSTEM_PROMPT_FINAL : SYSTEM_PROMPT_DEEPDIVE,
        },
        {
          role: "user",
          content: useSnapshotFinal
            ? buildFinalPromptWithSnapshot(
                jdText,
                resumeText,
                clarifyingAnswers,
                experiencesSnapshot,
                enhanceMap,
              )
            : isFinal
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
    console.log(
      `[timing][generate] deepseek main phase=${phase} useSnapshot=${useSnapshotFinal} ms=${Date.now() - tDeepseek}`,
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.log(
        `[timing][generate] END early empty-content totalMs=${Date.now() - tRequest}`,
      );
      return NextResponse.json(
        { error: "DeepSeek 返回空内容，请重试" },
        { status: 502 },
      );
    }

    const parsed = extractJsonPayload(content);

    if (isFinal) {
      if (!isValidFinal(parsed)) {
        console.log(
          `[timing][generate] END early invalid-final totalMs=${Date.now() - tRequest}`,
        );
        return NextResponse.json(
          { error: "终版 JSON 结构不完整，请重试" },
          { status: 502 },
        );
      }

      let result = normalizeResponse(parsed, "result");

      if (experiencesSnapshot.length > 0) {
        result = applyExperienceSnapshotStamps(
          result,
          experiencesSnapshot,
          enhancedByMap,
        );
      }

      if (newAssets.length > 0) {
        const { sections: portfolioSections, warnings: portfolioWarnings } =
          await buildPortfolioSectionsFromNewAssets(
            openai,
            jdText,
            userNotes,
            newAssets,
          );
        processingWarnings.push(...portfolioWarnings);
        if (portfolioSections.length) {
          result = {
            ...result,
            sections: [...(result.sections ?? []), ...portfolioSections],
          };
        }
      }

      if (processingWarnings.length > 0) {
        result = {
          ...result,
          warnings: [
            ...(result.warnings ?? []),
            ...processingWarnings,
          ],
        };
      }

      console.log(
        `[timing][generate] END success phase=result totalMs=${Date.now() - tRequest}`,
      );
      return NextResponse.json(result);
    }

    if (!isValidDeepDive(parsed)) {
      console.log(
        `[timing][generate] END early invalid-deepdive totalMs=${Date.now() - tRequest}`,
      );
      return NextResponse.json(
        { error: "追问阶段 JSON 结构不完整，请重试" },
        { status: 502 },
      );
    }

    console.log(
      `[timing][generate] END success phase=deepdive totalMs=${Date.now() - tRequest}`,
    );
    return NextResponse.json(normalizeResponse(parsed, "deepdive"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    console.log(
      `[timing][generate] END error totalMs=${Date.now() - tRequest}`,
      message,
    );
    return NextResponse.json(
      { error: "DeepSeek 调用失败", detail: message },
      { status: 502 },
    );
  }
}
