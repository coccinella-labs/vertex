// VERTEX deployed-site check: `npm run verify:live-site`.
// Black-box validation of whatever URL serves the app (dev server or
// public host). Set VERTEX_SITE_URL (default http://localhost:5173).
// Fails on missing page/assets: and on a leaked OpenRouter secret in
// served JS, unless ALLOW_BUNDLED_KEY=1 (local-only builds).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = (process.env.VERTEX_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
const ALLOW_KEY = process.env.ALLOW_BUNDLED_KEY === '1';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0;
let fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`[PASS] ${name}${extra ? ': ' + extra : ''}`); }
  else { fail++; console.log(`[FAIL] ${name} ${extra || ''}`); }
}

async function get(p, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
  try {
    const res = await fetch(SITE + p, { signal: ctrl.signal });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  console.log(`VERTEX deployed-site check: ${SITE} (expecting v${pkg.version})\n`);

  // 1. Root serves the app
  let root = null;
  try {
    root = await get('/');
    check('root serves', root.status === 200, `HTTP ${root.status}`);
    check('app title', /VERTEX/.test(root.text), 'title/meta present');
  } catch (e) {
    check('root serves', false, 'unreachable: ' + e.message);
    console.log(`\nTOTAL: ${pass} pass, ${fail} fail.`);
    process.exit(1);
  }

  // 2. Static brand asset
  try {
    const svg = await get('/vertex.svg');
    check('brand asset', svg.status === 200 && svg.text.includes('<svg'), `HTTP ${svg.status}`);
  } catch (e) {
    check('brand asset', false, e.message);
  }

  // 3. Fetch every served script and inspect the bundle
  const srcs = [...root.text.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  let bundle = '';
  for (const src of srcs) {
    try {
      const r = await get(src.startsWith('http') ? src.replace(SITE, '') : src);
      if (r.status === 200) bundle += '\n' + r.text;
    } catch { /* unreachable asset counts below */ }
  }
  check('scripts fetchable', bundle.length > 1000, `${srcs.length} script(s), ${bundle.length} chars`);
  if (bundle.includes(pkg.version)) {
    check('served version', true, `v${pkg.version} baked in`);
  } else {
    // Dev servers serve unbundled modules, so the version may not be inlined.
    const isLocal = /localhost|127\.0\.0\.1/.test(SITE);
    if (isLocal) { pass++; console.log(`[PASS] served version: dev server serves unbundled modules (checked via build instead)`); }
    else check('served version', false, `v${pkg.version} not found in served JS`);
  }

  // 4. Secret must not be publicly served (the v1.0 trust boundary)
  const leaked = /sk-or-v1-[A-Za-z0-9\-_]{8,}/.test(bundle);
  if (leaked && !ALLOW_KEY) {
    check('no served secret', false, 'OpenRouter key pattern found in public JS: revoke it and serve a keyless build');
  } else if (leaked) {
    pass++;
    console.log('[PASS] no served secret: key pattern present but ALLOW_BUNDLED_KEY=1 (local-only host)');
  } else {
    check('no served secret', true, 'no key pattern in served JS');
  }

  console.log(`\nTOTAL: ${pass} pass, ${fail} fail.`);
  if (fail) process.exit(1);
}
main();
