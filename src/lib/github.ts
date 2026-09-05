import type { CodebaseIndex } from '@/types';

export function parseGitHubUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  // Matches https://github.com/owner/repo(/...), github.com/owner/repo, owner/repo
  const full = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  if (full) return { owner: full[1], repo: full[2].replace(/\.git$/, '') };
  const short = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (short && !trimmed.includes('://') && !trimmed.includes(' ')) {
    return { owner: short[1], repo: short[2].replace(/\.git$/, '') };
  }
  return null;
}

export function isGitHubUrl(input: string): boolean {
  return parseGitHubUrl(input) !== null;
}

interface GhRepo {
  default_branch: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
}

interface GhTreeItem {
  path: string;
  type: string;
  size?: number;
}

const MAX_FILES_LISTED = 400;
const MAX_CONTENT_FILES = 18;
const MAX_FILE_CHARS = 8000;
const MAX_TOTAL_CHARS = 90000;
const BINARY_RE = /\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|tar|gz|mp4|mov|woff2?|ttf|eot|lock)$/i;

const MANIFEST_BASENAMES = [
  'package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg',
  'go.mod', 'Cargo.toml', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json',
];

const SOURCE_DIRS = [
  'src/', 'lib/', 'app/', 'pkg/', 'internal/', 'cmd/',
  'api/', 'core/', 'server/', 'client/',
];

const DEMO_DOC_DIRS = [
  'examples/', 'example/', 'docs/', 'doc/', 'demo/', 'demos/',
  'tutorial/', 'tutorials/', 'benchmark/', 'benchmarks/', 'samples/',
  'sandbox/', '.github/', 'scripts/', 'tools/', 'fixtures/', 'testdata/',
];

const BUILD_CONFIG_RE = /^(gulp|grunt|rollup|webpack|eslint|babel|jest|vitest|playwright|karma|protractor)[-.]?(config|file)?\.[a-z]+$|^[a-z]+\.config\.[a-z]+$/;

const LOW_VALUE_DOCS = ['agents.md', 'claude.md', 'changelog.md', 'contributing.md', 'code_of_conduct.md'];
const TEST_PATTERNS = ['test', 'tests', '__tests__', 'spec', 'e2e', 'testing'];

function isTestPath(lower: string): boolean {
  return TEST_PATTERNS.some((t) => lower.includes(t));
}

function isDemoDocPath(lower: string): boolean {
  return DEMO_DOC_DIRS.some((d) => lower.includes(d));
}

function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i + 1).toLowerCase() : '(no ext)';
}

function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

function isRootReadme(path: string): boolean {
  return /^readme(\.[a-z]+)?$/i.test(basename(path)) && !path.includes('/');
}

function isNestedReadme(lower: string): boolean {
  return lower.includes('readme') && lower.includes('/');
}

function scoreImportance(path: string, entryPoints: string[]): number {
  const lower = path.toLowerCase();
  const base = basename(lower);
  let s = 0;

  // Dependency manifests / build files at root describe the whole project
  if (MANIFEST_BASENAMES.includes(base) && !path.includes('/')) s += 60;
  else if (MANIFEST_BASENAMES.includes(base)) s += 20;

  // Detected entry points are the reading start
  if (entryPoints.includes(path)) s += 50;

  // Root README is the project overview; nested READMEs are per-directory docs
  if (isRootReadme(path)) s += 40;
  else if (isNestedReadme(lower)) s -= 10;

  // Core source lives in conventional directories
  if (SOURCE_DIRS.some((d) => lower.startsWith(d) || lower.includes('/' + d))) s += 12;

  // Source files (not docs/config) in or near the core
  if (/\.(ts|tsx|js|jsx|mjs|py|go|rs|java|rb|php)$/.test(lower)) s += 6;

  // Framework-significant filenames
  if (/(main|index|app|server|mod|lib)\.[a-z]+$/.test(base)) s += 4;
  if (lower.includes('auth')) s += 4;

  // Minified bundles and lockfiles are noise for understanding
  if (base.includes('.min.') || base.includes('lock')) s -= 30;

  // Build configs and agent-instruction docs are not product source
  if (BUILD_CONFIG_RE.test(base)) s -= 25;
  if (LOW_VALUE_DOCS.includes(base)) s -= 20;

  // Demos, docs, translations, tests and fixtures crowd out the core. Push down.
  if (isDemoDocPath(lower)) s -= 25;
  if (isTestPath(lower)) s -= 20;

  // vendored / generated code
  if (lower.includes('node_modules') || lower.includes('dist/') || lower.includes('.git/') || lower.includes('vendor/')) s -= 100;

  // Mild depth penalty only past 3 levels, so lib/core/x.js beats examples/x.js
  const depth = path.split('/').length;
  if (depth > 3) s -= (depth - 3) * 2;
  return s;
}

function detectEntryPoints(paths: string[], repo: string): string[] {
  const candidates = [
    'src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts', 'src/App.tsx',
    'src/app/layout.tsx', 'src/app/page.tsx', 'app/page.tsx',
    'main.py', 'app.py', 'src/main.py', 'server.py',
    'cmd/server/main.go', 'main.go', 'server/index.js', 'src/server.ts',
    'src/index.js', 'index.js', 'Dockerfile',
    `lib/${repo}.js`, `lib/${repo}.ts`, `src/${repo}.ts`,
  ];
  const set = new Set(paths);
  const found = candidates.filter((c) => set.has(c));
  // + any top-level main/app/server file, Go cmd binaries, Python package inits
  for (const p of paths) {
    if (found.length >= 8) break;
    if (found.includes(p)) continue;
    if (/^(src\/)?(main|app|server|index)\.[a-z]+$/i.test(p)) found.push(p);
    else if (/^cmd\/[^/]+\/main\.go$/.test(p)) found.push(p);
    else if (/^src\/[^/]+\/(__init__|app|main)\.py$/.test(p)) found.push(p);
  }
  return found.slice(0, 8);
}

function parseDependencies(managerFile: string, raw: string): { manager: string; deps: Record<string, string> } {
  try {
    if (managerFile === 'package.json') {
      const j = JSON.parse(raw);
      return {
        manager: 'npm',
        deps: { ...(j.dependencies ?? {}), ...(j.devDependencies ? {} : {}) },
      };
    }
    if (managerFile === 'requirements.txt') {
      const deps: Record<string, string> = {};
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const m = t.match(/^([A-Za-z0-9_.-]+)\s*([=<>!~]+.*)?$/);
        if (m) deps[m[1]] = (m[2] ?? '').trim() || '*';
        if (Object.keys(deps).length >= 60) break;
      }
      return { manager: 'pip', deps };
    }
    if (managerFile === 'go.mod') {
      const deps: Record<string, string> = {};
      const re = /^\s*([a-z0-9./_-]+\.[a-z]{2,}[a-z0-9./_-]*)\s+(v[0-9][^\s]*)/gim;
      let m: RegExpExecArray | null;
      while ((m = re.exec(raw)) && Object.keys(deps).length < 60) deps[m[1]] = m[2];
      return { manager: 'go modules', deps };
    }
    if (managerFile === 'Cargo.toml') {
      const deps: Record<string, string> = {};
      const section = raw.split('[dependencies]')[1]?.split('[')[0] ?? '';
      for (const line of section.split('\n')) {
        const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(.+)\s*$/);
        if (m) deps[m[1]] = m[2].trim().slice(0, 40);
        if (Object.keys(deps).length >= 60) break;
      }
      return { manager: 'cargo', deps };
    }
  } catch {
    // fall through
  }
  return { manager: managerFile, deps: {} };
}

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Not found or private. Public repos only. Never paste access tokens in the browser.');
    }
    if (res.status === 403) {
      throw new Error('GitHub rate limited. Try again shortly.');
    }
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface IndexProgress {
  signal?: AbortSignal;
  /** Observable stage updates for the visible work log. Stage ids: meta, tree, manifest, readme, contents, done. */
  onStage?: (stage: string, detail?: string) => void;
}

export async function fetchCodebaseIndex(owner: string, repo: string, opts?: IndexProgress | AbortSignal): Promise<CodebaseIndex> {
  const signal = opts instanceof AbortSignal ? opts : opts?.signal;
  const onStage = opts instanceof AbortSignal ? undefined : opts?.onStage;
  if (signal?.aborted) throw new Error('Aborted');
  onStage?.('open', `github.com/${owner}/${repo}`);
  const meta = await ghJson<GhRepo>(`https://api.github.com/repos/${owner}/${repo}`);
  const branch = meta.default_branch || 'main';

  const treeRes = await ghJson<{ tree: GhTreeItem[]; truncated: boolean }>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );

  const allBlobs = treeRes.tree.filter((t) => t.type === 'blob' && !(t.path.includes('node_modules/') || t.path.startsWith('.git/')));
  const truncated = Boolean(treeRes.truncated) || allBlobs.length > MAX_FILES_LISTED;
  const files = allBlobs.slice(0, MAX_FILES_LISTED).map((t) => ({ path: t.path, size: t.size }));
  const paths = files.map((f) => f.path);

  const languages: Record<string, number> = {};
  for (const p of paths) {
    if (BINARY_RE.test(p)) continue;
    const e = extOf(p);
    languages[e] = (languages[e] ?? 0) + 1;
  }

  const entryPoints = detectEntryPoints(paths, repo);
  const importantFiles = [...paths]
    .sort((a, b) => scoreImportance(b, entryPoints) - scoreImportance(a, entryPoints))
    .slice(0, 30);
  onStage?.('tree', `${allBlobs.length} files · branch ${branch}`);

  // Dependency manifest: prefer package.json, else requirements/pyproject/go.mod/Cargo
  const manifestOrder = ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml'];
  onStage?.('files', `${importantFiles.length} relevant files`);
  onStage?.('entry', entryPoints.length ? entryPoints.slice(0, 3).join(', ') : 'none detected');
  let dependencyManager: string | undefined;
  let dependencies: Record<string, string> = {};
  let manifestRaw = '';
  let manifestName = '';
  for (const name of manifestOrder) {
    if (paths.includes(name)) {
      manifestName = name;
      break;
    }
  }

  const contents: Record<string, string> = {};
  let totalChars = 0;

  async function fetchRaw(path: string): Promise<string | null> {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${path}`;
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      const text = await res.text();
      return text;
    } catch {
      return null;
    }
  }

  if (manifestName) {
    manifestRaw = (await fetchRaw(manifestName)) ?? '';
    if (manifestRaw) {
      const parsed = parseDependencies(manifestName, manifestRaw.slice(0, 20000));
      dependencyManager = parsed.manager;
      dependencies = parsed.deps;
      contents[manifestName] = manifestRaw.slice(0, MAX_FILE_CHARS);
      totalChars += contents[manifestName].length;
      const depCount = Object.keys(dependencies).length;
      onStage?.('deps', `${manifestName} · ${depCount} deps`);
    }
  } else {
    onStage?.('deps', 'no manifest found');
  }

  // README snippet
  const readmePath = paths.find((p) => /^readme\.md$/i.test(p)) ?? paths.find((p) => p.toLowerCase().includes('readme'));
  let readmeSnippet: string | undefined;
  if (readmePath) {
    const raw = await fetchRaw(readmePath);
    if (raw) {
      readmeSnippet = raw.slice(0, 3000);
      if (!contents[readmePath] && totalChars + 3000 < MAX_TOTAL_CHARS) {
        contents[readmePath] = raw.slice(0, MAX_FILE_CHARS);
        totalChars += contents[readmePath].length;
      }
    }
  }

  // Fetch a capped set of files for Q&A context, budgeted by category so
  // docs/examples/tests cannot crowd out the core: entry points first,
  // then top-ranked source files outside demo/doc/test directories.
  const READABLE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.md', '.json', '.yml', '.yaml', '.toml'];
  const SOURCE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.go', '.rs', '.java', '.rb', '.php'];
  const isReadable = (p: string) =>
    !BINARY_RE.test(p) && !contents[p] && READABLE_EXT.some((e) => p.endsWith(e));
  const isCoreSource = (p: string) => {
    const lower = p.toLowerCase();
    return !isDemoDocPath(lower) && !isTestPath(lower) && !lower.includes('readme');
  };
  const ranked = [...paths].sort((a, b) => scoreImportance(b, entryPoints) - scoreImportance(a, entryPoints));
  // Round-robin across directory groups (first two segments) so one large
  // directory (e.g. api/ queries) cannot crowd out the rest of the core.
  const groupKey = (p: string) => {
    const parts = p.split('/');
    return parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
  };
  // Diversification draws from source code only. Docs and configs come via the
  // manifest, README, and tail paths, never at the expense of product source.
  const isDiversifiable = (p: string) =>
    isReadable(p) && isCoreSource(p) && SOURCE_EXT.some((e) => p.endsWith(e)) && !p.startsWith('.') && p.includes('/');
  const diversePool = ranked.filter(isDiversifiable);
  const groups = new Map<string, string[]>();
  for (const p of diversePool) {
    const k = groupKey(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  const diversified: string[] = [];
  for (let round = 0; diversified.length < diversePool.length; round++) {
    let progressed = false;
    for (const list of groups.values()) {
      if (round < list.length) {
        diversified.push(list[round]);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  const contentCandidates = [
    ...entryPoints.filter(isReadable),
    ...diversified,
    ...ranked.filter((p) => isReadable(p)),
  ];
  const deduped = [...new Set(contentCandidates)].slice(0, MAX_CONTENT_FILES);

  await Promise.all(
    deduped.map(async (p) => {
      if (totalChars >= MAX_TOTAL_CHARS) return;
      const raw = await fetchRaw(p);
      if (raw) {
        const slice = raw.slice(0, MAX_FILE_CHARS);
        // crude total guard (parallel overshoot is acceptable)
        contents[p] = slice;
        totalChars += slice.length;
      }
    })
  );
  onStage?.('answer', `${allBlobs.length} files · ${Object.keys(contents).length} read`);

  return {
    owner,
    repo,
    branch,
    repoUrl: `https://github.com/${owner}/${repo}`,
    description: meta.description ?? undefined,
    stars: meta.stargazers_count,
    defaultBranch: meta.default_branch,
    fileCount: allBlobs.length,
    truncated,
    files,
    importantFiles,
    entryPoints,
    dependencies,
    dependencyManager,
    languages,
    readmeSnippet,
    contents,
    fetchedAt: Date.now(),
  };
}

/** Build a compact text summary of the index to inject into the LLM system prompt. */
export function buildCodebaseContext(index: CodebaseIndex, maxChars = 12000): string {
  const lines: string[] = [];
  lines.push(`Repository: ${index.owner}/${index.repo} (${index.repoUrl}) branch ${index.branch}`);
  if (index.description) lines.push(`About: ${index.description}`);
  lines.push(`Files: ${index.fileCount}${index.truncated ? ` (listing first ${index.files.length})` : ''}`);
  const topLangs = Object.entries(index.languages).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(', ');
  if (topLangs) lines.push(`File types: ${topLangs}`);
  if (index.entryPoints.length) lines.push(`Entry points: ${index.entryPoints.join(', ')}`);
  if (index.importantFiles.length) lines.push(`Key files: ${index.importantFiles.slice(0, 20).join(', ')}`);
  if (index.dependencyManager) {
    const depList = Object.entries(index.dependencies).slice(0, 30).map(([k, v]) => `${k}@${v}`).join(', ');
    lines.push(`Dependencies (${index.dependencyManager}): ${depList || '(none parsed)'}`);
  }
  if (index.readmeSnippet) lines.push(`README excerpt:\n${index.readmeSnippet.slice(0, 1500)}`);

  let out = lines.join('\n');
  // Append file contents until budget
  for (const [path, content] of Object.entries(index.contents)) {
    const block = `\n\n--- FILE: ${path} ---\n${content.slice(0, 3000)}`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out;
}

/** Pick cached file excerpts most relevant to a user question (keyword overlap). */
export function selectRelevantExcerpts(index: CodebaseIndex, question: string, maxChars = 6000): string {
  const tokens = question.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const scored = Object.entries(index.contents).map(([path, content]) => {
    const hay = (path + '\n' + content.slice(0, 4000)).toLowerCase();
    let s = 0;
    for (const t of tokens) if (hay.includes(t)) s += 1;
    if (/auth/i.test(question) && /auth|login|session|oauth|jwt/i.test(hay)) s += 3;
    if (/rout|api|request|flow/i.test(question) && /rout|controller|handler|endpoint|app\.(get|post|use)/i.test(hay)) s += 2;
    return { path, content, s };
  });
  scored.sort((a, b) => b.s - a.s);
  let out = '';
  for (const { path, content } of scored) {
    const block = `\n\n--- ${path} ---\n${content.slice(0, 2500)}`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out;
}
