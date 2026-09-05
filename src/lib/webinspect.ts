import type { WebInspection, WebStructureNode } from '@/types';

function attrText(html: string, tag: string, attr: string, limit = 40): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*${attr}\\s*=\\s*["']([^"']{1,120})["'][^>]*>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const v = m[1].trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function linkTexts(html: string, scopeHtml: string, limit = 12): string[] {
  const out: string[] = [];
  const re = /<a[^>]*>([\s\S]{1,80}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scopeHtml)) && out.length < limit) {
    const t = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (t && t.length > 1 && !out.includes(t)) out.push(t);
  }
  void html;
  return out;
}

function scopeOf(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]{0,20000})<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}

function hasTag(html: string, tag: string): boolean {
  return new RegExp(`<${tag}[\\s>]`, 'i').test(html);
}

function classIdHints(html: string): string[] {
  const hints: string[] = [];
  const re = /(?:class|id)\s*=\s*["']([^"']{1,200})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && hints.length < 400) hints.push(m[1].toLowerCase());
  return hints;
}

export function inspectHtml(html: string, url: string): WebInspection {
  void url;
  const titleMatch = html.match(/<title[^>]*>([\s\S]{0,300})<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : undefined;
  const descMatch = html.match(/<meta[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']{1,300})["']/i)
    ?? html.match(/<meta[^>]*content\s*=\s*["']([^"']{1,300})["'][^>]*name\s*=\s*["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : undefined;
  const hasViewportMeta = /<meta[^>]*name\s*=\s*["']viewport["']/i.test(html);

  const headerHtml = scopeOf(html, 'header');
  const navHtml = scopeOf(html, 'nav') || headerHtml;
  const mainHtml = scopeOf(html, 'main');
  const footerHtml = scopeOf(html, 'footer');
  const navLinks = linkTexts(html, navHtml || html.slice(0, 15000), 12);

  const headings: { level: number; text: string }[] = [];
  const hre = /<h([1-6])[^>]*>([\s\S]{1,140}?)<\/h\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hre.exec(html)) && headings.length < 20) {
    const text = hm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text) headings.push({ level: Number(hm[1]), text: text.slice(0, 120) });
  }

  const hints = classIdHints(html);
  const hintStr = hints.join(' ');
  const has = (s: string) => hintStr.includes(s);

  // Visual structure outline
  const headerKids: WebStructureNode[] = [];
  if (hasTag(html, 'header') || navHtml) {
    if (has('logo') || has('brand')) headerKids.push({ label: 'Logo' });
    if (navLinks.length || hasTag(html, 'nav')) headerKids.push({ label: `Navigation (${navLinks.length || '…'} links)` });
    if (has('login') || has('signup') || has('cta') || has('button') || has('action')) headerKids.push({ label: 'Actions' });
    if (headerKids.length === 0) headerKids.push({ label: 'Top bar content' });
  }
  const mainKids: WebStructureNode[] = [];
  if (has('hero')) mainKids.push({ label: 'Hero' });
  if (has('chat') || has('conversation') || has('message') || has('composer') || has('prompt') || has('input')) {
    if (has('chat') || has('conversation') || has('message')) mainKids.push({ label: 'Conversation area' });
    if (has('composer') || has('prompt') || has('input') || has('textarea')) mainKids.push({ label: 'Input / Composer' });
  }
  if (has('sidebar') || has('aside') || hasTag(html, 'aside')) mainKids.push({ label: 'Sidebar' });
  if (has('card') || has('grid') || has('feature')) mainKids.push({ label: 'Content cards / grid' });
  if (has('pricing')) mainKids.push({ label: 'Pricing' });
  if (has('faq')) mainKids.push({ label: 'FAQ' });
  if (mainKids.length === 0) {
    if (hasTag(html, 'main')) mainKids.push({ label: 'Main content' });
    else mainKids.push({ label: 'Page body' });
  }
  const footerKids: WebStructureNode[] = [];
  if (hasTag(html, 'footer') || footerHtml) {
    if (linkTexts(html, footerHtml, 4).length) footerKids.push({ label: 'Footer links' });
    else footerKids.push({ label: 'Footer' });
  }
  const structure: WebStructureNode[] = [];
  if (headerKids.length) structure.push({ label: 'Header', tag: 'header', children: headerKids });
  structure.push({ label: hasTag(html, 'main') ? 'Main' : 'Body', tag: 'main', children: mainKids });
  if (footerKids.length) structure.push({ label: 'Footer', tag: 'footer', children: footerKids });

  const sectionCount = (html.match(/<section[\s>]/gi) || []).length
    + (html.match(/<article[\s>]/gi) || []).length;

  // Styles evidence (from fetched HTML/CSS text only, not computed pixels)
  const colorSet = new Set<string>();
  const colorRe = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\([^)]{1,60}\)|hsla?\([^)]{1,60}\)/g;
  let cm: RegExpExecArray | null;
  while ((cm = colorRe.exec(html)) && colorSet.size < 12) colorSet.add(cm[0].slice(0, 32));
  let styleChars = 0;
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(html))) styleChars += sm[1].length;
  const fonts = attrText(html, '[a-z]+', 'font-family').slice(0, 6);
  const fontMatches = html.match(/font-family\s*:\s*([^;]{1,120})/gi) || [];
  for (const f of fontMatches.slice(0, 6)) {
    const v = f.split(':')[1]?.trim().slice(0, 60);
    if (v && !fonts.includes(v)) fonts.push(v);
  }

  const layoutHints: string[] = [];
  if (/display\s*:\s*grid/i.test(html) || has('grid')) layoutHints.push('grid sections detected');
  if (/display\s*:\s*flex/i.test(html) || has('flex')) layoutHints.push('flex rows detected');
  if (has('container') || has('max-w') || has('center')) layoutHints.push('centered content column');
  if (has('rounded')) layoutHints.push('rounded surfaces');
  if (has('gap-') || /gap\s*:/i.test(html)) layoutHints.push('consistent gaps / whitespace');
  if (layoutHints.length === 0) layoutHints.push('standard block flow');

  const mediaQueryCount = (html.match(/@media/gi) || []).length;
  const responsiveHints: string[] = [];
  responsiveHints.push(hasViewportMeta ? 'viewport meta present (mobile-aware)' : 'no viewport meta found');
  if (mediaQueryCount) responsiveHints.push(`${mediaQueryCount} media queries in fetched CSS`);
  if (has('sm:') || has('md:') || has('lg:')) responsiveHints.push('responsive breakpoint classes (sm/md/lg)');
  if (has('grid-cols')) responsiveHints.push('multi-column grid (collapses on small screens)');
  if (responsiveHints.length === 1) responsiveHints.push('no further responsive signals in fetched HTML');

  // Suggested React components (heuristic, labelled as inference)
  const suggested: string[] = [];
  const push = (n: string) => { if (!suggested.includes(n)) suggested.push(n); };
  if (headerKids.length) push('Header');
  if (navLinks.length) push('Nav');
  if (has('sidebar') || has('aside')) push('Sidebar');
  if (has('hero')) push('Hero');
  if (has('chat') || has('conversation')) { push('Chat'); push('Message'); }
  if (has('composer') || has('prompt') || has('textarea') || has('input')) push('Composer');
  if (has('card')) push('Card');
  if (has('footer')) push('Footer');
  if (!suggested.length) { push('Header'); push('Main'); push('Footer'); }

  void mainHtml;
  const assets = {
    images: (html.match(/<img[\s>]/gi) || []).length,
    scripts: (html.match(/<script[\s>]/gi) || []).length,
    stylesheets: (html.match(/<link[^>]*rel\s*=\s*["']stylesheet["']/gi) || []).length,
    links: (html.match(/<a[\s>]/gi) || []).length,
  };

  return {
    title,
    description,
    hasViewportMeta,
    navLinks,
    headings: headings.slice(0, 12),
    structure,
    sectionCount,
    colors: [...colorSet],
    fonts: fonts.slice(0, 6),
    layoutHints,
    mediaQueryCount,
    responsiveHints,
    suggestedComponents: suggested.slice(0, 8),
    assets,
    htmlSize: html.length,
    styleChars,
    limitations: [
      'No screenshots: pixels need a rendering backend.',
      'No exact spacing or animation detail: needs computed CSS from a renderer.',
      'Heavy client-rendered pages may differ from fetched HTML.',
      'Blocked sites show partial evidence only.',
    ],
  };
}

export function buildInspectionContext(url: string, inspection: WebInspection, maxChars = 4000): string {
  const lines: string[] = [];
  lines.push(`Web Inspect: ${url}${inspection.title ? `: "${inspection.title}"` : ''}`);
  const struct = inspection.structure
    .map((n) => `${n.label}${n.children?.length ? ` (${n.children.map((c) => c.label).join(', ')})` : ''}`)
    .join(' / ');
  if (struct) lines.push(`Structure: ${struct}`);
  if (inspection.navLinks.length) lines.push(`Nav: ${inspection.navLinks.slice(0, 8).join(' | ')}`);
  if (inspection.headings.length) {
    lines.push(`Headings: ${inspection.headings.slice(0, 6).map((h) => `h${h.level}:${h.text}`).join(' | ')}`);
  }
  if (inspection.colors.length) lines.push(`Colors (in fetched CSS): ${inspection.colors.slice(0, 8).join(', ')}`);
  if (inspection.fonts.length) lines.push(`Fonts: ${inspection.fonts.slice(0, 4).join(' | ')}`);
  if (inspection.layoutHints.length) lines.push(`Layout: ${inspection.layoutHints.join('; ')}`);
  if (inspection.responsiveHints.length) lines.push(`Responsive: ${inspection.responsiveHints.join('; ')}`);
  if (inspection.suggestedComponents.length) lines.push(`Likely components: ${inspection.suggestedComponents.join(', ')}`);
  lines.push(`Assets: ${inspection.assets.images} images, ${inspection.assets.scripts} scripts, ${inspection.assets.stylesheets} stylesheets, ${inspection.assets.links} links (${inspection.htmlSize} chars HTML)`);
  const out = lines.join('\n');
  return out.slice(0, maxChars);
}
