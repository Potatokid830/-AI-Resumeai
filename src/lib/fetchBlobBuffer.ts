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

function blobLabel(url: string) {
  try {
    const base = new URL(url).pathname.split("/").pop();
    return base ? decodeURIComponent(base) : url.slice(0, 64);
  } catch {
    return url.slice(0, 64);
  }
}

/**
 * 从 Private Blob Store 安全拉取文件内容（需 BLOB_READ_WRITE_TOKEN）
 */
export async function fetchBlobBuffer(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const label = blobLabel(url);
  const t0 = Date.now();
  const result = await get(url, { access: "private" });
  const getMs = Date.now() - t0;

  if (!result || result.statusCode !== 200 || !result.stream) {
    console.log(
      `[timing] fetchBlobBuffer FAIL label=${label} getMs=${getMs} status=${result?.statusCode ?? "null"}`,
    );
    return null;
  }

  const tStream = Date.now();
  const buffer = await streamToBuffer(result.stream);
  const streamMs = Date.now() - tStream;
  const totalMs = Date.now() - t0;

  console.log(
    `[timing] fetchBlobBuffer OK label=${label} bytes=${buffer.length} getMs=${getMs} streamMs=${streamMs} totalMs=${totalMs}`,
  );

  return {
    buffer,
    contentType: result.blob.contentType || "",
  };
}
