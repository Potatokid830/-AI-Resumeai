/**
 * PDF.js（unpdf 内嵌 serverless build）会调用 Math.sumPrecise。
 * Vercel Node 无此 API；缺失时会对每个字形/文本块 warn 刷屏。
 *
 * 必须通过「具名导出 + 显式调用」挂载，不能只靠副作用 import：
 * unpdf 在 serverExternalPackages 中，side-effect-only import 可能被 tree-shake 掉。
 */
declare global {
  interface Math {
    sumPrecise(numbers: Iterable<number>): number;
  }
}

function sumPreciseImpl(numbers: Iterable<number>): number {
  let sum = 0;
  for (const value of numbers) {
    sum += Number(value);
  }
  return sum;
}

/** 挂到 globalThis.Math，返回当前 typeof 便于打日志确认 */
export function ensureMathSumPrecise(): string {
  const math = globalThis.Math;
  if (typeof math.sumPrecise !== "function") {
    try {
      Object.defineProperty(math, "sumPrecise", {
        value: sumPreciseImpl,
        writable: true,
        configurable: true,
        enumerable: false,
      });
    } catch {
      math.sumPrecise = sumPreciseImpl;
    }
  }
  return typeof globalThis.Math.sumPrecise;
}
