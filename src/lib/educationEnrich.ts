import type {
  GenerateApiResponse,
  ResumeSectionItem,
} from "@/lib/generateTypes";
import { composeRevisedFromStructured } from "@/lib/resumeSchema";

const MAX_SUPPLEMENT_BULLETS = 8;
const MAX_BULLET_LEN = 400;

function escapeHtml(text: string) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 教育条目是否「只有学校/专业/日期、没有课程 GPA 等要点」 */
export function isThinEducationItem(item: ResumeSectionItem): boolean {
  const hasHeader = Boolean(
    item.title?.trim() ||
      item.organization?.trim() ||
      item.dateRange?.trim() ||
      item.revised?.trim(),
  );
  if (!hasHeader) return false;

  const bullets = (item.bullets ?? [])
    .map((b) => b.trim())
    .filter(Boolean);
  return bullets.length === 0;
}

export function hasThinEducation(result: GenerateApiResponse | null): boolean {
  if (!result?.sections?.length) return false;
  return result.sections.some(
    (section) =>
      section.type === "education" &&
      section.items.some(isThinEducationItem),
  );
}

/** 拆用户补充文本：按换行 / 中英文分号 */
export function parseEducationSupplement(text: string): string[] {
  return text
    .split(/[\n；;]+/)
    .map((line) => line.replace(/\s+/g, " ").trim().slice(0, MAX_BULLET_LEN))
    .filter(Boolean)
    .slice(0, MAX_SUPPLEMENT_BULLETS);
}

/**
 * 把用户补充原样写入第一条单薄教育条目的 bullets（不调 LLM、不编造）。
 * 找不到目标则返回原 result。
 */
export function applyEducationSupplement(
  result: GenerateApiResponse,
  rawText: string,
): GenerateApiResponse {
  const extras = parseEducationSupplement(rawText);
  if (!extras.length || !result.sections?.length) return result;

  let applied = false;

  const sections = result.sections.map((section) => {
    if (applied || section.type !== "education") return section;

    const items = section.items.map((item) => {
      if (applied || !isThinEducationItem(item)) return item;
      applied = true;

      const bullets = [...(item.bullets ?? []).filter((b) => b.trim()), ...extras];
      const structured = {
        title: item.title,
        organization: item.organization,
        location: item.location,
        dateRange: item.dateRange,
        bullets,
      };
      const revised = composeRevisedFromStructured(structured);
      return {
        ...item,
        bullets,
        revised,
        revisedHtml: escapeHtml(revised),
      };
    });

    return { ...section, items };
  });

  return applied ? { ...result, sections } : result;
}
