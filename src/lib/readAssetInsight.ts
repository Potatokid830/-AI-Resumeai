import { extractMediaInsights } from "@/lib/extractMediaInsights";
import {
  isTextExtractable,
  parseDocumentFromUrl,
} from "@/lib/parseDocument";

export type AssetInsight = {
  assetId: string;
  fileName: string;
  url: string;
  insight: string;
  engine: string;
};

const VISION_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
]);

function getExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

/**
 * 按扩展名读作品内容（代码分流，不靠 AI 选引擎）。
 * - 可抽文字 → DeepSeek 侧用的纯文本摘录
 * - 视频/图片 → Gemini extractMediaInsights
 */
export async function readAssetInsight(options: {
  assetId: string;
  fileName: string;
  url: string;
  userNotes?: string;
}): Promise<AssetInsight> {
  const { assetId, fileName, url, userNotes = "" } = options;
  const ext = getExtension(fileName);

  if (VISION_EXTENSIONS.has(ext)) {
    try {
      const result = await extractMediaInsights(url, fileName, userNotes);
      return {
        assetId,
        fileName,
        url,
        insight: result.insight,
        engine: result.engine,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "视觉读取失败";
      return {
        assetId,
        fileName,
        url,
        insight: `（作品读取失败：${message}。请勿编造该作品内容。）`,
        engine: "error",
      };
    }
  }

  if (isTextExtractable(fileName) || ext === ".pptx") {
    try {
      const parsed = await parseDocumentFromUrl(url, fileName);
      if (parsed.ok && parsed.text.trim()) {
        const text = parsed.text.replace(/\s+/g, " ").trim().slice(0, 8_000);
        return {
          assetId,
          fileName,
          url,
          insight: text,
          engine: "document-text",
        };
      }
      return {
        assetId,
        fileName,
        url,
        insight: `（未能从《${fileName}》提取有效文字。请勿编造该作品内容。）`,
        engine: "document-empty",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "文档读取失败";
      return {
        assetId,
        fileName,
        url,
        insight: `（作品读取失败：${message}。请勿编造该作品内容。）`,
        engine: "error",
      };
    }
  }

  // 未知类型：仍尝试 Gemini（可能是其它媒体）
  try {
    const result = await extractMediaInsights(url, fileName, userNotes);
    return {
      assetId,
      fileName,
      url,
      insight: result.insight,
      engine: result.engine,
    };
  } catch {
    return {
      assetId,
      fileName,
      url,
      insight: `（暂不支持解析《${fileName}》的内容类型。请勿编造该作品内容。）`,
      engine: "unsupported",
    };
  }
}
