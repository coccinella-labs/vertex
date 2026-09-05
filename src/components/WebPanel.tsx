import type { WebAttachment } from '@/types';
import type { WebStructureNode } from '@/types';
import { WEAK_TEXT_THRESHOLD } from '@/lib/web';

interface Props {
  web?: WebAttachment;
  onAsk: (question: string) => void;
}

function Tree({ nodes, depth = 0 }: { nodes: WebStructureNode[]; depth?: number }) {
  return (
    <div className="font-mono text-xs leading-6">
      {nodes.map((n, i) => {
        const last = i === nodes.length - 1;
        return (
          <div key={`${n.label}-${i}`}>
            <p className="text-ink-700 dark:text-ink-200 whitespace-pre">
              {'  '.repeat(depth) + (depth === 0 ? '' : last ? '└── ' : '├── ') + n.label}
            </p>
            {n.children && n.children.length > 0 && <Tree nodes={n.children} depth={depth + 1} />}
          </div>
        );
      })}
    </div>
  );
}

export function WebPanel({ web, onAsk }: Props) {
  if (!web) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-sm text-ink-500 dark:text-ink-400 font-light">
        Paste a website URL above. VERTEX inspects structure, navigation, layout, and components, or recreates them in React.
      </div>
    );
  }

  const insp = web.inspection;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-5 w-full">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow truncate">{web.title || web.url}</p>
        <a href={web.url} target="_blank" rel="noreferrer" className="text-xs text-violet-500 hover:underline flex-shrink-0">
          Open ↗
        </a>
      </div>

      {web.status === 'loading' && <p className="text-sm text-ink-400 animate-pulse">Inspecting page structure, navigation, styles…</p>}
      {web.status === 'error' && (
        <p className="text-sm text-red-500">{web.error}</p>
      )}

      {/* Live preview. Note: many sites send X-Frame-Options / CSP frame-ancestors and will refuse to embed */}
      <div className="rounded-xl overflow-hidden border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900">
        <iframe
          src={web.url}
          title={web.title || web.url}
          className="w-full h-[420px] bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms"
          loading="lazy"
        />
      </div>
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink-400 dark:text-ink-600">
        If blank, the site blocks embedding. Use Open ↗.
      </p>

      {insp && (
        <>
          {(web.readableText ?? '').length < WEAK_TEXT_THRESHOLD && (
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 glass rounded-xl px-4 py-2.5 border-amber-400/30">
              Little page text ({(web.readableText ?? '').length} chars). Structure, styles, and assets below are fetched evidence.
            </p>
          )}
          <div>
            <p className="eyebrow mb-2">Visual structure</p>
            <div className="glass rounded-xl px-4 py-3">
              <Tree nodes={insp.structure} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="eyebrow mb-2">Design analysis</p>
              <div className="glass rounded-xl px-4 py-3 text-xs font-light space-y-1.5">
                <p>Layout: {insp.layoutHints.join('; ') || 'standard flow'}</p>
                <p>Responsive: {insp.responsiveHints.join('; ') || 'no signals'}</p>
                <p>Colors (fetched CSS): {insp.colors.slice(0, 6).join(', ') || 'none found'}</p>
                <p>Fonts: {insp.fonts.slice(0, 3).join(' · ') || 'none found'}</p>
                {insp.headings.length > 0 && (
                  <p>Headings: {insp.headings.slice(0, 3).map((h) => h.text).join(' / ')}</p>
                )}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-2">Implementation</p>
              <div className="glass rounded-xl px-4 py-3 text-xs font-light space-y-1.5">
                <p>Likely React components (inference):</p>
                <div className="flex flex-wrap gap-1.5">
                  {insp.suggestedComponents.map((c) => (
                    <code key={c} className="font-mono px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">{c}</code>
                  ))}
                </div>
                <p className="text-ink-400">Sections: {insp.sectionCount} · Nav links: {insp.navLinks.length}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="eyebrow mb-2">Evidence</p>
            <div className="glass rounded-xl px-4 py-3 text-xs font-mono space-y-1">
              <p>DOM: {insp.htmlSize} chars HTML · {insp.assets.links} links</p>
              <p>Styles: {insp.colors.length} colors, {insp.fonts.length} font stacks, {insp.mediaQueryCount} media queries, {insp.styleChars} CSS chars (in fetched HTML)</p>
              <p>Assets: {insp.assets.images} images · {insp.assets.scripts} scripts · {insp.assets.stylesheets} stylesheets</p>
              <p>Network resources: full waterfall needs backend HAR capture</p>
            </div>
            <details className="text-xs glass rounded-xl p-3 mt-2">
              <summary className="cursor-pointer font-bold uppercase tracking-[0.15em] text-[0.65rem] text-ink-500">
                Honest limits: what Web Inspect cannot do in-browser
              </summary>
              <ul className="mt-2 space-y-1 font-light list-disc list-inside">
                {insp.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </details>
          </div>

          {insp.navLinks.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Navigation</p>
              <div className="flex flex-wrap gap-1.5">
                {insp.navLinks.slice(0, 10).map((n) => (
                  <span key={n} className="text-xs px-2 py-1 rounded-md glass">{n}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {web.readableText && (
        <details className="text-xs glass rounded-xl p-3">
          <summary className="cursor-pointer font-bold uppercase tracking-[0.15em] text-[0.65rem] text-ink-500">
            Fetched text ({web.readableText.length} chars)
          </summary>
          <p className="mt-2 whitespace-pre-wrap font-light line-clamp-[12]">{web.readableText.slice(0, 3000)}</p>
        </details>
      )}

      <div className="grid sm:grid-cols-3 gap-2">
        {[
          'Explain how this page is structured.',
          'Analyze the visual hierarchy and layout.',
          'Recreate this layout in React + Tailwind.',
        ].map((q) => (
          <button key={q} onClick={() => onAsk(`**About ${web.title || web.url}**\n\n${q}`)} className="text-left text-sm p-3 glass glass-hover rounded-xl font-light">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
