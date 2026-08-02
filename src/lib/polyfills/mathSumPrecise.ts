/**
 * PDF.js (via unpdf 内嵌 serverless build) 会调用 Math.sumPrecise。
 * 该 API 在多数 Node / Vercel 运行时尚未原生提供；缺失时会对每个字形/文本块
 * 反复抛 TypeError 并刷屏，拖垮函数直到超时。
 *
 * 与 mozilla/pdf.js 曾内置的简易 polyfill 等价（对 reduce 求和场景足够）。
 */
declare global {
  interface Math {
    sumPrecise(numbers: Iterable<number>): number;
  }
}

if (typeof Math.sumPrecise !== "function") {
  Math.sumPrecise = function sumPrecise(numbers: Iterable<number>): number {
    let sum = 0;
    for (const value of numbers) {
      sum += Number(value);
    }
    return sum;
  };
}

export {};
