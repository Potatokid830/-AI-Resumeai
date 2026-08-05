import type { ResumeSection, ResumeSectionItem, ResumeSectionType } from "@/lib/generateTypes";

/** 成品/对照 PDF 统一中文章节标题（按 type，避免模型输出英文混用） */
export const SECTION_TITLE_ZH: Record<ResumeSectionType, string> = {
  profile: "个人简介",
  education: "教育经历",
  experience: "工作经历",
  project: "项目作品",
  skills: "技能",
  certifications: "证书",
  other: "附加信息",
};

export function displaySectionTitle(section: ResumeSection): string {
  return SECTION_TITLE_ZH[section.type] || section.title?.trim() || "经历";
}

function normalizeForCompare(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/[，。、；：！？,.!?;:\-—–·•"'""''（）()【】\[\]]/g, "")
    .toLowerCase();
}

/**
 * 对照版：原文与改写实质相同（证书等常见）→ 视为无需改动。
 * portfolio 无真实原文对照，不算「无需改动」。
 */
export function isEssentiallyUnchanged(item: ResumeSectionItem): boolean {
  if (item.source === "portfolio") return false;
  const original = (item.original || "").trim();
  const revised = (item.revised || "").trim();
  if (!original || !revised) return false;
  return normalizeForCompare(original) === normalizeForCompare(revised);
}
