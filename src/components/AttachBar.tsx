import { useState } from 'react';
import { FolderGit2, Globe, X, Loader2, Copy, Check } from 'lucide-react';
import type { CodebaseAttachment, WebAttachment } from '@/types';

interface Props {
  codebase?: CodebaseAttachment;
  web?: WebAttachment;
  onAttachRepo: (url: string) => void;
  onAttachWeb: (url: string) => void;
  onClearCodebase: () => void;
  onClearWeb: () => void;
  disabled?: boolean;
}

export function AttachBar({ codebase, web, onAttachRepo, onAttachWeb, onClearCodebase, onClearWeb, disabled }: Props) {
  const [repoInput, setRepoInput] = useState('');
  const [webInput, setWebInput] = useState('');
  const [copied, setCopied] = useState<'codebase' | 'web' | null>(null);

  const copyRow = (which: 'codebase' | 'web', text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
  };

  const codebaseText = codebase
    ? `${codebase.owner}/${codebase.repo}` +
      (codebase.status === 'loading' ? ' (indexing…)' : '') +
      (codebase.status === 'error' && codebase.error ? `: ${codebase.error}` : '') +
      (codebase.status === 'ready' && codebase.index ? `: ${codebase.index.fileCount} files, ${codebase.index.entryPoints.length} entry points` : '')
    : '';
  const webText = web
    ? `${web.title || web.url}` +
      (web.status === 'loading' ? ' (fetching…)' : '') +
      (web.status === 'error' && web.error ? `: ${web.error}` : '')
    : '';

  return (
    <div className="px-4 md:px-6 pt-3 max-w-3xl mx-auto w-full space-y-2">
      {/* Codebase row */}
      {codebase ? (
        <div className={`flex items-center gap-2 text-xs glass rounded-xl px-3 py-2 ${codebase.status === 'error' ? 'border-red-400/40' : ''}`}>
          <FolderGit2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate font-medium" title={codebaseText}>
            {codebase.owner}/{codebase.repo}
            {codebase.status === 'loading' && <span className="text-ink-400">: indexing…</span>}
            {codebase.status === 'error' && <span className="text-red-500">: {codebase.error}</span>}
            {codebase.status === 'ready' && codebase.index && (
              <span className="text-ink-400">: {codebase.index.fileCount} files, {codebase.index.entryPoints.length} entry points</span>
            )}
          </span>
          {codebase.status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-400 flex-shrink-0" aria-hidden="true" />}
          <button
            onClick={() => copyRow('codebase', codebaseText)}
            className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors flex-shrink-0"
            title="Copy full status text"
            aria-label="Copy codebase status"
          >
            {copied === 'codebase' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
          <button onClick={onClearCodebase} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 flex-shrink-0" title="Remove codebase" aria-label="Remove codebase">
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (repoInput.trim()) {
              onAttachRepo(repoInput.trim());
              setRepoInput('');
            }
          }}
          className="flex items-center gap-2"
        >
          <FolderGit2 className="w-3.5 h-3.5 text-ink-400 flex-shrink-0 ml-1" aria-hidden="true" />
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="GitHub link or owner/repo…"
            aria-label="Attach GitHub repository"
            disabled={disabled}
            className="flex-1 bg-transparent text-xs placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:outline-none border-b border-transparent focus:border-violet-400 py-1.5"
          />
          <button
            type="submit"
            disabled={!repoInput.trim() || disabled}
            className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400 hover:text-violet-500 disabled:opacity-30"
          >
            Analyze
          </button>
        </form>
      )}

      {/* Web row */}
      {web ? (
        <div className={`flex items-center gap-2 text-xs glass rounded-xl px-3 py-2 ${web.status === 'error' ? 'border-red-400/40' : ''}`}>
          <Globe className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate font-medium" title={webText}>
            {web.title || web.url}
            {web.status === 'loading' && <span className="text-ink-400">: fetching…</span>}
            {web.status === 'error' && <span className="text-red-500">: {web.error}</span>}
          </span>
          {web.status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-400 flex-shrink-0" aria-hidden="true" />}
          <button
            onClick={() => copyRow('web', web.url + (web.error ? `: ${web.error}` : web.title ? ` (${web.title})` : ''))}
            className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors flex-shrink-0"
            title="Copy full status text"
            aria-label="Copy page status"
          >
            {copied === 'web' ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
          <button onClick={onClearWeb} className="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 flex-shrink-0" title="Remove page" aria-label="Remove page">
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (webInput.trim()) {
              onAttachWeb(webInput.trim());
              setWebInput('');
            }
          }}
          className="flex items-center gap-2"
        >
          <Globe className="w-3.5 h-3.5 text-ink-400 flex-shrink-0 ml-1" aria-hidden="true" />
          <input
            value={webInput}
            onChange={(e) => setWebInput(e.target.value)}
            placeholder="Website URL…"
            aria-label="Attach website URL"
            disabled={disabled}
            className="flex-1 bg-transparent text-xs placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:outline-none border-b border-transparent focus:border-violet-400 py-1.5"
          />
          <button
            type="submit"
            disabled={!webInput.trim() || disabled}
            className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-400 hover:text-violet-500 disabled:opacity-30"
          >
            Preview
          </button>
        </form>
      )}
    </div>
  );
}
