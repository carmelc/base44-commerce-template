import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer for StoreAdmin bot messages.
 *
 * GitHub-flavored markdown via remark-gfm, so agent responses containing
 * tables (| col | ... | with |---| separators), task lists and strikethrough
 * render correctly. Tables scroll horizontally inside their own container.
 */
const components = {
  table: ({ node, ...props }) => (
    <div className="my-2 w-full overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => <thead className="bg-muted/60" {...props} />,
  th: ({ node, ...props }) => (
    <th className="whitespace-nowrap border-b px-2.5 py-1.5 text-left font-semibold" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border-b px-2.5 py-1.5 align-top last:border-b-0 [tr:last-child>&]:border-b-0" {...props} />
  ),
  p: ({ node, ...props }) => <p className="mb-2 leading-relaxed last:mb-0" {...props} />,
  ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0" {...props} />,
  ol: ({ node, ...props }) => <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0" {...props} />,
  h1: ({ node, ...props }) => <h1 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0" {...props} />,
  h2: ({ node, ...props }) => <h2 className="mb-1.5 mt-2 text-sm font-semibold first:mt-0" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0" {...props} />,
  h4: ({ node, ...props }) => <h4 className="mb-1 mt-2 text-[13px] font-semibold first:mt-0" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node, inline, className, ...props }) =>
    inline ? (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]" {...props} />
    ) : (
      <code className={`font-mono text-[11px] ${className || ""}`} {...props} />
    ),
  pre: ({ node, ...props }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-muted p-2.5" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-2 border-l-2 pl-3 text-muted-foreground" {...props} />
  ),
  hr: ({ node, ...props }) => <hr className="my-3" {...props} />,
};

export default function Markdown({ children }) {
  return (
    <div className="text-[13px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
