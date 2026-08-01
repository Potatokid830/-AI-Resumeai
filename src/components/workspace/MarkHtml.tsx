"use client";

/**
 * 安全渲染仅含纯文本与 <mark> 的 HTML 片段。
 */
export default function MarkHtml({
  html,
  className,
  variant = "dark",
}: {
  html: string;
  className?: string;
  variant?: "dark" | "light";
}) {
  const parts = html.split(/(<mark>[\s\S]*?<\/mark>)/g).filter(Boolean);
  const markClassName =
    variant === "light"
      ? "rounded-[3px] bg-amber-200/70 px-1 py-0.5 text-stone-900 ring-1 ring-amber-500/20"
      : "rounded-[4px] bg-amber-300/15 px-1 py-0.5 text-amber-50/95 ring-1 ring-amber-200/15";

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const matched = part.match(/^<mark>([\s\S]*?)<\/mark>$/);
        if (matched) {
          return (
            <mark key={`mark-${index}`} className={markClassName}>
              {matched[1]}
            </mark>
          );
        }
        return <span key={`text-${index}`}>{part}</span>;
      })}
    </span>
  );
}
