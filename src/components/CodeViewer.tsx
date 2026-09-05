import { useEffect } from 'react';
import { X, FileCode2, Database, AlertTriangle, Search, Route } from 'lucide-react';
import type { CodebaseIndex } from '@/types';

interface Props {
  path: string;
  /** Absent when there is no attached codebase. Viewer shows the not-found state instead of nothing. */
  index?: CodebaseIndex;
  onClose: () => void;
  onAsk: (question: string) => void;
}

function langOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ext || 'text';
}

export function CodeViewer({ path, index, onClose, onAsk }: Props) {
  const content = index?.contents[path];
  const lines = content?.split('\n') ?? [];
  const fetched = content !== undefined;
  const inTree = index ? index.files.some((f) => f.path === path) || index.importantFiles.includes(path) : false;

  const ask = (q: string) => {
    onClose();
    onAsk(`**From \`${path}\`**\n\n${q}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Source: ${path}`}>
      <div className="absolute inset-0 bg-ink-950/40 dark:bg-ink-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col glass rounded-2xl shadow-2xl animate-fade-up overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-200 dark:border-ink-700">
          <FileCode2 className="w-4 h-4 text-violet-500 flex-shrink-0" aria-hidden="true" />
          <code className="flex-1 truncate text-xs font-mono">{path}</code>
          <span
            className={`text-[0.6rem] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${
              fetched
                ? 'text-lime-600 dark:text-lime-400 border-lime-400/30 bg-lime-400/10'
                : 'text-ink-400 border-ink-300 dark:border-ink-600'
            }`}
            title={fetched ? 'Content was fetched from GitHub: evidence' : 'Listed in tree but content not fetched: answer may be inference'}
          >
            {fetched ? 'Fetched evidence' : inTree ? 'Listed · not fetched' : 'Inference · not in repo'}
          </span>
          <span className="text-[0.6rem] font-mono text-ink-400 hidden sm:inline">{langOf(path)}</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 flex-shrink-0" title="Close" aria-label="Close code viewer">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin bg-ink-950 text-ink-100">
          {fetched ? (
            <pre className="text-xs font-mono leading-5 p-0">
              <table className="w-full border-collapse">
                <tbody>
                  {lines.slice(0, 600).map((line, i) => (
                    <tr key={i} className="hover:bg-white/5">
                      <td className="text-right pr-3 pl-4 py-0 select-none text-ink-500 w-12 align-top">{i + 1}</td>
                      <td className="pr-4 py-0 whitespace-pre-wrap break-all align-top">{line || ' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lines.length > 600 && (
                <p className="px-4 py-2 text-ink-400">Truncated. Showing first 600 of {lines.length} lines (browser fetch cap).</p>
              )}
            </pre>
          ) : (
            <div className="p-6 text-sm font-light text-ink-300">
              <p className="mb-2">
                {index
                  ? inTree
                    ? 'Listed in the repository tree, but content was not fetched (browser cap: about 18 files).'
                    : 'Not found in the fetched repository map.'
                  : 'No codebase attached here, so no fetched source to show.'}
              </p>
              <p className="text-ink-400">Treat claims about it as <strong>LLM inference, not fetched evidence</strong>. Attach the repository to fetch it.</p>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-ink-200 dark:border-ink-700 flex flex-wrap gap-1.5">
          {[
            { label: 'Explain this file', icon: FileCode2, q: `Explain ${path} in this repo: what it does, key functions, and how it fits the architecture.` },
            { label: 'Dependencies', icon: Database, q: `What does ${path} depend on, and what depends on it? Use only fetched evidence; say what is missing.` },
            { label: 'What breaks?', icon: AlertTriangle, q: `What would break if I changed ${path}? Be specific about callers and risks.` },
            { label: 'Where used?', icon: Search, q: `Show where ${path} is used across this repo (imports, routes, callers).` },
            { label: 'Trace from here', icon: Route, q: `Trace the flow starting from ${path}: what calls it and what it calls, step by step.` },
          ].map(({ label, icon: Icon, q }) => (
            <button
              key={label}
              onClick={() => ask(q)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-[0.1em] border border-ink-200 dark:border-ink-700 hover:border-violet-400 dark:hover:border-violet-500/50 transition-colors"
            >
              <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
