import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

const MAX_BYTES = 10 * 1024 * 1024;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

export type ParseResumeResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; error: string };

function getExtension(name: string) {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // unpdf：Serverless / Node 友好，不依赖 DOMMatrix
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return (text ?? "").trim();
}

export async function parseResumeFile(
  file: File,
): Promise<ParseResumeResult> {
  if (file.size <= 0) {
    return { ok: false, error: "简历文件为空，请重新上传" };
  }

  if (file.size > MAX_BYTES) {
    return { ok: false, error: "简历文件不能超过 10MB" };
  }

  const fileName = file.name || "resume";
  const extension = getExtension(fileName);
  const mime = file.type;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    if (mime === "application/pdf" || extension === ".pdf") {
      const text = await extractPdfText(buffer);
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

    return {
      ok: false,
      error: "仅支持 PDF / DOC / DOCX 简历文件",
    };
  } catch {
    return {
      ok: false,
      error: "简历解析失败，文件可能已损坏，请换一份后重试",
    };
  }
}
