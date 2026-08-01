import type {
  GenerateApiResponse,
  GeneratePhase,
  ResumeItemStatus,
  ResumeRelevance,
  ResumeSection,
  ResumeSectionItem,
  ResumeSectionType,
} from "@/lib/generateTypes";

const SECTION_TYPES: ResumeSectionType[] = [
  "experience",
  "education",
  "skills",
  "project",
  "other",
];

const ITEM_STATUSES: ResumeItemStatus[] = ["revised", "unchanged", "weak"];

const RELEVANCE: ResumeRelevance[] = ["high", "medium", "low"];

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeSectionType(value: unknown): ResumeSectionType {
  if (typeof value === "string" && SECTION_TYPES.includes(value as ResumeSectionType)) {
    return value as ResumeSectionType;
  }
  return "other";
}

function normalizeItemStatus(value: unknown): ResumeItemStatus {
  if (typeof value === "string" && ITEM_STATUSES.includes(value as ResumeItemStatus)) {
    return value as ResumeItemStatus;
  }
  return "revised";
}

function normalizeRelevance(value: unknown): ResumeRelevance {
  if (typeof value === "string" && RELEVANCE.includes(value as ResumeRelevance)) {
    return value as ResumeRelevance;
  }
  return "medium";
}

function normalizeItem(raw: unknown, index: number): ResumeSectionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id, `item_${index + 1}`);
  const original = asString(row.original);
  const revised = asString(row.revised);
  // 至少要有一段可读正文
  if (!original && !revised) return null;

  const status = normalizeItemStatus(row.status);
  const relevanceToJd = normalizeRelevance(row.relevanceToJd);
  let deepDivePrompts = Array.isArray(row.deepDivePrompts)
    ? row.deepDivePrompts.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];

  if (!(status === "weak" && (relevanceToJd === "high" || relevanceToJd === "medium"))) {
    deepDivePrompts = [];
  } else {
    deepDivePrompts = deepDivePrompts.slice(0, 2);
  }

  const revisedHtml =
    asString(row.revisedHtml) ||
    (revised ? revised.replace(/</g, "&lt;").replace(/>/g, "&gt;") : "");

  return {
    id,
    original,
    revised: revised || original,
    revisedHtml,
    status,
    changeReason: asString(row.changeReason),
    relevanceToJd,
    deepDivePrompts,
  };
}

function normalizeSection(raw: unknown, index: number): ResumeSection | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.items)) return null;

  const items = row.items
    .map((item, itemIndex) => normalizeItem(item, itemIndex))
    .filter((item): item is ResumeSectionItem => Boolean(item));

  if (!items.length) return null;

  return {
    id: asString(row.id, `sec_${index + 1}`),
    type: normalizeSectionType(row.type),
    title: asString(row.title, "经历"),
    items,
  };
}

/** 终版：至少有一个非空 section */
export function isValidFinalSections(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const value = data as Record<string, unknown>;
  if (typeof value.matchScore !== "number") return false;
  if (typeof value.gapAnalysis !== "string") return false;
  if (typeof value.interviewDefense !== "string") return false;
  if (!Array.isArray(value.sections) || value.sections.length === 0) return false;

  return value.sections.some((section) => {
    if (!section || typeof section !== "object") return false;
    const row = section as Record<string, unknown>;
    return Array.isArray(row.items) && row.items.length > 0;
  });
}

export function normalizeSections(raw: unknown): ResumeSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((section, index) => normalizeSection(section, index))
    .filter((section): section is ResumeSection => Boolean(section));
}

export function normalizeGenerateResponse(
  data: Record<string, unknown> | GenerateApiResponse,
  phase: GeneratePhase,
  defaults?: { matchSubtitle?: string },
): GenerateApiResponse {
  const matchScoreRaw =
    typeof data.matchScore === "number" ? data.matchScore : 0;

  const sections =
    phase === "result" ? normalizeSections(data.sections) : null;

  return {
    phase,
    matchScore: Math.min(100, Math.max(0, Math.round(matchScoreRaw))),
    matchSubtitle:
      typeof data.matchSubtitle === "string" && data.matchSubtitle.trim()
        ? data.matchSubtitle
        : (defaults?.matchSubtitle ??
          (phase === "deepdive" ? "仍有关键细节待补充" : "已完成 JD 对齐分析")),
    targetRole: typeof data.targetRole === "string" ? data.targetRole : "",
    sections,
    gapAnalysis: typeof data.gapAnalysis === "string" ? data.gapAnalysis : "",
    interviewDefense:
      typeof data.interviewDefense === "string" ? data.interviewDefense : "",
    clarifyingQuestions: Array.isArray(data.clarifyingQuestions)
      ? data.clarifyingQuestions
          .filter((q): q is string => typeof q === "string" && Boolean(q))
          .slice(0, 3)
      : [],
  };
}
