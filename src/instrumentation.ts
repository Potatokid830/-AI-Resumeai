/**
 * 在 Node serverless 启动时尽早打上 Math.sumPrecise polyfill，
 * 避免 unpdf/PDF.js 在解析 PDF 时因缺失该 API 而疯狂抛错。
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/polyfills/mathSumPrecise");
  }
}
