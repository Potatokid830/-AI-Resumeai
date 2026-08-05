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
import { normalizeContact } from "@/lib/resumeContact";

const SECTION_TYPES: ResumeSectionType[] = [
  "profile",
  "education",
  "experience",
  "project",
  "skills",
  "certifications",
  "other",
];

/** 成品简历标准章节顺序 */
export const RESUME_SECTION_ORDER: ResumeSectionType[] = [
  "profile",
  "education",
  "experience",
  "project",
  "skills",
  "certifications",
  "other",
];

export function sortResumeSections(sections: ResumeSection[]): ResumeSection[] {
  return [...sections].sort((a, b) => {
    const ai = RESUME_SECTION_ORDER.indexOf(a.type);
    const bi = RESUME_SECTION_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

const ITEM_STATUSES: ResumeItemStatus[] = ["revised", "unchanged", "weak"];

const RELEVANCE: ResumeRelevance[] = ["high", "medium", "low"];

const MAX_ENTRY_TITLE = 120;
const MAX_ORG = 120;
const MAX_LOCATION = 80;
const MAX_DATE_RANGE = 60;
const MAX_BULLETS = 8;
const MAX_BULLET_LEN = 400;

/** 明显占位/空话，规范化时丢弃，避免「有字段就编日期」 */
const META_PLACEHOLDER_RE =
  /^(未指定|未知|暂无|无|没有|n\/?a|tbd|null|none|待定|待补充|-|—|–|\.{1,3})$/i;

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

function cleanMetaField(value: unknown, max: number): string {
  const text = asString(value).replace(/\s+/g, " ").trim().slice(0, max);
  if (!text || META_PLACEHOLDER_RE.test(text)) return "";
  return text;
}

function normalizeBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const row of raw) {
    if (typeof row !== "string") continue;
    const line = row.replace(/\s+/g, " ").trim().slice(0, MAX_BULLET_LEN);
    if (!line) continue;
    out.push(line);
    if (out.length >= MAX_BULLETS) break;
  }
  return out;
}

function escapeHtml(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 是否具备可用的结构化排版数据 */
export function hasStructuredEntry(
  item: Pick<
    ResumeSectionItem,
    "title" | "organization" | "location" | "dateRange" | "bullets"
  >,
): boolean {
  return Boolean(
    item.title?.trim() ||
      item.organization?.trim() ||
      item.location?.trim() ||
      item.dateRange?.trim() ||
      (item.bullets && item.bullets.length > 0),
  );
}

/**
 * 由结构化字段合成纯文本 revised（对照/复制/fallback 共用）。
 * dateRange 仅在原文抽出时才有值；此处不编造。
 */
export function composeRevisedFromStructured(
  item: Pick<
    ResumeSectionItem,
    "title" | "organization" | "location" | "dateRange" | "bullets"
  >,
): string {
  const lines: string[] = [];
  const title = item.title?.trim() || "";
  if (title) lines.push(title);

  const metaParts = [item.organization, item.location, item.dateRange]
    .map((part) => part?.trim() || "")
    .filter(Boolean);
  if (metaParts.length) lines.push(metaParts.join(" · "));

  for (const bullet of item.bullets ?? []) {
    const line = bullet.trim();
    if (line) lines.push(line);
  }

  return lines.join("\n").trim();
}

function composeRevisedHtmlFallback(
  item: Pick<
    ResumeSectionItem,
    "title" | "organization" | "location" | "dateRange" | "bullets"
  >,
): string {
  return escapeHtml(composeRevisedFromStructured(item));
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
  let revised = asString(row.revised);

  const title = cleanMetaField(row.title, MAX_ENTRY_TITLE);
  const organization = cleanMetaField(row.organization, MAX_ORG);
  const location = cleanMetaField(row.location, MAX_LOCATION);
  const dateRange = cleanMetaField(row.dateRange, MAX_DATE_RANGE);
  const bullets = normalizeBullets(row.bullets);

  const structured = {
    ...(title ? { title } : {}),
    ...(organization ? { organization } : {}),
    ...(location ? { location } : {}),
    ...(dateRange ? { dateRange } : {}),
    ...(bullets.length ? { bullets } : {}),
  };

  const hasStructured = hasStructuredEntry(structured);
  if (hasStructured) {
    // 结构化为投递真源：覆盖 revised，避免与 bullets 双写漂移
    revised = composeRevisedFromStructured(structured);
  }

  // portfolio：允许缺 original；需有 revised 或结构化内容
  if (itemSource === "portfolio") {
    if (!revised.trim() && !hasStructured) return null;
  } else if (!original && !revised && !hasStructured) {
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

  const modelHtml = asString(row.revisedHtml).trim();
  const revisedHtml =
    modelHtml ||
    (hasStructured
      ? composeRevisedHtmlFallback(structured)
      : revised
        ? escapeHtml(revised)
        : "");

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
    ...structured,
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

  const type = normalizeSectionType(row.type);
  const defaultTitle =
    type === "profile"
      ? "个人简介"
      : type === "certifications"
        ? "证书"
        : type === "skills"
          ? "技能"
          : type === "education"
            ? "教育经历"
            : "经历";

  // profile：无实质正文则整节省略（不留空标题）
  if (type === "profile") {
    const hasText = items.some(
      (item) =>
        Boolean(item.revised?.trim()) ||
        Boolean(item.bullets?.some((b) => b.trim())) ||
        Boolean(item.title?.trim()),
    );
    if (!hasText) return null;
  }

  return {
    id: asString(row.id, `sec_${index + 1}`),
    type,
    title: asString(row.title, defaultTitle),
    items,
  };
}

function itemHasContent(it: Record<string, unknown>): boolean {
  if (typeof it.revised === "string" && it.revised.trim()) return true;
  if (typeof it.original === "string" && it.original.trim()) return true;
  if (typeof it.title === "string" && it.title.trim()) return true;
  if (Array.isArray(it.bullets) && it.bullets.some((b) => typeof b === "string" && b.trim())) {
    return true;
  }
  return false;
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
    return row.items.some((item) => {
      if (!item || typeof item !== "object") return false;
      return itemHasContent(item as Record<string, unknown>);
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
    contact: (() => {
      if (!data.contact || typeof data.contact !== "object") return undefined;
      const c = normalizeContact(data.contact);
      return Object.keys(c).length ? c : undefined;
    })(),
  };
}

/** 由文件名生成作品集来源标签（不编造页数） */
export function buildPortfolioSourceLabel(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || fileName.trim() || "未命名作品集";
  return `基于作品集《${base}》提炼`;
}

/**
 * 用 experiencesSnapshot 强制盖章 resume 项的 id/original，并写入 enhancedBy。
 * 仅当 item.id 命中 snapshot 经历 id 时盖章——禁止贪心 fallback，
 * 避免把经历原文盖到 profile / skills / education / certifications 上。
 */
export function applyExperienceSnapshotStamps(
  response: GenerateApiResponse,
  snapshot: ParsedExperience[],
  enhancedByMap: Record<string, string[]>,
): GenerateApiResponse {
  if (!response.sections?.length || !snapshot.length) return response;

  const used = new Set<string>();
  const byId = new Map(snapshot.map((s) => [s.id, s]));

  const sections = response.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.source === "portfolio") return item;

      // 非经历/项目章节：绝不盖章
      if (section.type !== "experience" && section.type !== "project") {
        return { ...item, source: "resume" as const };
      }

      const snap =
        (item.id && byId.get(item.id) && !used.has(item.id)
          ? byId.get(item.id)
          : undefined) ?? undefined;

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
