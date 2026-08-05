import type { ResumeContact } from "@/lib/resumeContact";

export type { ResumeContact } from "@/lib/resumeContact";

export type ResumeSectionType =
  | "profile"
  | "education"
  | "experience"
  | "project"
  | "skills"
  | "certifications"
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
  /** 代码盖章：用哪些作品文件增强了这条 resume 经历 */
  enhancedBy?: string[];
  /**
   * 条目级排版字段（投递真源）。
   * 原文/用户补充里没有的元数据必须省略或空，禁止编造（尤其 dateRange）。
   */
  title?: string;
  organization?: string;
  location?: string;
  dateRange?: string;
  bullets?: string[];
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
  /** 作品处理失败 / 超上限等可见提示（可选） */
  warnings?: string[];
  /** 从原简历抽取的联系方式；缺字段为空 */
  contact?: ResumeContact;
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
  /** 该段完整原文，阶段2 增强直接用此快照，禁止二次切段 */
  original: string;
  type: ParsedExperienceType;
};

export type ParseExperiencesResponse = {
  experiences: ParsedExperience[];
  contact?: ResumeContact;
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
