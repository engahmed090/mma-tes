import ReactMarkdown from 'react-markdown';

// URL allowlist, not an HTML sanitizer. Raw HTML is disabled by the parser.
function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export default function SafeChatMarkdown({ content }: { content: string }) {
  return <div className="prose prose-sm max-w-none dark:prose-invert">
    <ReactMarkdown skipHtml urlTransform={safeUrl} components={{
      a: ({ href, children }) => href
        ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        : <span>{children}</span>,
      img: ({ alt }) => <span>{alt}</span>,
    }}>{content}</ReactMarkdown>
  </div>;
}
