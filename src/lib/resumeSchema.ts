import type {
  GenerateApiResponse,
  GeneratePhase,
  ParsedExperience,
  ResumeItemSource,
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

export type NormalizeGenerateOptions = {
  matchSubtitle?: string;
  /** 由调用链写死；默认 resume */
  itemSource?: ResumeItemSource;
  /** portfolio 时由代码生成的来源标签，会覆盖 original / sourceLabel */
  portfolioLabel?: string;
};

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

function stampItemSource(
  item: ResumeSectionItem,
  itemSource: ResumeItemSource,
  portfolioLabel?: string,
): ResumeSectionItem {
  if (itemSource === "portfolio") {
    const label = (
      portfolioLabel ||
      item.sourceLabel ||
      "基于上传作品集提炼"
    ).trim();
    return {
      ...item,
      source: "portfolio",
      sourceLabel: label,
      original: label,
    };
  }

  const { sourceLabel: _drop, ...rest } = item;
  return {
    ...rest,
    source: "resume",
  };
}

function normalizeItem(
  raw: unknown,
  index: number,
  itemSource: ResumeItemSource,
): ResumeSectionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id, `item_${index + 1}`);
  const original = asString(row.original);
  const revised = asString(row.revised);

  // portfolio：允许缺 original（稍后由代码盖章）；resume：至少要有原文或改写
  if (itemSource === "portfolio") {
    if (!revised.trim()) return null;
  } else if (!original && !revised) {
    return null;
  }

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

  const enhancedBy = Array.isArray(row.enhancedBy)
    ? row.enhancedBy.filter(
        (name): name is string => typeof name === "string" && name.trim().length > 0,
      )
    : undefined;

  const base: ResumeSectionItem = {
    id,
    original,
    revised: revised || original,
    revisedHtml,
    status,
    changeReason: asString(row.changeReason),
    relevanceToJd,
    deepDivePrompts,
    source: itemSource,
    ...(enhancedBy?.length ? { enhancedBy } : {}),
  };

  return base;
}

function normalizeSection(
  raw: unknown,
  index: number,
  itemSource: ResumeItemSource,
  portfolioLabel?: string,
): ResumeSection | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (!Array.isArray(row.items)) return null;

  const items = row.items
    .map((item, itemIndex) => normalizeItem(item, itemIndex, itemSource))
    .filter((item): item is ResumeSectionItem => Boolean(item))
    .map((item) => stampItemSource(item, itemSource, portfolioLabel));

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
    if (!Array.isArray(row.items) || row.items.length === 0) return false;
    // 至少有一条带 revised，或带 original（resume）
    return row.items.some((item) => {
      if (!item || typeof item !== "object") return false;
      const it = item as Record<string, unknown>;
      return (
        (typeof it.revised === "string" && it.revised.trim().length > 0) ||
        (typeof it.original === "string" && it.original.trim().length > 0)
      );
    });
  });
}

export function normalizeSections(
  raw: unknown,
  itemSource: ResumeItemSource = "resume",
  portfolioLabel?: string,
): ResumeSection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((section, index) =>
      normalizeSection(section, index, itemSource, portfolioLabel),
    )
    .filter((section): section is ResumeSection => Boolean(section));
}

export function normalizeGenerateResponse(
  data: Record<string, unknown> | GenerateApiResponse,
  phase: GeneratePhase,
  defaults?: NormalizeGenerateOptions,
): GenerateApiResponse {
  const matchScoreRaw =
    typeof data.matchScore === "number" ? data.matchScore : 0;

  const itemSource = defaults?.itemSource ?? "resume";
  const sections =
    phase === "result"
      ? normalizeSections(data.sections, itemSource, defaults?.portfolioLabel)
      : null;

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
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter(
          (w): w is string => typeof w === "string" && w.trim().length > 0,
        )
      : undefined,
  };
}

/** 由文件名生成作品集来源标签（不编造页数） */
export function buildPortfolioSourceLabel(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || fileName.trim() || "未命名作品集";
  return `基于作品集《${base}》提炼`;
}

/**
 * 用 experiencesSnapshot 强制盖章 resume 项的 id/original，并写入 enhancedBy。
 * 保证配对经历与被增强经历为同一条。
 */
export function applyExperienceSnapshotStamps(
  response: GenerateApiResponse,
  snapshot: ParsedExperience[],
  enhancedByMap: Record<string, string[]>,
): GenerateApiResponse {
  if (!response.sections?.length || !snapshot.length) return response;

  const used = new Set<string>();

  const sections = response.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.source === "portfolio") return item;

      let snap =
        snapshot.find((s) => s.id === item.id && !used.has(s.id)) ??
        snapshot.find((s) => !used.has(s.id));

      if (!snap) {
        return { ...item, source: "resume" as const };
      }

      used.add(snap.id);
      const enhancedBy = enhancedByMap[snap.id]?.filter(Boolean);
      return {
        ...item,
        id: snap.id,
        original: snap.original,
        source: "resume" as const,
        enhancedBy: enhancedBy?.length ? enhancedBy : undefined,
      };
    }),
  }));

  return { ...response, sections };
}
