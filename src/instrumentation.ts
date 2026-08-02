/**
 * Node serverless 冷启动时显式挂上 Math.sumPrecise。
 * 解析 PDF 前 parseDocument 还会再调一次 ensureMathSumPrecise 兜底。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureMathSumPrecise } = await import(
      "@/lib/polyfills/mathSumPrecise"
    );
    const kind = ensureMathSumPrecise();
    console.log(`[polyfill] instrumentation register Math.sumPrecise typeof=${kind}`);
  }
}
