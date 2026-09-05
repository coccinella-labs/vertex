export interface ChangelogEntry {
  version: string;
  title: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
  limits?: string[];
}

/** Conceptual milestones: what VERTEX became, not dated releases.
 *  v1.0.0 is reserved for the first stable release. */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.8.4',
    title: 'Image input',
    added: [
      'Paste or attach images in the composer (downscaled locally, max 4 per message)',
      'Multimodal requests: text plus image parts, text-only path unchanged',
      'Attached images persist in history',
    ],
    changed: [
      'Models without vision fail with a guidance to switch models; VERTEX never switches for you',
    ],
    limits: [
      'Page screenshots and repository binaries remain backend work',
    ],
  },
  {
    version: '0.8.3',
    title: 'Partial web evidence',
    changed: [
      'Readable text no longer gates HTML usefulness: DOM, styles, and assets are kept even when page text is thin',
      'Web panel and prompt state limited-text pages explicitly instead of failing or overstating',
    ],
    fixed: ['Canvas and shell pages (e.g. 94 readable chars) now yield structural evidence instead of an error'],
  },
  {
    version: '0.8.2',
    title: 'Truthful WorkLog',
    changed: [
      'Work-log stages report evidence obtained: style colors with CSS chars, page text with char counts',
      'Thin page evidence (under 800 readable chars) flags the run amber with a limited-evidence summary',
    ],
  },
  {
    version: '0.8.1',
    title: 'Evidence quality',
    changed: [
      'Repository relevance scoring rewritten: manifests, entry points, and core source outrank docs, examples, and tests',
      'Content budget diversified across directories so one large folder cannot crowd out the core',
      'Entry detection covers Go cmd binaries, Python package inits, and lib/<name> cores',
    ],
    fixed: [
      'axios/axios now fetches lib/axios.js and lib/core instead of examples and agent docs',
      'Validated on axios (JS), flask (Python), cli (Go)',
    ],
  },
  {
    version: '0.8.0',
    title: 'UI validation pass',
    fixed: [
      'Delete and copy work on touch devices',
      'Clickable evidence paths and entry points are visually indicated',
      'Opening an unfetched path shows its state instead of nothing',
      'Errors render in red, distinct from accent UI',
      'Empty-state suggestions read as genuine user messages',
      'Mode selector collapses to icons on narrow screens',
      'Sidebar shows attachment and mode indicators',
      'Escape closes dialogs',
      'Notes show a saved indicator',
      'Changelog available on mobile',
      'Asking from a file or page leaves a visible context trail',
    ],
  },
  {
    version: '0.7.0',
    title: 'Web Inspect',
    added: [
      'Web inspection from any URL',
      'Structure and navigation analysis',
      'Layout and responsive analysis',
      'Visual evidence and implementation hints',
    ],
    changed: ['Web work log now shows 7 observable stages'],
    limits: [
      'No pixel-perfect measurements',
      'No browser-rendered interaction analysis',
    ],
  },
  {
    version: '0.6.0',
    title: 'Plans',
    added: [
      'Grounded implementation plans',
      'Clickable file references',
      'Codebase explorer',
    ],
  },
  {
    version: '0.5.0',
    title: 'Codebase Explorer',
    added: [
      'File search and code search over fetched source',
      'Code viewer with line numbers',
      'Ask-about-this-file actions',
    ],
  },
  {
    version: '0.4.0',
    title: 'Evidence',
    added: [
      'Fetched-evidence vs inference distinction everywhere',
      'Clickable source paths in answers',
      'Private-repository handling without browser tokens',
    ],
  },
  {
    version: '0.3.0',
    title: 'Visible work',
    added: [
      'Observable work log on every inspection',
      'Concrete per-stage details (files, counts, paths)',
      'Auto-collapse after completion',
    ],
  },
  {
    version: '0.2.0',
    title: 'Codebase understanding',
    added: [
      'GitHub repository indexing from the browser',
      'Architecture, entry points, and dependency maps',
      'Think and Plan modes',
      'Per-conversation workspace (Chat, Codebase, Web, Notes)',
    ],
  },
  {
    version: '0.1.0',
    title: 'Initial Focus Chat',
    added: [
      'Streaming chat with stop control',
      'Light and dark themes',
      'Local persistence of conversations and settings',
    ],
  },
];
