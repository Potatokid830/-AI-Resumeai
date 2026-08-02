import {
  DISTILL_INPUT_MAX_CHARS,
  distillDocumentToCoreFacts,
} from "@/lib/distillDocumentInsight";
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
  /** 文档提炼 DeepSeek 耗时（视觉类 / raw 无此字段） */
  distillMs?: number;
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
 * - 可抽文字 + distill=true（增强路径）→ DeepSeek 提炼核心事实
 * - 可抽文字 + distill=false（新项目路径）→ 仅返回原文截断，留给一次 portfolio 调用
 * - 视频/图片 → Gemini extractMediaInsights
 */
export async function readAssetInsight(options: {
  assetId: string;
  fileName: string;
  url: string;
  userNotes?: string;
  /** 默认 true。新项目应传 false，省掉与 portfolio-new 重复的 distill */
  distill?: boolean;
}): Promise<AssetInsight> {
  const {
    assetId,
    fileName,
    url,
    userNotes = "",
    distill = true,
  } = options;
  const ext = getExtension(fileName);
  const t0 = Date.now();

  if (VISION_EXTENSIONS.has(ext)) {
    try {
      const result = await extractMediaInsights(url, fileName, userNotes);
      console.log(
        `[timing] readAssetInsight VISION file=${fileName} engine=${result.engine} ms=${Date.now() - t0}`,
      );
      return {
        assetId,
        fileName,
        url,
        insight: result.insight,
        engine: result.engine,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "视觉读取失败";
      console.log(
        `[timing] readAssetInsight VISION-FAIL file=${fileName} ms=${Date.now() - t0}`,
        message,
      );
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
        if (!distill) {
          const raw = parsed.text.replace(/\s+/g, " ").trim().slice(0, DISTILL_INPUT_MAX_CHARS);
          console.log(
            `[timing] readAssetInsight DOC-RAW file=${fileName} engine=document-raw chars=${raw.length} ms=${Date.now() - t0}`,
          );
          return {
            assetId,
            fileName,
            url,
            insight: raw,
            engine: "document-raw",
          };
        }

        const distilled = await distillDocumentToCoreFacts({
          rawText: parsed.text,
          fileName,
          userNotes,
        });
        console.log(
          `[timing] readAssetInsight DOC file=${fileName} engine=${distilled.engine} chars=${distilled.insight.length} distillMs=${distilled.distillMs} totalMs=${Date.now() - t0}`,
        );
        return {
          assetId,
          fileName,
          url,
          insight: distilled.insight,
          engine: distilled.engine,
          distillMs: distilled.distillMs,
        };
      }
      console.log(
        `[timing] readAssetInsight DOC-EMPTY file=${fileName} ms=${Date.now() - t0}`,
      );
      return {
        assetId,
        fileName,
        url,
        insight: `（未能从《${fileName}》提取有效文字。请勿编造该作品内容。）`,
        engine: "document-empty",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "文档读取失败";
      console.log(
        `[timing] readAssetInsight DOC-FAIL file=${fileName} ms=${Date.now() - t0}`,
        message,
      );
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
    console.log(
      `[timing] readAssetInsight FALLBACK-VISION file=${fileName} engine=${result.engine} ms=${Date.now() - t0}`,
    );
    return {
      assetId,
      fileName,
      url,
      insight: result.insight,
      engine: result.engine,
    };
  } catch {
    console.log(
      `[timing] readAssetInsight UNSUPPORTED file=${fileName} ms=${Date.now() - t0}`,
    );
    return {
      assetId,
      fileName,
      url,
      insight: `（暂不支持解析《${fileName}》的内容类型。请勿编造该作品内容。）`,
      engine: "unsupported",
    };
  }
}
