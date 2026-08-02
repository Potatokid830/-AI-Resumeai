import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

/** 主改写 / 文档提炼等大 JSON 输出的 token 上限 */
export const DEEPSEEK_LARGE_MAX_TOKENS = 8_000;

export function getDeepSeekClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    apiKey,
  });
}

export function resolveDeepSeekModel() {
  return process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
}

type DeepSeekCreateParams = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "model" | "stream"
> & {
  /**
   * DeepSeek V4：官方 OpenAI 格式为 body 内 `thinking: { type: "enabled"|"disabled" }`。
   * Python SDK 用 extra_body 传入同一字段；Node SDK 直接放进 create body 即可随 JSON 发出。
   * 默认 disabled（V4 官方默认是 enabled，不关会烧 reasoning token）。
   */
  thinking?: { type: "enabled" | "disabled" };
  reasoning_effort?: "low" | "high" | "max" | "xhigh";
};

function messageContentChars(content: ChatCompletionMessageParam["content"]) {
  if (typeof content === "string") return content.length;
  if (content == null) return 0;
  try {
    return JSON.stringify(content).length;
  } catch {
    return 0;
  }
}

function summarizePromptChars(messages: ChatCompletionMessageParam[] | undefined) {
  let systemChars = 0;
  let userChars = 0;
  let otherChars = 0;
  for (const message of messages ?? []) {
    const n = messageContentChars(message.content);
    if (message.role === "system") systemChars += n;
    else if (message.role === "user") userChars += n;
    else otherChars += n;
  }
  return {
    systemChars,
    userChars,
    otherChars,
    totalChars: systemChars + userChars + otherChars,
  };
}

function usageSnapshot(usage: ChatCompletion["usage"]) {
  if (!usage) return null;
  const details = (
    usage as {
      completion_tokens_details?: {
        reasoning_tokens?: number;
      };
    }
  ).completion_tokens_details;
  return {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    reasoning_tokens: details?.reasoning_tokens ?? null,
  };
}

/**
 * 统一 DeepSeek chat.completions：
 * - 默认关闭 thinking（官方 V4 默认开启）
 * - 打印请求参数 + prompt 字符数
 * - 空/异常时打印 finish_reason、completion_tokens、reasoning_content 长度
 */
export async function deepseekChatCompletion(
  openai: OpenAI,
  label: string,
  params: DeepSeekCreateParams,
): Promise<ChatCompletion> {
  const model = resolveDeepSeekModel();
  const {
    thinking = { type: "disabled" },
    reasoning_effort,
    ...rest
  } = params;
  const promptChars = summarizePromptChars(rest.messages);

  const requestSnapshot = {
    label,
    model,
    temperature: rest.temperature ?? null,
    max_tokens: rest.max_tokens ?? null,
    response_format: rest.response_format ?? null,
    thinking,
    reasoning_effort: reasoning_effort ?? null,
    promptChars,
  };
  console.log(`[deepseek] REQUEST ${JSON.stringify(requestSnapshot)}`);

  // thinking 必须出现在 JSON body 顶层（官方文档）；Node SDK 会原样序列化 body
  const body = {
    ...rest,
    model,
    stream: false as const,
    thinking,
    ...(reasoning_effort ? { reasoning_effort } : {}),
  };

  let completion: ChatCompletion;
  try {
    completion = await openai.chat.completions.create(
      body as ChatCompletionCreateParamsNonStreaming,
    );
  } catch (error) {
    console.log(
      `[deepseek] ERROR ${label} ${JSON.stringify({
        model,
        thinking,
        max_tokens: rest.max_tokens ?? null,
        promptChars,
        error: error instanceof Error ? error.message : String(error),
      })}`,
    );
    throw error;
  }

  const choice = completion.choices[0];
  const message = choice?.message as
    | (ChatCompletion["choices"][0]["message"] & {
        reasoning_content?: string | null;
        refusal?: string | null;
      })
    | undefined;
  const contentRaw = message?.content;
  const content = typeof contentRaw === "string" ? contentRaw.trim() : "";
  const reasoning =
    typeof message?.reasoning_content === "string"
      ? message.reasoning_content
      : null;
  const finishReason = choice?.finish_reason ?? null;
  const usage = usageSnapshot(completion.usage);

  const responseDiag = {
    id: completion.id,
    model: completion.model,
    finish_reason: finishReason,
    content_chars: content.length,
    content_null: contentRaw == null,
    reasoning_content_chars: reasoning?.length ?? 0,
    reasoning_content_preview: reasoning
      ? reasoning.slice(0, 200)
      : null,
    refusal: message?.refusal ?? null,
    usage,
    truncated: finishReason === "length",
  };

  if (!content) {
    console.log(
      `[deepseek] EMPTY_RESPONSE ${label} ${JSON.stringify({
        ...responseDiag,
        content: contentRaw ?? null,
        reasoning_content: reasoning,
        message_keys: message ? Object.keys(message) : [],
        raw_choice: choice ?? null,
      })}`,
    );
  } else if (finishReason === "length") {
    console.log(
      `[deepseek] TRUNCATED ${label} ${JSON.stringify(responseDiag)}`,
    );
  } else {
    console.log(
      `[deepseek] OK ${label} ${JSON.stringify(responseDiag)}`,
    );
  }

  return completion;
}
