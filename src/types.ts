export type Role = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** Attached images as data URLs (user messages only). Stored locally with the conversation. */
  images?: string[];
  /** Observable work log attached to an assistant message (what was inspected, not private reasoning). */
  work?: WorkRun;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  mode?: ChatMode;
  codebase?: CodebaseAttachment;
  web?: WebAttachment;
  notes?: string;
}

export type Theme = 'light' | 'dark';

export type ChatMode = 'chat' | 'think' | 'plan';

export interface CodebaseFileEntry {
  path: string;
  size?: number;
}

export interface CodebaseIndex {
  owner: string;
  repo: string;
  branch: string;
  repoUrl: string;
  description?: string;
  stars?: number;
  defaultBranch?: string;
  fileCount: number;
  truncated: boolean;
  files: CodebaseFileEntry[];
  importantFiles: string[];
  entryPoints: string[];
  dependencies: Record<string, string>;
  dependencyManager?: string;
  languages: Record<string, number>;
  readmeSnippet?: string;
  /** path -> truncated text content (capped client-side to stay in localStorage) */
  contents: Record<string, string>;
  fetchedAt: number;
}

export interface CodebaseAttachment {
  url: string;
  owner: string;
  repo: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  index?: CodebaseIndex;
}

export interface WebAttachment {
  url: string;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  title?: string;
  readableText?: string;
  fetchedAt?: number;
  /** Structured Web Inspect result (DOM-derived evidence, not screenshots). */
  inspection?: WebInspection;
}

export interface WebStructureNode {
  label: string;
  tag?: string;
  children?: WebStructureNode[];
}

export interface WebInspection {
  title?: string;
  description?: string;
  hasViewportMeta: boolean;
  navLinks: string[];
  headings: { level: number; text: string }[];
  /** Simplified Header/Main/Footer outline for the Visual structure view. */
  structure: WebStructureNode[];
  sectionCount: number;
  colors: string[];
  fonts: string[];
  layoutHints: string[];
  mediaQueryCount: number;
  /** Total chars inside <style> blocks in the fetched HTML. */
  styleChars: number;
  responsiveHints: string[];
  suggestedComponents: string[];
  assets: { images: number; scripts: number; stylesheets: number; links: number };
  htmlSize: number;
  /** Honest capability boundary, shown in UI, not hidden. */
  limitations: string[];
}

export interface Settings {
  apiKey: string;
  model: string;
  temperature: number;
  systemPrompt: string;
}

export type WorkStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface WorkStep {
  id: string;
  label: string;
  /** Observable detail: file/tool/count, never private chain-of-thought. */
  detail?: string;
  status: WorkStepStatus;
  /** True when the step completed but the underlying evidence was thin. */
  weak?: boolean;
}

export type WorkRunKind = 'repo' | 'web' | 'plan' | 'chat';

export interface WorkRun {
  id: string;
  kind: WorkRunKind;
  title: string;
  steps: WorkStep[];
  status: 'running' | 'done' | 'error';
  /** One-line outcome, e.g. "42 files examined · 8 relevant files". */
  summary?: string;
  startedAt: number;
  endedAt?: number;
}
