import { SYSTEM_PROMPT_DISTILL_DOCUMENT } from "@/lib/prompts";
import {
  DEEPSEEK_LARGE_MAX_TOKENS,
  deepseekChatCompletion,
  getDeepSeekClient,
} from "@/lib/deepseekCall";

/** 喂给提炼模型的原文上限 */
export const DISTILL_INPUT_MAX_CHARS = 15_000;
/** 提炼失败时的原文兜底长度（绝不回填全文） */
export const DISTILL_FALLBACK_CHARS = 1_500;

export type DistillDocumentResult = {
  insight: string;
  engine: "document-deepseek" | "document-fallback-1500";
  distillMs: number;
};

/**
 * 将文档抽出的全文提炼为约 500 字「核心事实清单」。
 * 失败时取原文前 1500 字兜底，并打 warn（不静默塞全文）。
 */
export async function distillDocumentToCoreFacts(options: {
  rawText: string;
  fileName: string;
  userNotes?: string;
}): Promise<DistillDocumentResult> {
  const { fileName, userNotes = "" } = options;
  const rawText = options.rawText.replace(/\s+/g, " ").trim();
  const input = rawText.slice(0, DISTILL_INPUT_MAX_CHARS);
  const fallback = rawText.slice(0, DISTILL_FALLBACK_CHARS);
  const t0 = Date.now();

  const openai = getDeepSeekClient();
  if (!openai) {
    const distillMs = Date.now() - t0;
    console.warn(
      "[distill-document] 未配置 DEEPSEEK_API_KEY，使用前 1500 字兜底",
      fileName,
    );
    console.log(
      `[timing] distill-document file=${fileName} ms=${distillMs} ok=false reason=no-api-key fallbackChars=${fallback.length}`,
    );
    return {
      insight: fallback,
      engine: "document-fallback-1500",
      distillMs,
    };
  }

  try {
    const completion = await deepseekChatCompletion(
      openai,
      `distill-document:${fileName}`,
      {
        temperature: 0.2,
        max_tokens: DEEPSEEK_LARGE_MAX_TOKENS,
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT_DISTILL_DOCUMENT },
          {
            role: "user",
            content: `## 文件名
${fileName}

## 用户备注
${userNotes || "（无）"}

## 作品原文（已截断至提炼输入上限）
${input}
`,
          },
        ],
      },
    );

    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    const distillMs = Date.now() - t0;

    if (!content) {
      console.warn(
        "[distill-document] DeepSeek 返回空内容，使用前 1500 字兜底",
        fileName,
      );
      console.log(
        `[timing] distill-document file=${fileName} ms=${distillMs} ok=false reason=empty fallbackChars=${fallback.length}`,
      );
      return {
        insight: fallback,
        engine: "document-fallback-1500",
        distillMs,
      };
    }

    console.log(
      `[timing] distill-document file=${fileName} ms=${distillMs} ok=true inputChars=${input.length} outChars=${content.length}`,
    );
    return {
      insight: content,
      engine: "document-deepseek",
      distillMs,
    };
  } catch (error) {
    const distillMs = Date.now() - t0;
    console.warn(
      "[distill-document] 提炼失败，使用前 1500 字兜底",
      fileName,
      error,
    );
    console.log(
      `[timing] distill-document file=${fileName} ms=${distillMs} ok=false reason=error fallbackChars=${fallback.length}`,
    );
    return {
      insight: fallback,
      engine: "document-fallback-1500",
      distillMs,
    };
  }
}
