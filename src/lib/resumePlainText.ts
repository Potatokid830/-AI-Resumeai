import type { GenerateApiResponse } from "./generateTypes";

function stripHtml(html: string) {
  return html
    .replace(/<mark>/gi, "")
    .replace(/<\/mark>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildResumePlainText(result: GenerateApiResponse) {
  const resume = result.optimizedResume;
  if (!resume) return "";

  const lines: string[] = [
    resume.role,
    resume.company,
    "",
    stripHtml(resume.summaryHtml),
    "",
  ];

  for (const bullet of resume.bullets) {
    lines.push(`${bullet.letter}. ${bullet.label}`);
    lines.push(stripHtml(bullet.html));
    lines.push("");
  }

  if (resume.matchedKeywords.length) {
    lines.push(`关键词：${resume.matchedKeywords.join("、")}`);
  }

  return lines.join("\n").trim();
}
