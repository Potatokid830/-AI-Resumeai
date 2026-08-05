"use client";

import type { CSSProperties, ReactNode } from "react";
import type {
  GenerateApiResponse,
  ResumeSection,
  ResumeSectionItem,
} from "@/lib/generateTypes";
import type { ResumeContact } from "@/lib/resumeContact";
import {
  hasStructuredEntry,
  sortResumeSections,
} from "@/lib/resumeSchema";

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

function splitLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractDateFromTitleLine(line: string): { title: string; date?: string } {
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
  if (line.length <= 36 && /[,，·|｜/]/.test(line) && !DATE_FRAGMENT_RE.test(line)) {
    return true;
  }
  return false;
}

/** Fallback：从整段 revised 启发式拆标题/日期/副行/正文 */
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

function fromStructured(item: ResumeSectionItem): ParsedItem | null {
  if (!hasStructuredEntry(item)) return null;

  const metaParts = [item.organization, item.location]
    .map((part) => part?.trim() || "")
    .filter(Boolean);

  return {
    title: item.title?.trim() || "",
    date: item.dateRange?.trim() || undefined,
    meta: metaParts.length ? metaParts.join(" · ") : undefined,
    bodyLines: (item.bullets ?? []).map((b) => b.trim()).filter(Boolean),
  };
}

function resolvePrintItem(item: ResumeSectionItem): ParsedItem | null {
  const structured = fromStructured(item);
  if (structured) {
    if (structured.title || structured.meta || structured.date || structured.bodyLines.length) {
      return structured;
    }
  }
  if (!item.revised?.trim()) return null;
  return parseItemBlocks(item.revised);
}

function hasPrintableContent(item: ResumeSectionItem): boolean {
  return Boolean(resolvePrintItem(item));
}

function isCompactSection(section: ResumeSection): boolean {
  return section.type === "skills" || section.type === "certifications";
}

function profileParagraph(item: ResumeSectionItem): string {
  const fromBullets = (item.bullets ?? []).map((b) => b.trim()).filter(Boolean).join(" ");
  if (fromBullets) return fromBullets;
  return (item.revised || "").trim();
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
  parsed,
  compact,
}: {
  itemId: string;
  parsed: ParsedItem;
  compact?: boolean;
}) {
  const useBullets = parsed.bodyLines.length > 0;
  const bulletGap = compact ? "1pt" : "2pt";
  const listMargin = compact ? "2pt 0 0" : "4pt 0 0";

  return (
    <div
      style={{
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {parsed.title || parsed.date ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "12pt",
            fontSize: compact ? "10pt" : "10.5pt",
            fontWeight: 700,
            color: "#000000",
            textAlign: "left",
          }}
        >
          <span style={{ flex: "1 1 auto", minWidth: 0 }}>
            {parsed.title || "\u00A0"}
          </span>
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
            margin: compact ? "1pt 0 0" : "2pt 0 0",
            fontSize: "9.5pt",
            fontStyle: "italic",
            color: "#555555",
            textAlign: "left",
          }}
        >
          {parsed.meta}
        </p>
      ) : null}

      {useBullets ? (
        <ul
          style={{
            margin: listMargin,
            paddingLeft: compact ? "12pt" : "14pt",
            color: "#222222",
            lineHeight: compact ? 1.35 : 1.55,
          }}
        >
          {parsed.bodyLines.map((line, index) => (
            <li
              key={`${itemId}-bullet-${index}`}
              style={{
                marginTop: index === 0 ? 0 : bulletGap,
                textAlign: "justify",
              }}
            >
              {line}
            </li>
          ))}
        </ul>
      ) : (
        parsed.bodyLines.map((line, index) => (
          <p
            key={`${itemId}-body-${index}`}
            style={{
              margin:
                index === 0 && (parsed.title || parsed.meta || parsed.date)
                  ? compact
                    ? "2pt 0 0"
                    : "4pt 0 0"
                  : compact
                    ? "1pt 0 0"
                    : "3pt 0 0",
              color: "#222222",
              textAlign: "justify",
              whiteSpace: "pre-wrap",
              lineHeight: compact ? 1.35 : 1.55,
            }}
          >
            {line}
          </p>
        ))
      )}
    </div>
  );
}

function ProfileSectionBlock({ section }: { section: ResumeSection }) {
  const paragraphs = section.items
    .map(profileParagraph)
    .map((text) => text.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;

  return (
    <section>
      <h2
        style={{
          margin: "0 0 6pt",
          paddingBottom: "3pt",
          borderBottom: "1px solid #1A1A1A",
          fontSize: "11pt",
          fontWeight: 700,
          letterSpacing: "0.5px",
          color: "#000000",
        }}
      >
        {section.title || "个人简介"}
      </h2>
      {paragraphs.map((text, index) => (
        <p
          key={`${section.id}-p-${index}`}
          style={{
            margin: index === 0 ? 0 : "4pt 0 0",
            color: "#222222",
            textAlign: "justify",
            lineHeight: 1.5,
          }}
        >
          {text}
        </p>
      ))}
    </section>
  );
}

export default function PrintableResume({
  result,
  contact,
}: {
  result: GenerateApiResponse;
  contact: ResumeContact;
}) {
  const sections = sortResumeSections(result.sections ?? []);
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
          if (section.type === "profile") {
            return <ProfileSectionBlock key={section.id} section={section} />;
          }

          const items = section.items.filter(hasPrintableContent);
          if (!items.length) return null;
          const compact = isCompactSection(section);
          return (
            <section key={section.id}>
              <h2
                style={{
                  margin: compact ? "0 0 5pt" : "0 0 8pt",
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
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: compact ? "4pt" : "10pt",
                }}
              >
                {items.map((item) => {
                  const parsed = resolvePrintItem(item);
                  if (!parsed) return null;
                  return (
                    <ResumeItemBlock
                      key={item.id}
                      itemId={item.id}
                      parsed={parsed}
                      compact={compact}
                    />
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
