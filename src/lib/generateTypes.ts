export type ResumeSectionType =
  | "experience"
  | "education"
  | "skills"
  | "project"
  | "other";

export type ResumeItemStatus = "revised" | "unchanged" | "weak";

export type ResumeRelevance = "high" | "medium" | "low";

/** 经历来源：由 API 链写死，不由模型判断 */
export type ResumeItemSource = "resume" | "portfolio";

export type ResumeSectionItem = {
  id: string;
  original: string;
  revised: string;
  revisedHtml: string;
  status: ResumeItemStatus;
  changeReason: string;
  relevanceToJd: ResumeRelevance;
  deepDivePrompts: string[];
  source: ResumeItemSource;
  /** 仅 portfolio：如「基于作品集《xxx》提炼」 */
  sourceLabel?: string;
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

/** 阶段1：parse-experiences 切出的经历（id 由服务端顺序号写死） */
export type ParsedExperienceType =
  | "experience"
  | "project"
  | "education"
  | "other";

export type ParsedExperience = {
  id: string;
  title: string;
  /** 该段完整原文，阶段2增强直接用此快照，禁止二次切段 */
  original: string;
  type: ParsedExperienceType;
};

export type ParseExperiencesResponse = {
  experiences: ParsedExperience[];
};

/** 作品归属：new = 新项目；否则为 experiencesSnapshot 中的经历 id */
export type AssetBindTarget = "new" | (string & {});

export type AssetBinding = {
  assetId: string;
  name: string;
  url: string;
  size: number;
  bindTo: AssetBindTarget;
};
