import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders card content written as Markdown.
 *
 * ReactMarkdown does not render raw HTML by default, so imported vocabulary
 * stays inert even when a source file contains HTML comments or tags.
 */
export default function Markdown({ children, className = '' }: MarkdownProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
