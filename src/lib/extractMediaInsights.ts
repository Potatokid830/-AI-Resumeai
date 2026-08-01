import {
  GoogleGenerativeAI,
  type Part,
} from "@google/generative-ai";
import {
  FileState,
  GoogleAIFileManager,
} from "@google/generative-ai/server";
import { parseDocumentFromUrl } from "@/lib/parseDocument";

const VISION_PROMPT = `你是一位资深创意总监。请审阅该作品，提取其核心商业定位、品牌口号、视觉特效、剪辑手法或营销理念，输出 200 字以内的专业纯文本总结。不要使用 Markdown，不要编造无法从素材中推断的投放数据。`;

export type MediaInsightResult = {
  insight: string;
  engine: "gemini-vision" | "document-ocr" | "mock";
};

const MAX_GEMINI_UPLOAD_BYTES = 80 * 1024 * 1024;
const PROCESS_POLL_MS = 2_000;
const PROCESS_TIMEOUT_MS = 90_000;

function getExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function mimeFromFileName(fileName: string, contentTypeHeader = ""): string {
  const header = contentTypeHeader.split(";")[0]?.trim().toLowerCase();
  if (
    header &&
    header !== "application/octet-stream" &&
    header !== "binary/octet-stream"
  ) {
    return header;
  }

  const ext = getExtension(fileName);
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".pdf": "application/pdf",
    ".pptx":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMockInsight(fileName: string, userNotes: string): string {
  const ext = getExtension(fileName);
  const base = fileName.replace(/\.[^.]+$/, "") || "未命名作品";
  const noteHint = userNotes.trim()
    ? `创作者补充语境：${userNotes.trim().slice(0, 120)}。`
    : "创作者未补充额外说明，洞察基于文件元信息与品类惯例推断。";

  if (ext === ".mp4" || ext === ".mov" || ext === ".webm") {
    return `该作品《${base}》呈现为短视频/动态影像作品集单元。视觉叙事强调节奏卡点与品牌记忆点，剪辑上倾向多画幅适配与特效强化情绪峰值；商业定位偏向产品种草或品牌理念传达。${noteHint}建议后续补充投放渠道、完播率与转化指标以完成量化闭环。`;
  }

  if (ext === ".pptx") {
    return `该作品《${base}》为演示文稿型作品集，结构上侧重商业提案与视觉概念铺陈：封面定位、问题洞察、解决方案与视觉系统依次展开。设计语言强调信息层级与关键视觉钩子，适合用于面试中的项目路演。${noteHint}`;
  }

  return `该作品《${base}》为文档型作品集素材，内容围绕项目背景、创意策略与执行成果展开，具备可转译为 STAR 项目经历的商业叙事骨架。${noteHint}`;
}

async function waitForFileActive(
  fileManager: GoogleAIFileManager,
  fileName: string,
) {
  const started = Date.now();
  let meta = await fileManager.getFile(fileName);

  while (meta.state === FileState.PROCESSING) {
    if (Date.now() - started > PROCESS_TIMEOUT_MS) {
      throw new Error("Gemini 文件处理超时，请压缩后重试");
    }
    await sleep(PROCESS_POLL_MS);
    meta = await fileManager.getFile(fileName);
  }

  if (meta.state === FileState.FAILED) {
    throw new Error("Gemini 无法处理该媒体文件，请更换格式后重试");
  }

  if (meta.state !== FileState.ACTIVE) {
    throw new Error(`Gemini 文件状态异常：${meta.state}`);
  }

  return meta;
}

/**
 * 从 Vercel Blob 公开 URL 拉取文件 → 上传 Gemini Files API → 多模态审阅
 */
async function analyzeWithGemini(
  url: string,
  fileName: string,
  userNotes: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 GEMINI_API_KEY");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法下载云端文件（HTTP ${response.status}）`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length <= 0) {
    throw new Error("云端文件为空");
  }
  if (buffer.length > MAX_GEMINI_UPLOAD_BYTES) {
    throw new Error("文件超过 80MB，Gemini 阶段请先压缩后再解析");
  }

  const mimeType = mimeFromFileName(fileName, contentType);
  const fileManager = new GoogleAIFileManager(apiKey);

  const uploaded = await fileManager.uploadFile(buffer, {
    mimeType,
    displayName: fileName.slice(0, 100),
  });

  const fileId = uploaded.file.name;
  try {
    const activeFile = await waitForFileActive(fileManager, fileId);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      systemInstruction: VISION_PROMPT,
    });

    const mediaPart: Part = {
      fileData: {
        mimeType: activeFile.mimeType || mimeType,
        fileUri: activeFile.uri,
      },
    };

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            mediaPart,
            {
              text: `文件名：${fileName}\n用户备注：${userNotes || "无"}\n请审阅该作品并输出 200 字以内专业纯文本总结。`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
      },
    });

    const insight = result.response.text()?.trim();
    if (!insight) {
      throw new Error("Gemini 返回空内容");
    }
    return insight;
  } finally {
    // 临时文件 48h 过期；主动删除降低配额占用
    await fileManager.deleteFile(fileId).catch(() => undefined);
  }
}

/**
 * 阶段一：视觉感知（优先 Gemini 真实多模态）
 */
export async function extractMediaInsights(
  url: string,
  fileName: string,
  userNotes = "",
): Promise<MediaInsightResult> {
  const ext = getExtension(fileName);

  if (process.env.GEMINI_API_KEY) {
    try {
      const insight = await analyzeWithGemini(url, fileName, userNotes);
      return { insight, engine: "gemini-vision" };
    } catch (error) {
      console.warn("[extractMediaInsights] Gemini failed", error);
      // 继续降级
    }
  }

  // 降级：PDF 抽字拼洞察
  if (ext === ".pdf") {
    const parsed = await parseDocumentFromUrl(url, fileName);
    if (parsed.ok && parsed.text) {
      const excerpt = parsed.text.replace(/\s+/g, " ").slice(0, 280);
      return {
        engine: "document-ocr",
        insight: `基于文档抽取的作品洞察：《${fileName}》呈现清晰商业叙事骨架。核心摘录：「${excerpt}」。请结合视觉排版与信息层级，将其理解为可面试讲述的作品集单元；建议补充成果指标以完成量化闭环。`,
      };
    }
  }

  return {
    engine: "mock",
    insight: buildMockInsight(fileName, userNotes),
  };
}
