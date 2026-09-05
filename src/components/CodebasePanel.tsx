import { useMemo, useState } from 'react';
import { Search, FileCode2 } from 'lucide-react';
import type { CodebaseAttachment } from '@/types';

interface Props {
  codebase?: CodebaseAttachment;
  onAsk: (question: string) => void;
  onOpenFile: (path: string) => void;
}

const STARTER_QUESTIONS = [
  'Explain this repository to me as if I just joined the team.',
  'How is this project structured? Where should I start reading?',
  'Trace a request from the entry point through the key files.',
  'What dependencies does it use, and what would break if I removed one?',
  'What are the design decisions and potential problems here?',
];

export function CodebasePanel({ codebase, onAsk, onOpenFile }: Props) {
  const idx = codebase?.status === 'ready' ? codebase.index : undefined;

  const [fileQuery, setFileQuery] = useState('');
  const [codeQuery, setCodeQuery] = useState('');

  const topLangs = useMemo(() => {
    if (!idx) return [];
    return Object.entries(idx.languages).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [idx]);
  const depEntries = useMemo(() => (idx ? Object.entries(idx.dependencies).slice(0, 20) : []), [idx]);
  const fetchedSet = useMemo(() => new Set(idx ? Object.keys(idx.contents) : []), [idx]);

  const fileResults = useMemo(() => {
    if (!idx) return [];
    const q = fileQuery.trim().toLowerCase();
    const all = idx.files.map((f) => f.path);
    if (!q) return idx.importantFiles.slice(0, 30);
    return all.filter((p) => p.toLowerCase().includes(q)).slice(0, 30);
  }, [fileQuery, idx]);

  const codeResults = useMemo(() => {
    if (!idx) return [];
    const q = codeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return Object.entries(idx.contents)
      .filter(([path, body]) => body.toLowerCase().includes(q) || path.toLowerCase().includes(q))
      .slice(0, 15)
      .map(([path, body]) => {
        const i = body.toLowerCase().indexOf(q);
        const snippet = i >= 0 ? body.slice(Math.max(0, i - 80), i + 120).replace(/\n/g, ' ') : body.slice(0, 200).replace(/\n/g, ' ');
        return { path, snippet };
      });
  }, [codeQuery, idx]);

  if (!codebase) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-sm text-ink-500 dark:text-ink-400 font-light">
        Paste a GitHub link above to build a map of files, dependencies and entry points. Then ask things like{' '}
        <em>“How does authentication work here?”</em>
      </div>
    );
  }
  if (codebase.status === 'loading') {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-sm text-ink-500 dark:text-ink-400 animate-pulse">
        Fetching {codebase.owner}/{codebase.repo} via the public GitHub API: file tree, manifests, README…
      </div>
    );
  }
  if (codebase.status === 'error' || !idx) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-sm text-red-500">
        Couldn’t index {codebase.url}: {codebase.error ?? 'unknown error'}. Public repos only.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6 w-full">
      <div>
        <p className="eyebrow mb-1.5">Architecture</p>
        <a href={idx.repoUrl} target="_blank" rel="noreferrer" className="font-display uppercase text-xl hover:text-violet-500 transition-colors">
          {idx.owner}/{idx.repo}
        </a>
        {idx.description && <p className="text-sm font-light text-ink-500 dark:text-ink-400 mt-1">{idx.description}</p>}
        <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">
          {idx.fileCount} files{idx.truncated ? ' (truncated listing)' : ''} · branch {idx.branch}
          {typeof idx.stars === 'number' ? ` · ★ ${idx.stars}` : ''}
        </p>
        {idx.readmeSnippet && (
          <p className="text-xs font-light text-ink-500 dark:text-ink-400 mt-2 line-clamp-4 whitespace-pre-wrap">{idx.readmeSnippet.slice(0, 500)}</p>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">Entry points</p>
        {idx.entryPoints.length === 0 ? (
          <p className="text-xs text-ink-400">No obvious entry point detected.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {idx.entryPoints.map((f) => (
              <button
                key={f}
                onClick={() => onOpenFile(f)}
                title={fetchedSet.has(f) ? `Open fetched source: ${f}` : `${f}: listed, content not fetched`}
                className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 underline decoration-dotted underline-offset-2 hover:border-violet-400 transition-colors"
              >
                <FileCode2 className="w-3 h-3 flex-shrink-0 text-ink-400" aria-hidden="true" />
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">Dependencies{idx.dependencyManager ? ` (${idx.dependencyManager})` : ''}</p>
        {depEntries.length === 0 ? (
          <p className="text-xs text-ink-400">No manifest parsed (looked for package.json, requirements.txt, go.mod, Cargo.toml).</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {depEntries.map(([k, v]) => (
              <span key={k} className="text-xs font-mono px-2 py-1 rounded-md glass">{k}{v && v !== '*' ? `@${v}` : ''}</span>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="eyebrow mb-2">Files ({idx.files.length} listed)</p>
          <label className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-1.5 mb-2">
            <Search className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" aria-hidden="true" />
            <input
              value={fileQuery}
              onChange={(e) => setFileQuery(e.target.value)}
              placeholder="Search files…"
              aria-label="Search files"
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-ink-400 dark:placeholder:text-ink-500"
            />
          </label>
          <div className="max-h-56 overflow-y-auto scrollbar-thin text-xs font-mono space-y-0.5 pr-2">
            {fileResults.length === 0 && <p className="text-ink-400 font-sans text-xs">No files match.</p>}
            {fileResults.map((f) => (
              <button
                key={f}
                onClick={() => onOpenFile(f)}
                className="w-full flex items-center gap-1.5 text-left truncate hover:text-violet-500 transition-colors"
                title={fetchedSet.has(f) ? `Open fetched source: ${f}` : `${f}: listed, content not fetched`}
              >
                <FileCode2 className="w-3 h-3 flex-shrink-0 text-ink-400" aria-hidden="true" />
                <span className="truncate text-ink-600 dark:text-ink-300">{f}</span>
                {fetchedSet.has(f) && <span className="w-1.5 h-1.5 rounded-full bg-lime-400 flex-shrink-0" title="Fetched evidence" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-2">File types</p>
          <div className="space-y-1.5">
            {topLangs.map(([ext, n]) => (
              <div key={ext} className="flex items-center gap-2 text-xs">
                <span className="font-mono w-16 truncate">.{ext}</span>
                <div className="flex-1 h-1.5 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full"
                    style={{ width: `${Math.max(4, (n / (topLangs[0]?.[1] ?? 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-ink-400 w-8 text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="eyebrow mb-2">Search code (fetched files)</p>
        <label className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-1.5 mb-2 max-w-md">
          <Search className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" aria-hidden="true" />
            <input
              value={codeQuery}
            onChange={(e) => setCodeQuery(e.target.value)}
            placeholder="Search in fetched source… (min 2 chars)"
            aria-label="Search code"
            className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-ink-400 dark:placeholder:text-ink-500"
          />
        </label>
        {codeQuery.trim().length >= 2 && (
          <div className="space-y-1.5 max-w-2xl">
            {codeResults.length === 0 && <p className="text-xs text-ink-400">No matches in fetched files.</p>}
            {codeResults.map(({ path, snippet }) => (
              <button key={path} onClick={() => onOpenFile(path)} className="block w-full text-left glass glass-hover rounded-xl px-3 py-2">
                <code className="text-xs font-mono text-violet-600 dark:text-violet-300">{path}</code>
                <p className="text-xs font-light text-ink-500 dark:text-ink-400 truncate mt-0.5">…{snippet}…</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="eyebrow mb-2">Ask against the actual source</p>
        <div className="space-y-2">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="block w-full text-left text-sm p-3 glass glass-hover rounded-xl font-light"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[0.65rem] uppercase tracking-[0.15em] text-ink-400 dark:text-ink-600 font-medium">
        <span className="text-lime-500">●</span> Fetched evidence · <span className="text-ink-400">○</span> LLM inference. Answers say when info wasn’t found.
        Browser caps: first 400 paths · ~18 files · 90k chars. Full indexing needs the future backend.
      </p>
    </div>
  );
}
