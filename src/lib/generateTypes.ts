export type ResumeSectionType =
  | "experience"
  | "education"
  | "skills"
  | "project"
  | "other";

export type ResumeItemStatus = "revised" | "unchanged" | "weak";

export type ResumeRelevance = "high" | "medium" | "low";

export type ResumeSectionItem = {
  id: string;
  original: string;
  revised: string;
  revisedHtml: string;
  status: ResumeItemStatus;
  changeReason: string;
  relevanceToJd: ResumeRelevance;
  deepDivePrompts: string[];
};

export type ResumeSection = {
  id: string;
  type: ResumeSectionType;
  title: string;
  items: ResumeSectionItem[];
};

export type GeneratePhase = "deepdive" | "result";

/** /api/generate 与作品集解析的标准响应结构 */
export type GenerateApiResponse = {
  phase: GeneratePhase;
  matchScore: number;
  matchSubtitle: string;
  targetRole: string;
  /** 追问阶段为 null 或 []；终版为非空 sections */
  sections: ResumeSection[] | null;
  gapAnalysis: string;
  interviewDefense: string;
  clarifyingQuestions: string[];
};

export type ClarifyingAnswer = {
  question: string;
  answer: string;
};
