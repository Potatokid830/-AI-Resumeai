import { get } from "@vercel/blob";

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

/**
 * 从 Private Blob Store 安全拉取文件内容（需 BLOB_READ_WRITE_TOKEN）
 */
export async function fetchBlobBuffer(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const result = await get(url, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }

  const buffer = await streamToBuffer(result.stream);
  return {
    buffer,
    contentType: result.blob.contentType || "",
  };
}
