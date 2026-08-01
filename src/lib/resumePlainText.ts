import type { GenerateApiResponse } from "./generateTypes";

export function buildResumePlainText(result: GenerateApiResponse) {
  const sections = result.sections;
  if (!sections?.length) return "";

  const lines: string[] = [];

  if (result.targetRole?.trim()) {
    lines.push(result.targetRole.trim(), "");
  }

  for (const section of sections) {
    lines.push(section.title);
    for (const item of section.items) {
      if (item.source === "portfolio") {
        const label =
          item.sourceLabel?.trim() ||
          item.original?.trim() ||
          "基于上传作品集提炼";
        lines.push(label);
      }
      const text = (item.revised || "").trim();
      if (text) lines.push(text, "");
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
