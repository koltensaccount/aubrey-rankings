import ReactMarkdown from "react-markdown";

export type ReviewContentFormat = "plain" | "markdown";

interface MarkdownRendererProps {
  content: string;
  format?: ReviewContentFormat | null;
  compact?: boolean;
  className?: string;
}

const safeUrl = (url: string) => /^(https?:|mailto:)/i.test(url) ? url : "";

export function MarkdownRenderer({
  content,
  format = "plain",
  compact = false,
  className = "",
}: MarkdownRendererProps) {
  if (!content) return null;

  if (format !== "markdown") {
    return <p className={`whitespace-pre-wrap ${className}`}>{content}</p>;
  }

  return (
    <div className={`review-markdown ${compact ? "review-markdown-compact" : ""} ${className}`}>
      <ReactMarkdown
        urlTransform={safeUrl}
        components={{
          a: ({ href, children }) => (
            <a href={href || undefined} target="_blank" rel="noreferrer noopener" className="text-primary-text underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
