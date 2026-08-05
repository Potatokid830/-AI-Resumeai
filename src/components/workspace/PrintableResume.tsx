"use client";

import type { CSSProperties, ReactNode } from "react";
import type { GenerateApiResponse, ResumeSectionType } from "@/lib/generateTypes";
import type { ResumeContact } from "@/lib/resumeContact";

const SECTION_ORDER: ResumeSectionType[] = [
  "education",
  "experience",
  "project",
  "skills",
  "other",
];

/** 常见日期片段：2021.09 - 2023.06 / 2021-09~至今 / 2021年9月-2023年6月 等 */
const DATE_FRAGMENT_RE =
  /(?:(?:19|20)\d{2}(?:[./年\-]\d{1,2}(?:[./月\-]\d{1,2}日?)?)?(?:\s*[-–—~至到]+\s*(?:(?:19|20)\d{2}(?:[./年\-]\d{1,2}(?:[./月\-]\d{1,2}日?)?)?|至今|现在|Present|Now))?|(?:至今|现在|Present))/i;

const META_HINT_RE =
  /学位|本科|硕士|博士|学士|大专|MBA|地点|城市|远程|Hybrid|Remote|Bachelor|Master|PhD|B\.?S\.?|M\.?S\.?/i;

type ParsedItem = {
  title: string;
  date?: string;
  meta?: string;
  bodyLines: string[];
};

function sortSections(sections: NonNullable<GenerateApiResponse["sections"]>) {
  return [...sections].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.type);
    const bi = SECTION_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function splitLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractDateFromTitleLine(line: string): { title: string; date?: string } {
  // 优先匹配行尾日期（标题在左、日期在右的常见写法）
  const trailing = line.match(
    /^(.*?)\s{2,}(.+)$|^(.*?)\s+[|｜]\s*(.+)$|^(.*?)\s+((?:19|20)\d{2}[\s\S]*)$/,
  );
  if (trailing) {
    const left = (trailing[1] || trailing[3] || trailing[5] || "").trim();
    const right = (trailing[2] || trailing[4] || trailing[6] || "").trim();
    if (left && right && DATE_FRAGMENT_RE.test(right) && right.length <= 40) {
      return { title: left, date: right };
    }
  }

  const dateMatch = line.match(DATE_FRAGMENT_RE);
  if (dateMatch && dateMatch[0]) {
    const date = dateMatch[0].trim();
    const title = line.replace(dateMatch[0], "").replace(/\s*[|｜·•]\s*$/, "").trim();
    if (title && date.length >= 4) {
      return { title, date };
    }
  }

  return { title: line };
}

function looksLikeMetaLine(line: string): boolean {
  if (line.length > 60) return false;
  if (META_HINT_RE.test(line)) return true;
  // 短行且含地点分隔或纯城市感：如 "上海 · 中国" / "Beijing, China"
  if (line.length <= 36 && /[,，·|｜/]/.test(line) && !DATE_FRAGMENT_RE.test(line)) {
    return true;
  }
  return false;
}

/** 启发式：第一行标题(+日期)，可选次要信息行，其余为正文 */
function parseItemBlocks(revised: string): ParsedItem {
  const lines = splitLines(revised);
  if (!lines.length) {
    return { title: "", bodyLines: [] };
  }

  const { title, date } = extractDateFromTitleLine(lines[0]);
  let cursor = 1;
  let meta: string | undefined;

  if (lines[1] && looksLikeMetaLine(lines[1])) {
    meta = lines[1];
    cursor = 2;
  }

  return {
    title: title || lines[0],
    date,
    meta,
    bodyLines: lines.slice(cursor),
  };
}

const linkStyle: CSSProperties = {
  color: "#1155CC",
  textDecoration: "underline",
};

function ContactLine({ contact }: { contact: ResumeContact }) {
  const parts: ReactNode[] = [];

  const pushSep = () => {
    if (parts.length > 0) {
      parts.push(
        <span key={`sep-${parts.length}`} style={{ color: "#555555" }}>
          {" | "}
        </span>,
      );
    }
  };

  if (contact.phone?.trim()) {
    pushSep();
    parts.push(<span key="phone">{contact.phone.trim()}</span>);
  }

  if (contact.email?.trim()) {
    pushSep();
    const email = contact.email.trim();
    parts.push(
      <a key="email" href={`mailto:${email}`} style={linkStyle}>
        {email}
      </a>,
    );
  }

  if (contact.city?.trim()) {
    pushSep();
    parts.push(<span key="city">{contact.city.trim()}</span>);
  }

  if (contact.linkedIn?.trim()) {
    pushSep();
    const url = contact.linkedIn.trim();
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    parts.push(
      <a key="linkedin" href={href} style={linkStyle}>
        {url.replace(/^https?:\/\//i, "")}
      </a>,
    );
  }

  if (!parts.length) return null;

  return (
    <p
      style={{
        margin: 0,
        fontSize: "9.5pt",
        color: "#555555",
        textAlign: "center",
        lineHeight: 1.45,
      }}
    >
      {parts}
    </p>
  );
}

function ResumeItemBlock({
  itemId,
  revised,
}: {
  itemId: string;
  revised: string;
}) {
  const parsed = parseItemBlocks(revised);
  if (!parsed.title && !parsed.bodyLines.length) return null;

  return (
    <div
      style={{
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {parsed.title ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "12pt",
            fontSize: "10.5pt",
            fontWeight: 700,
            color: "#000000",
            textAlign: "left",
          }}
        >
          <span style={{ flex: "1 1 auto", minWidth: 0 }}>{parsed.title}</span>
          {parsed.date ? (
            <span
              style={{
                flex: "0 0 auto",
                fontWeight: 400,
                fontStyle: "italic",
                color: "#555555",
                whiteSpace: "nowrap",
              }}
            >
              {parsed.date}
            </span>
          ) : null}
        </div>
      ) : null}

      {parsed.meta ? (
        <p
          style={{
            margin: "2pt 0 0",
            fontSize: "9.5pt",
            fontStyle: "italic",
            color: "#555555",
            textAlign: "left",
          }}
        >
          {parsed.meta}
        </p>
      ) : null}

      {parsed.bodyLines.map((line, index) => (
        <p
          key={`${itemId}-body-${index}`}
          style={{
            margin: index === 0 && (parsed.title || parsed.meta) ? "4pt 0 0" : "3pt 0 0",
            color: "#222222",
            textAlign: "justify",
            whiteSpace: "pre-wrap",
          }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export default function PrintableResume({
  result,
  contact,
}: {
  result: GenerateApiResponse;
  contact: ResumeContact;
}) {
  const sections = sortSections(result.sections ?? []);
  const hasName = Boolean(contact.name?.trim());
  const rawRole = result.targetRole?.trim() || "";
  const targetRole =
    !rawRole || rawRole === "未指定" || /^n\/?a$/i.test(rawRole)
      ? ""
      : rawRole;

  return (
    <article
      className="printable-resume-sheet"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        padding: "20mm",
        background: "#ffffff",
        color: "#222222",
        fontFamily: "Arial, sans-serif",
        fontSize: "10.5pt",
        lineHeight: 1.55,
      }}
    >
      <header style={{ marginBottom: "14pt", textAlign: "center" }}>
        {hasName ? (
          <h1
            style={{
              margin: 0,
              fontSize: "20pt",
              fontWeight: 700,
              color: "#000000",
              textAlign: "center",
            }}
          >
            {contact.name!.trim()}
          </h1>
        ) : null}

        <div style={{ marginTop: hasName ? "6pt" : 0 }}>
          <ContactLine contact={contact} />
        </div>

        {targetRole ? (
          <p
            style={{
              margin: "8pt 0 0",
              fontSize: "10pt",
              fontWeight: 600,
              color: "#222222",
              textAlign: "center",
            }}
          >
            {targetRole}
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
                  <ResumeItemBlock
                    key={item.id}
                    itemId={item.id}
                    revised={item.revised}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
