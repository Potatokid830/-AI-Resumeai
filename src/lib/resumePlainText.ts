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
      const text = (item.revised || item.original || "").trim();
      if (text) lines.push(text, "");
    }
    lines.push("");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
