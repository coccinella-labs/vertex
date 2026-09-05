import type { ChatMode, CodebaseIndex, WebAttachment } from '@/types';
import { buildCodebaseContext, selectRelevantExcerpts } from '@/lib/github';
import { buildWebContext } from '@/lib/web';
import { buildInspectionContext } from '@/lib/webinspect';

export const THINK_FORMAT = `When answering, structure your response exactly with these sections (skip any that don't apply, keep them short):
**Question**: restate what the user is really asking.
**Context**: what you know from the codebase/page + assumptions.
**Observations**: key facts, files, flows you found.
**Possible explanations**: 2-3 hypotheses if ambiguous.
**Options**: approaches with tradeoffs.
**Recommendation**: what you'd do and why.
**Next action**: one concrete step.`;

export const PLAN_FORMAT = `When the user wants to build/change something, respond with a concrete plan:
**Plan**
1. Files to change (existing paths when known)
2. Existing abstractions to reuse
3. Database changes
4. API changes
5. UI changes
6. Tests
7. Risks
Keep each item specific. Reference actual files from the codebase when available.`;

const BASE_IDENTITY = `You are VERTEX, a thinking workspace for understanding software. Your motto: "Understand software before you change it." Be concise, grounded, and specific. Prefer file paths and concrete references over generic advice. Use markdown when structure helps. Never use em dashes in your responses; use commas, colons, or hyphens instead.`;

const UNDERSTAND_SKILLS = `When a codebase is attached you can: give architecture overviews, list important files, trace request/data flow, explain dependencies and design decisions, flag potential problems, and say where to start reading. When a web page is attached you can: explain its structure and how it works, and recreate layouts in React when asked.`;

/** Compose the final system prompt: base + mode format + codebase/web context + user custom. */
export function buildSystemPrompt(args: {
  basePrompt: string;
  mode: ChatMode;
  codebase?: CodebaseIndex;
  web?: WebAttachment;
  userQuestion: string;
}): string {
  const { basePrompt, mode, codebase, web, userQuestion } = args;
  const parts: string[] = [BASE_IDENTITY, UNDERSTAND_SKILLS];

  if (mode === 'think') parts.push(THINK_FORMAT);
  if (mode === 'plan') parts.push(PLAN_FORMAT);

  if (codebase) {
    parts.push(`--- ATTACHED CODEBASE ---\n${buildCodebaseContext(codebase)}`);
    const excerpts = selectRelevantExcerpts(codebase, userQuestion);
    if (excerpts) parts.push(`--- EXCERPTS RELEVANT TO THE QUESTION ---${excerpts}`);
    parts.push(
      `Answer using the actual source above. Always wrap file paths in backticks (e.g. \`src/auth/index.ts\`) so they become clickable evidence. If the answer isn't in the fetched files, say so explicitly and suggest which file/directory would likely contain it. Never invent file contents.`
    );
  }

  if (web && (web.readableText || web.inspection)) {
    const textLen = web.readableText?.length ?? 0;
    if (web.readableText) {
      parts.push(`--- ATTACHED WEB PAGE ---\n${buildWebContext(web.url, web.title, web.readableText)}`);
    }
    if (web.inspection) {
      const limited = textLen < 800;
      parts.push(`--- WEB INSPECT (DOM-derived evidence${limited ? ', page text was limited' : ''}) ---\n${buildInspectionContext(web.url, web.inspection)}`);
      parts.push(
        limited
          ? `Page text was limited, but structural HTML was available: prefer structural claims (layout, nav, components, assets) and say text content is unknown. Distinguish fetched evidence (structure, nav, headings, colors/fonts found in HTML, assets) from inference (exact pixels, hover behavior, screenshots, which are not available in the browser client).`
          : `Distinguish fetched evidence (structure, nav, headings, colors/fonts found in HTML, assets) from inference (exact pixels, hover behavior, screenshots, which are not available in the browser client). If asked for exact spacing, screenshots, or animations, say a backend/browser-rendering layer is needed.`
      );
    }
  }

  if (basePrompt.trim()) parts.push(`--- USER PREFERENCES ---\n${basePrompt.trim()}`);

  return parts.join('\n\n');
}
