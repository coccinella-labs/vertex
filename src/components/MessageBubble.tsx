import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Copy, Check, FileCode2 } from 'lucide-react';
import type { ChatMessage } from '@/types';

interface Props {
  message: ChatMessage;
  streaming?: boolean;
  /** Files known from the attached codebase, used to mark evidence vs inference. */
  knownFiles?: Set<string>;
  onOpenFile?: (path: string) => void;
}

function looksLikePath(text: string): string | null {
  const t = text.trim().replace(/^[./]+/, '');
  if (!t.includes('/') || /\s/.test(t) || t.length > 180) return null;
  if (!/\.[A-Za-z0-9]{1,10}$/.test(t) && !t.endsWith('Dockerfile') && !t.endsWith('Makefile')) return null;
  return t;
}

function MarkdownContent({ content, knownFiles, onOpenFile }: { content: string; knownFiles?: Set<string>; onOpenFile?: (path: string) => void }) {
  return (
    <div
      className="
        prose prose-sm max-w-none
        prose-p:my-2 prose-p:leading-relaxed
        prose-headings:font-display prose-headings:uppercase prose-headings:tracking-tight prose-headings:text-ink-900
        prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
        prose-pre:bg-ink-50 prose-pre:border prose-pre:border-ink-200 prose-pre:text-ink-700 prose-pre:rounded-lg prose-pre:text-xs prose-pre:py-3 prose-pre:px-4 prose-pre:overflow-x-auto
        prose-code:before:content-none prose-code:after:content-none
        prose-code:bg-violet-500/10 prose-code:text-violet-700 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono
        prose-pre:prose-code:bg-transparent prose-pre:prose-code:text-inherit prose-pre:prose-code:p-0
        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
        prose-blockquote:border-l-violet-500 prose-blockquote:not-italic prose-blockquote:text-ink-600
        prose-a:text-lime-600 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-ink-900
        prose-table:text-sm
        prose-th:border prose-th:border-ink-200 prose-th:bg-ink-100 prose-th:px-3 prose-th:py-1.5 prose-th:text-ink-700
        prose-td:border prose-td:border-ink-200 prose-td:px-3 prose-td:py-1.5
        prose-hr:border-ink-200

        dark:prose-invert
        dark:prose-headings:text-white
        dark:prose-pre:bg-ink-950 dark:prose-pre:border-ink-700 dark:prose-pre:text-ink-200
        dark:prose-code:bg-violet-500/15 dark:prose-code:text-violet-300
        dark:prose-blockquote:text-ink-300
        dark:prose-a:text-lime-400
        dark:prose-strong:text-white
        dark:prose-th:border-ink-600 dark:prose-th:bg-ink-800 dark:prose-th:text-ink-100
        dark:prose-td:border-ink-700
        dark:prose-hr:border-ink-700
      "
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className } = props as { children?: ReactNode; className?: string };
            const text = String(children ?? '');
            // Only linkify single-line inline code that looks like a repo path (block code has language class / newlines)
            const isBlock = (className ?? '').includes('language-') || text.includes('\n');
            const path = !isBlock && onOpenFile ? looksLikePath(text) : null;
            if (path) {
              const fetched = knownFiles ? knownFiles.has(path) : true;
              const open = onOpenFile;
              return (
                <button
                  onClick={() => open?.(path)}
                  title={fetched ? `Open fetched source: ${path}` : `${path}: not fetched, may be inference`}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.85em] font-mono border underline decoration-dotted underline-offset-2 transition-colors ${
                    fetched
                      ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30 hover:border-violet-400 hover:bg-violet-500/20'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-500 border-dashed border-ink-300 dark:border-ink-600 hover:border-violet-400'
                  }`}
                >
                  <FileCode2 className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                  {path}
                </button>
              );
            }
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function MessageBubble({ message, streaming, knownFiles, onOpenFile }: Props) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group animate-fade-up">
      <div className="flex gap-3 md:gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-7 h-7 rounded-full bg-ink-100 dark:bg-ink-700 border border-ink-200 dark:border-ink-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-ink-500 dark:text-ink-300" strokeWidth={2} aria-hidden="true" />
            </div>
          ) : (
            <div className="brand-orb brand-orb-avatar" aria-label="Vertex" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400">
              {isUser ? 'You' : 'Vertex'}
            </span>
            <button
              onClick={copy}
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-ink-400 dark:text-ink-500 hover:text-lime-500 dark:hover:text-lime-400"
              title="Copy"
              aria-label="Copy message"
            >
              {copied ? <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" /> : <Copy className="w-3 h-3 flex-shrink-0" aria-hidden="true" />}
            </button>
          </div>
          {isUser ? (
            <div className="text-sm text-ink-800 dark:text-ink-100 leading-relaxed">
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {message.images.map((src, i) => (
                    <img key={i} src={src} alt={`Attached image ${i + 1}`} className="w-24 h-24 rounded-xl object-cover border border-ink-200 dark:border-ink-700" />
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          ) : (
            <div className="text-sm text-ink-700 dark:text-ink-200">
              <MarkdownContent content={message.content} knownFiles={knownFiles} onOpenFile={onOpenFile} />
              {streaming && (
                <span className="inline-block w-1.5 h-4 bg-lime-400 ml-0.5 align-text-bottom animate-blink rounded-sm shadow-[0_0_10px_rgba(163,230,53,0.6)]" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
