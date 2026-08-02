"use client";

import type { GenerateApiResponse, ResumeSectionType } from "@/lib/generateTypes";
import type { ResumeContact } from "@/lib/resumeContact";

const SECTION_ORDER: ResumeSectionType[] = [
  "education",
  "experience",
  "project",
  "skills",
  "other",
];

function sortSections(sections: NonNullable<GenerateApiResponse["sections"]>) {
  return [...sections].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.type);
    const bi = SECTION_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function formatRevised(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function PrintableResume({
  result,
  contact,
}: {
  result: GenerateApiResponse;
  contact: ResumeContact;
}) {
  const sections = sortSections(result.sections ?? []);
  const meta = [
    contact.phone,
    contact.email,
    contact.city,
    contact.linkedIn,
  ].filter((item): item is string => Boolean(item?.trim()));

  return (
    <article
      className="printable-resume-sheet"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        padding: "16mm 16mm 18mm",
        background: "#ffffff",
        color: "#18181b",
        fontFamily:
          '"PingFang SC","Microsoft YaHei UI","Noto Sans SC",system-ui,sans-serif',
        fontSize: "10.5pt",
        lineHeight: 1.55,
      }}
    >
      <header style={{ marginBottom: "14pt" }}>
        {contact.name?.trim() ? (
          <h1
            style={{
              margin: 0,
              fontSize: "18pt",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#09090b",
            }}
          >
            {contact.name.trim()}
          </h1>
        ) : null}

        {meta.length > 0 ? (
          <p
            style={{
              margin: contact.name?.trim() ? "6pt 0 0" : 0,
              fontSize: "9.5pt",
              color: "#3f3f46",
            }}
          >
            {meta.join("  ·  ")}
          </p>
        ) : null}

        {result.targetRole?.trim() ? (
          <p
            style={{
              margin: "8pt 0 0",
              fontSize: "10pt",
              fontWeight: 600,
              color: "#27272a",
            }}
          >
            {result.targetRole.trim()}
          </p>
        ) : null}
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "14pt" }}>
        {sections.map((section) => {
          const items = section.items.filter((item) => item.revised?.trim());
          if (!items.length) return null;
          return (
            <section key={section.id}>
              <h2
                style={{
                  margin: "0 0 8pt",
                  paddingBottom: "4pt",
                  borderBottom: "1px solid #d4d4d8",
                  fontSize: "11pt",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "none",
                  color: "#09090b",
                }}
              >
                {section.title}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10pt" }}>
                {items.map((item) => {
                  const lines = formatRevised(item.revised);
                  return (
                    <div key={item.id}>
                      {lines.map((line, index) => (
                        <p
                          key={`${item.id}-${index}`}
                          style={{
                            margin: index === 0 ? 0 : "3pt 0 0",
                            color: "#27272a",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
