import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { fetchBlobBuffer } from "@/lib/fetchBlobBuffer";
import { ensureMathSumPrecise } from "@/lib/polyfills/mathSumPrecise";

/** Serverless 内解析上限，避免超大视频/文件撑爆内存 */
export const MAX_PARSE_BYTES = 40 * 1024 * 1024;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

export type ParseDocumentResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; error: string };

function getExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // 显式调用，避免 side-effect import 被 tree-shake；必须在 unpdf/PDF.js 跑之前挂上
  const sumPreciseType = ensureMathSumPrecise();
  console.log(
    `[polyfill] Math.sumPrecise typeof=${sumPreciseType} (must be function before PDF.js)`,
  );

  const t0 = Date.now();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const proxyMs = Date.now() - t0;
  const tExtract = Date.now();
  const { text } = await extractText(pdf, { mergePages: true });
  const extractMs = Date.now() - tExtract;
  console.log(
    `[timing] extractPdfText bytes=${buffer.length} proxyMs=${proxyMs} extractMs=${extractMs} totalMs=${Date.now() - t0} sumPrecise=${typeof globalThis.Math.sumPrecise}`,
  );
  return (text ?? "").trim();
}

/** 从 Buffer 解析可提取文本的文档（PDF / DOCX） */
export async function parseDocumentBuffer(
  buffer: Buffer,
  fileName: string,
  mime = "",
): Promise<ParseDocumentResult> {
  if (buffer.length <= 0) {
    return { ok: false, error: "文件为空，请重新上传" };
  }

  if (buffer.length > MAX_PARSE_BYTES) {
    return {
      ok: false,
      error: "文件过大，服务端解析上限为 40MB（请压缩后重试）",
    };
  }

  const extension = getExtension(fileName);
  const t0 = Date.now();

  try {
    if (mime === "application/pdf" || extension === ".pdf") {
      const text = await extractPdfText(buffer);
      console.log(
        `[timing] parseDocumentBuffer PDF file=${fileName} bytes=${buffer.length} ms=${Date.now() - t0} ok=${Boolean(text)}`,
      );
      if (!text) {
        return {
          ok: false,
          error: "未能从 PDF 中提取文字，文件可能是扫描件或已损坏",
        };
      }
      return { ok: true, text, fileName };
    }

    if (mime === DOCX_MIME || extension === ".docx") {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim() ?? "";
      console.log(
        `[timing] parseDocumentBuffer DOCX file=${fileName} bytes=${buffer.length} ms=${Date.now() - t0} ok=${Boolean(text)}`,
      );
      if (!text) {
        return {
          ok: false,
          error: "未能从 Word 文档中提取文字，请检查文件是否损坏",
        };
      }
      return { ok: true, text, fileName };
    }

    if (mime === DOC_MIME || extension === ".doc") {
      return {
        ok: false,
        error: "暂不支持旧版 .doc，请另存为 .docx 或 PDF 后再上传",
      };
    }

    if (extension === ".csv" || mime === "text/csv" || mime === "text/plain") {
      const text = buffer.toString("utf8").trim();
      if (!text) {
        return { ok: false, error: "文本/表格文件为空" };
      }
      return { ok: true, text: text.slice(0, 80_000), fileName };
    }

    return {
      ok: false,
      error: "该文件类型暂不支持服务端文本提取",
    };
  } catch {
    return {
      ok: false,
      error: "文件解析失败，文件可能已损坏，请换一份后重试",
    };
  }
}

function fileNameFromUrl(url: string, fallback: string) {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop();
    return base ? decodeURIComponent(base) : fallback;
  } catch {
    return fallback;
  }
}

/** 从 Private Blob URL 拉取并解析可提取文本的文件 */
export async function parseDocumentFromUrl(
  url: string,
  preferredName?: string,
): Promise<ParseDocumentResult> {
  const fileName = preferredName || fileNameFromUrl(url, "document");
  const t0 = Date.now();
  try {
    const blob = await fetchBlobBuffer(url);
    const downloadMs = Date.now() - t0;
    if (!blob) {
      console.log(
        `[timing] parseDocumentFromUrl FAIL file=${fileName} downloadMs=${downloadMs} reason=blob-null`,
      );
      return {
        ok: false,
        error: "无法下载云端文件（Private Blob 读取失败）",
      };
    }

    const tParse = Date.now();
    const parsed = await parseDocumentBuffer(
      blob.buffer,
      fileName,
      blob.contentType.split(";")[0]?.trim(),
    );
    const parseMs = Date.now() - tParse;
    console.log(
      `[timing] parseDocumentFromUrl DONE file=${fileName} downloadMs=${downloadMs} parseMs=${parseMs} totalMs=${Date.now() - t0} ok=${parsed.ok}`,
    );
    return parsed;
  } catch (error) {
    console.log(
      `[timing] parseDocumentFromUrl ERROR file=${fileName} totalMs=${Date.now() - t0}`,
      error,
    );
    return {
      ok: false,
      error: "下载或解析云端文件失败，请重新上传后重试",
    };
  }
}

export function isTextExtractable(fileName: string) {
  const ext = getExtension(fileName);
  return [".pdf", ".docx", ".csv", ".txt"].includes(ext);
}
