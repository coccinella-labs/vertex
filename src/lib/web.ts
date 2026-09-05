import { inspectHtml } from '@/lib/webinspect';
import type { WebInspection } from '@/types';

export function isHttpUrl(input: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(input.trim());
}

export function extractUrl(input: string): string | null {
  const m = input.trim().match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0].replace(/[).,;!?]+$/, '') : null;
}

export interface WebFetchResult {
  title?: string;
  readableText: string;
  html?: string;
  inspection?: WebInspection;
}

/** Below this many readable chars, page evidence is flagged weak (JS shell, canvas page). */
export const WEAK_TEXT_THRESHOLD = 800;

/** Fetch a page as readable text. Browser CORS blocks most sites directly,
 *  so try direct first, then fall back to public CORS proxies / reader.
 *  Keeps only a capped excerpt for LLM context. */
export async function fetchWebReadable(
  url: string,
  signal?: AbortSignal,
  onStage?: (stage: string, detail?: string) => void,
): Promise<WebFetchResult> {
  const errors: string[] = [];

  // 1. direct (works for CORS-enabled sites)
  onStage?.('open', url);
  // Best HTML seen so far. Kept even when readable text is thin, so
  // structural evidence (DOM, styles, assets) is never thrown away.
  let fallback: { html: string; title?: string; readableText: string; inspection: WebInspection } | null = null;
  const consider = (html: string) => {
    const parsed = htmlToReadable(html);
    const inspection = inspectHtml(html, url);
    onStage?.('structure', `${html.length} chars HTML`);
    onStage?.('nav', inspection.navLinks.length ? `${inspection.navLinks.length} nav links` : 'no nav links found');
    onStage?.('visual', inspection.sectionCount ? `${inspection.sectionCount} sections` : 'page sections scanned');
    onStage?.('layout', inspection.layoutHints[0] ?? 'layout scanned');
    onStage?.('responsive', inspection.responsiveHints[0] ?? 'responsive checked');
    onStage?.('components', inspection.suggestedComponents.slice(0, 3).join(', ') || 'components mapped');
    onStage?.('styles', `${inspection.colors.length} colors · ${inspection.styleChars} CSS chars`);
    onStage?.('preview', 'preview ready');
    onStage?.('answer', `${parsed.readableText.length} chars text`);
    const candidate = { html: html.slice(0, 200000), title: parsed.title, readableText: parsed.readableText, inspection };
    if (!fallback || candidate.readableText.length > fallback.readableText.length) fallback = candidate;
    return candidate;
  };
  const tryFetch = async (label: string, target: string) => {
    try {
      const res = await fetch(target, { signal });
      if (!res.ok) {
        errors.push(`${label} ${res.status}`);
        return null;
      }
      return consider(await res.text());
    } catch {
      errors.push(`${label} failed`);
      return null;
    }
  };

  const direct = await tryFetch('direct', url);
  if (direct && direct.readableText.length > 200) return direct;

  // Public readers, in order. Any single one may be down or rate-limited.
  // Labels stay internal: the UI reports what was found, not attempt counts.
  const readers: [string, (u: string) => string][] = [
    ['backup reader', (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`],
    ['backup reader', (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`],
    ['backup reader', (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`],
  ];
  let attempt = 0;
  for (const [label, build] of readers) {
    attempt += 1;
    onStage?.('open', `via ${label}`);
    const candidate = await tryFetch(`${label} ${attempt}`, build(url));
    if (candidate && candidate.readableText.length > 200) return candidate;
  }

  if (fallback) return fallback;

  console.warn(`Web fetch diagnostics for ${url}: ${errors.join('; ') || 'blocked'}`);
  throw new Error(
    `Couldn't read this page. The site may block automated access. The live preview may still work.`
  );
}

export function htmlToReadable(html: string): WebFetchResult {
  const titleMatch = html.match(/<title[^>]*>([\s\S]{0,300})<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined;

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');

  // headings / paragraphs / list items -> newlines
  text = text
    .replace(/<(h[1-6]|p|li|tr|div|section|article|br)[^>]*>/gi, '\n')
    .replace(/<\/[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  return { title, readableText: text.slice(0, 8000) };
}

export function buildWebContext(url: string, title: string | undefined, readableText: string, maxChars = 5000): string {
  return `Web page: ${url}${title ? `: "${title}"` : ''}\nExcerpt:\n${readableText.slice(0, maxChars)}`;
}
