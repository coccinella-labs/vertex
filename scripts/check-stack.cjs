// VERTEX stack health check: `npm run health`.
// Verifies toolchain, dependencies, types, lint, build, bundle contents,
// and live reachability of GitHub / OpenRouter / proxy services.
// Exit 0 = all green, 1 = a FAIL (WARN never fails the run).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const results = [];

function report(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  console.log(`[${icon}] ${name}${detail ? ': ' + detail : ''}`);
}

function sh(cmd, opts) {
  return execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 180000, ...(opts || {}) }).toString();
}

async function fetchOk(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const res = await fetch(url, { ...(options || {}), signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log('VERTEX stack check: ' + new Date().toISOString() + '\n');

  // 1. Toolchain
  try {
    const node = sh('node --version').trim();
    const npm = sh('npm --version').trim();
    const major = parseInt(node.slice(1), 10);
    report('toolchain', major >= 18 ? 'PASS' : 'FAIL', `node ${node}, npm ${npm}`);
  } catch (e) {
    report('toolchain', 'FAIL', 'node/npm not runnable');
  }

  // 2. package.json / lock sync
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
    const pm = (pkg.dependencies || {});
    const missing = Object.keys(pm).filter((d) => !((lock.packages || {})['node_modules/' + d]));
    report('lockfile sync', missing.length === 0 ? 'PASS' : 'FAIL',
      `pkg v${pkg.version}, ${Object.keys(pm).length} deps${missing.length ? ', missing from lock: ' + missing.join(',') : ''}`);
    const supa = pm['@supabase/supabase-js'] ? 'STALE supabase dep present' : 'no stale supabase dep';
    report('dependency hygiene', pm['@supabase/supabase-js'] ? 'FAIL' : 'PASS', supa);
  } catch (e) {
    report('lockfile sync', 'FAIL', 'cannot read package files');
  }

  // 3. node_modules + key binaries
  try {
    for (const bin of ['tsc', 'eslint', 'vite']) {
      if (!fs.existsSync(path.join(ROOT, 'node_modules', '.bin', bin))) throw new Error(bin + ' missing');
    }
    report('node_modules', 'PASS', 'tsc, eslint, vite present');
  } catch (e) {
    report('node_modules', 'FAIL', e.message + ': run npm install');
  }

  // 4. .env key state (dev-local by design; never committed: .env is gitignored)
  try {
    const raw = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
    const m = raw.match(/^VITE_OPENROUTER_API_KEY\s*=\s*(.*)\s*$/m);
    const hasKey = !!(m && m[1].trim());
    report('.env key', hasKey ? 'PASS' : 'WARN', hasKey ? 'built-in key present (local builds only)' : 'empty: chat needs a user key in Settings');
  } catch (e) {
    report('.env key', 'WARN', 'cannot read .env');
  }

  // 5. Typecheck
  try {
    sh('./node_modules/.bin/tsc --noEmit -p tsconfig.app.json');
    report('typecheck', 'PASS', 'tsc clean');
  } catch (e) {
    report('typecheck', 'FAIL', (e.stdout || e.message).toString().split('\n').slice(0, 3).join(' '));
  }

  // 6. Lint
  try {
    sh('./node_modules/.bin/eslint src --no-warn-ignored');
    report('lint', 'PASS', 'eslint clean');
  } catch (e) {
    report('lint', 'FAIL', 'eslint errors: see output above');
  }

  // 6b. Em dash ban: the character must not appear in repo text or prompts
  try {
    const exts = new Set(['.ts', '.tsx', '.css', '.html', '.md', '.json', '.js', '.cjs', '.mts']);
    const skip = new Set(['node_modules', 'dist', '.git']);
    const hits = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '.bolt') walk(p); continue; }
        if (!exts.has(path.extname(e.name))) continue;
        if (e.name === 'package-lock.json') continue;
        const text = fs.readFileSync(p, 'utf8');
        if (text.includes('\u2014')) hits.push(path.relative(ROOT, p));
      }
    };
    walk(ROOT);
    report('no em dashes', hits.length === 0 ? 'PASS' : 'FAIL',
      hits.length === 0 ? 'repo text and prompts clean' : 'found in: ' + hits.join(', '));
  } catch (e) {
    report('no em dashes', 'FAIL', 'scan error: ' + e.message);
  }

  // 7. Build
  try {
    sh('npm run build --silent');
    report('build', 'PASS', 'vite build ok');
  } catch (e) {
    report('build', 'FAIL', 'vite build failed');
  }

  // 8. Bundle contents
  try {
    const assets = fs.readdirSync(path.join(ROOT, 'dist', 'assets')).filter((f) => f.endsWith('.js'));
    const js = fs.readFileSync(path.join(ROOT, 'dist', 'assets', assets[0]), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const hasVersion = js.includes(pkg.version);
    report('bundle version', hasVersion ? 'PASS' : 'FAIL', `v${pkg.version} ${hasVersion ? 'baked in' : 'MISSING from bundle'}`);
  } catch (e) {
    report('bundle version', 'FAIL', 'dist unreadable (build first)');
  }

  // 9. Live services
  try {
    const gh = await fetchOk('https://api.github.com/repos/octocat/Hello-World', { headers: { Accept: 'application/vnd.github+json' } });
    report('github api', gh.ok ? 'PASS' : 'FAIL', `HTTP ${gh.status}`);
  } catch (e) {
    report('github api', 'FAIL', 'unreachable: ' + e.message);
  }
  try {
    const raw = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
    const m = raw.match(/^VITE_OPENROUTER_API_KEY\s*=\s*(.*)\s*$/m);
    const key = (m && m[1].trim()) || '';
    if (!key) {
      report('openrouter key', 'WARN', 'no key to validate: add one for live chat');
    } else {
      const r = await fetchOk('https://openrouter.ai/api/v1/auth/key', { headers: { Authorization: 'Bearer ' + key } });
      report('openrouter key', r.ok ? 'PASS' : 'FAIL', `auth/key HTTP ${r.status}${r.ok ? '' : ': key may be revoked/invalid'}`);
    }
  } catch (e) {
    report('openrouter key', 'WARN', 'check skipped: ' + e.message);
  }
  try {
    const p = await fetchOk('https://api.allorigins.win/raw?url=https%3A%2F%2Fexample.com', {}, 25000);
    report('reader proxy', p.ok ? 'PASS' : 'WARN', `HTTP ${p.status} (best-effort fallback)`);
  } catch (e) {
    report('reader proxy', 'WARN', 'unreachable: direct fetch only');
  }

  // 10. Dev server
  try {
    const d = await fetchOk('http://localhost:5173/', {}, 5000);
    report('dev server', d.ok ? 'PASS' : 'WARN', `localhost:5173 HTTP ${d.status}`);
  } catch (e) {
    report('dev server', 'WARN', 'not running: npm run dev');
  }

  const fails = results.filter((r) => r.status === 'FAIL').length;
  const warns = results.filter((r) => r.status === 'WARN').length;
  console.log(`\n${results.length} checks: ${results.length - fails - warns} pass, ${warns} warn, ${fails} fail.`);
  process.exit(fails ? 1 : 0);
}

main();
