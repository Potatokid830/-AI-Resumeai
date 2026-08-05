"use client";

import type { GenerateApiResponse, ResumeSectionItem } from "@/lib/generateTypes";
import { sortResumeSections } from "@/lib/resumeSchema";

function originalText(item: ResumeSectionItem): string {
  if (item.source === "portfolio") {
    return (
      item.sourceLabel?.trim() ||
      item.original?.trim() ||
      "基于上传作品集提炼"
    );
  }
  return item.original?.trim() || "（无原文）";
}

function revisedText(item: ResumeSectionItem): string {
  return item.revised?.trim() || "（无改写）";
}

function ComparisonItem({ item }: { item: ResumeSectionItem }) {
  return (
    <div
      style={{
        pageBreakInside: "avoid",
        breakInside: "avoid",
        border: "1px solid #e4e4e7",
        borderRadius: "6pt",
        padding: "10pt 12pt",
        background: "#ffffff",
      }}
    >
      <div>
        <p
          style={{
            margin: 0,
            fontSize: "9pt",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#71717a",
          }}
        >
          原文
        </p>
        <p
          style={{
            margin: "4pt 0 0",
            fontSize: "10pt",
            lineHeight: 1.5,
            color: "#52525b",
            whiteSpace: "pre-wrap",
          }}
        >
          {originalText(item)}
        </p>
      </div>

      <div
        style={{
          margin: "8pt 0",
          borderTop: "1px solid #e4e4e7",
        }}
      />

      <div>
        <p
          style={{
            margin: 0,
            fontSize: "9pt",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#71717a",
          }}
        >
          改写
        </p>
        <p
          style={{
            margin: "4pt 0 0",
            fontSize: "10pt",
            lineHeight: 1.5,
            color: "#18181b",
            whiteSpace: "pre-wrap",
          }}
        >
          {revisedText(item)}
        </p>
      </div>
    </div>
  );
}

export default function PrintableComparison({
  result,
}: {
  result: GenerateApiResponse;
}) {
  const sections = sortResumeSections(result.sections ?? []).filter((section) =>
    section.items.some(
      (item) => item.original?.trim() || item.revised?.trim() || item.source === "portfolio",
    ),
  );

  return (
    <article
      className="printable-comparison-sheet"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        padding: "16mm",
        background: "#ffffff",
        color: "#18181b",
        fontFamily: "Arial, sans-serif",
        fontSize: "10pt",
        lineHeight: 1.5,
      }}
    >
      <header style={{ marginBottom: "12pt" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "14pt",
            fontWeight: 700,
            color: "#09090b",
          }}
        >
          简历改动对照
        </h1>
        <p
          style={{
            margin: "4pt 0 0",
            fontSize: "9.5pt",
            color: "#71717a",
          }}
        >
          仅供回顾 AI 改动，非投递稿
          {result.targetRole?.trim() && result.targetRole.trim() !== "未指定"
            ? ` · ${result.targetRole.trim()}`
            : ""}
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "14pt" }}>
        {sections.map((section) => {
          const items = section.items.filter(
            (item) =>
              item.revised?.trim() ||
              item.original?.trim() ||
              item.source === "portfolio",
          );
          if (!items.length) return null;
          return (
            <section key={section.id}>
              <h2
                style={{
                  margin: "0 0 8pt",
                  paddingBottom: "3pt",
                  borderBottom: "1px solid #1A1A1A",
                  fontSize: "11pt",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  color: "#000000",
                }}
              >
                {section.title}
              </h2>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "10pt" }}
              >
                {items.map((item) => (
                  <ComparisonItem key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
