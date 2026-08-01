import {
  parseDocumentBuffer,
  type ParseDocumentResult,
} from "@/lib/parseDocument";

export type ParseResumeResult = ParseDocumentResult;

/** @deprecated 优先使用 Blob URL + parseDocumentFromUrl；保留 File 入口供兼容 */
export async function parseResumeFile(
  file: File,
): Promise<ParseResumeResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return parseDocumentBuffer(buffer, file.name || "resume", file.type);
}
