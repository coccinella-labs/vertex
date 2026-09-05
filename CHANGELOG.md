# VERTEX Changelog

> Mirrors `src/lib/changelog.ts`. Versions are conceptual milestones:
> what VERTEX became, not dated releases. `v1.0.0` is reserved for
> the first stable release. Current version lives in `package.json`.

## v0.8.4 · Image input

**Added**
- Paste or attach images in the composer (downscaled locally, max 4 per message)
- Multimodal requests: text plus image parts, text-only path unchanged
- Attached images persist in history

**Changed**
- Models without vision fail with a guidance to switch models; VERTEX never switches for you

**Limits**
- Page screenshots and repository binaries remain backend work

## v0.8.3 · Partial web evidence

**Changed**
- Readable text no longer gates HTML usefulness: DOM, styles, and assets are kept even when page text is thin
- Web panel and prompt state limited-text pages explicitly instead of failing or overstating

**Fixed**
- Canvas and shell pages (e.g. 94 readable chars) now yield structural evidence instead of an error

## v0.8.2 · Truthful WorkLog

**Changed**
- Work-log stages report evidence obtained: style colors with CSS chars, page text with char counts
- Thin page evidence (under 800 readable chars) flags the run amber with a limited-evidence summary

## v0.8.1 · Evidence quality

**Changed**
- Repository relevance scoring rewritten: manifests, entry points, and core source outrank docs, examples, and tests
- Content budget diversified across directories so one large folder cannot crowd out the core
- Entry detection covers Go cmd binaries, Python package inits, and lib/<name> cores

**Fixed**
- axios/axios now fetches lib/axios.js and lib/core instead of examples and agent docs
- Validated on axios (JS), flask (Python), cli (Go)

## v0.8.0 · UI validation pass

**Fixed**
- Delete and copy work on touch devices
- Clickable evidence paths and entry points are visually indicated
- Opening an unfetched path shows its state instead of nothing
- Errors render in red, distinct from accent UI
- Empty-state suggestions read as genuine user messages
- Mode selector collapses to icons on narrow screens
- Sidebar shows attachment and mode indicators
- Escape closes dialogs
- Notes show a saved indicator
- Changelog available on mobile
- Asking from a file or page leaves a visible context trail

## v0.7.0 · Web Inspect

**Added**
- Web inspection from any URL
- Structure and navigation analysis
- Layout and responsive analysis
- Visual evidence and implementation hints

**Changed**
- Web work log now shows 7 observable stages

**Limits**
- No pixel-perfect measurements
- No browser-rendered interaction analysis

## v0.6.0 · Plans

**Added**
- Grounded implementation plans
- Clickable file references
- Codebase explorer

## v0.5.0 · Codebase Explorer

**Added**
- File search and code search over fetched source
- Code viewer with line numbers
- Ask-about-this-file actions

## v0.4.0 · Evidence

**Added**
- Fetched-evidence vs inference distinction everywhere
- Clickable source paths in answers
- Private-repository handling without browser tokens

## v0.3.0 · Visible work

**Added**
- Observable work log on every inspection
- Concrete per-stage details (files, counts, paths)
- Auto-collapse after completion

## v0.2.0 · Codebase understanding

**Added**
- GitHub repository indexing from the browser
- Architecture, entry points, and dependency maps
- Think and Plan modes
- Per-conversation workspace (Chat, Codebase, Web, Notes)

## v0.1.0 · Initial Focus Chat

**Added**
- Streaming chat with stop control
- Light and dark themes
- Local persistence of conversations and settings
