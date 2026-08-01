export type OptimizedResumeBullet = {
  letter: "S" | "T" | "A" | "R";
  label: string;
  /** STAR 正文，对齐 JD 的关键词用 <mark> 包裹 */
  html: string;
};

export type OptimizedResume = {
  role: string;
  company: string;
  matchedKeywords: string[];
  /** 摘要，对齐 JD 的关键词用 <mark> 包裹 */
  summaryHtml: string;
  bullets: OptimizedResumeBullet[];
};

export type GeneratePhase = "deepdive" | "result";

/** /api/generate 的标准响应结构 */
export type GenerateApiResponse = {
  phase: GeneratePhase;
  matchScore: number;
  matchSubtitle: string;
  /** 追问阶段可为 null；终版必填 */
  optimizedResume: OptimizedResume | null;
  gapAnalysis: string;
  interviewDefense: string;
  clarifyingQuestions: string[];
};

export type ClarifyingAnswer = {
  question: string;
  answer: string;
};
