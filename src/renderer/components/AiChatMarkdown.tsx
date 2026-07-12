import { useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function buildComponents(variant: "user" | "assistant"): Components {
  const text = variant === "user" ? "text-neutral-100" : "text-neutral-300";
  const heading = variant === "user" ? "text-white" : "text-neutral-100";
  const subheading = variant === "user" ? "text-neutral-100" : "text-neutral-200";

  return {
    h1: ({ children }) => (
      <h1 className={`text-[15px] font-semibold ${heading} mt-3 mb-1.5 first:mt-0`}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={`text-[14px] font-semibold ${heading} mt-3 mb-1.5 first:mt-0`}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={`text-[13px] font-semibold ${subheading} mt-2.5 mb-1 first:mt-0`}>
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className={`text-[13px] leading-relaxed ${text} my-1.5 first:mt-0 last:mb-0`}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className={`text-[13px] ${text} my-1.5 pl-4 list-disc space-y-0.5`}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={`text-[13px] ${text} my-1.5 pl-4 list-decimal space-y-0.5`}>
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-[#6c63ff]/40 pl-3 my-2 text-neutral-400 italic">
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#c4c0ff] hover:text-[#ddd8ff] underline underline-offset-2"
      >
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className={`font-semibold ${heading}`}>{children}</strong>
    ),
    em: ({ children }) => (
      <em className={`italic ${subheading}`}>{children}</em>
    ),
    hr: () => <hr className="border-white/[0.08] my-3" />,
    table: ({ children }) => (
      <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-white/[0.08]">
        <table className="w-full min-w-max text-[12px] text-left">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-white/[0.04] text-neutral-200">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-2.5 py-1.5 font-medium border-b border-white/[0.08]">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className={`px-2.5 py-1.5 border-b border-white/[0.04] ${text}`}>
        {children}
      </td>
    ),
    code: ({ className, children }) => {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <code className={`${className ?? ""} text-[#c7c7d8]`}>{children}</code>
        );
      }
      return (
        <code className="px-1 py-0.5 rounded bg-black/30 text-[#c4c0ff] font-mono text-[12px]">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-2 max-w-full p-2.5 rounded-lg bg-black/35 border border-white/[0.06] overflow-x-auto font-mono text-[11px] leading-relaxed text-[#c7c7d8] whitespace-pre-wrap break-words">
        {children}
      </pre>
    ),
  };
}

export function AiChatMarkdown({
  content,
  variant = "assistant",
}: {
  content: string;
  variant?: "user" | "assistant";
}) {
  const components = useMemo(() => buildComponents(variant), [variant]);

  if (!content.trim()) return null;

  return (
    <div className="ai-chat-markdown min-w-0 max-w-full overflow-hidden">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}