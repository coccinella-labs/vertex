// VERTEX UI-parity checks: `npm run verify:ui`.
// Every capability a user can touch in the browser gets an automated CLI
// check here: [UI: <surface>] tags map each assertion to its UI counterpart.
// Pure pipelines only (no DOM, no localStorage); the live LLM check is
// opt-in via VERTEX_LIVE_TEST=1 so default runs cost nothing.
import fs from 'node:fs';
import {
  parseGitHubUrl, isGitHubUrl, fetchCodebaseIndex, selectRelevantExcerpts,
} from '@/lib/github';
import { buildSystemPrompt } from '@/lib/prompts';
import {
  fetchWebReadable, extractUrl, isHttpUrl, WEAK_TEXT_THRESHOLD,
} from '@/lib/web';
import { buildInspectionContext } from '@/lib/webinspect';
import {
  repoWorkRun, webWorkRun, planWorkRun,
  activateStep, completeStep, failStep, finishRun, weaken,
} from '@/lib/agent';
import {
  generateTitle, getEffectiveApiKey, HAS_BUILT_IN_KEY,
  FREE_MESSAGE_LIMIT, streamChatCompletion, BUILT_IN_API_KEY,
  buildPayloadMessages, isVisionError,
} from '@/lib/openrouter';
import { CHANGELOG } from '@/lib/changelog';
import type { ChatMode, CodebaseIndex } from '@/types';
import pkg from '../package.json';

let pass = 0;
let fail = 0;
function check(ui: string, name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`[PASS] [UI: ${ui}] ${name}${extra ? ': ' + extra : ''}`); }
  else { fail++; console.log(`[FAIL] [UI: ${ui}] ${name} ${extra}`); }
}

async function main() {
  console.log('VERTEX UI-parity: every browser action, checked from CLI\n');

  // A. Attach repository (AttachBar Analyze + pasting a link in chat)
  check('AttachBar', 'parse full GitHub URL', parseGitHubUrl('https://github.com/facebook/react')?.repo === 'react');
  check('AttachBar', 'parse owner/repo shorthand', parseGitHubUrl('axios/axios')?.owner === 'axios');
  check('AttachBar', 'reject non-repo text', parseGitHubUrl('hello world') === null && !isGitHubUrl('hello world'));

  const tiny = await fetchCodebaseIndex('octocat', 'Hello-World');
  check('AttachBar', 'index shape (tree, branch, files)', tiny.fileCount > 0 && tiny.files.length > 0 && tiny.branch.length > 0, `${tiny.fileCount} files`);

  const axios = await fetchCodebaseIndex('axios', 'axios');
  const fetched = Object.keys(axios.contents);
  const demoShare = fetched.filter((p) => /examples?\/|docs?\/|tests?\/|sandbox\/|readme/i.test(p)).length;
  check('Codebase tab', 'core beats examples (lib/axios.js fetched)', fetched.includes('lib/axios.js'));
  check('Codebase tab', 'core beats examples (lib/core/Axios.js fetched)', fetched.includes('lib/core/Axios.js'));
  check('Codebase tab', 'demo/doc share stays low', demoShare <= 6, `${demoShare}/${fetched.length}`);
  check('Codebase tab', 'entry points detected', axios.entryPoints.includes('index.js'), axios.entryPoints.slice(0, 3).join(', '));
  check('Codebase tab', 'dependencies parsed', axios.dependencyManager === 'npm' && Object.keys(axios.dependencies).length > 0);
  try {
    await fetchCodebaseIndex('no-such-owner-xyz-123', 'no-such-repo-xyz');
    check('AttachBar', 'invalid repo fails honestly', false);
  } catch (e) {
    check('AttachBar', 'invalid repo fails honestly', /public|not found|private/i.test(String((e as Error).message)));
  }

  // B. Ask against the actual source (chat + CodebasePanel starters)
  const ex = selectRelevantExcerpts(axios, 'How do interceptors work?');
  check('Chat', 'excerpt grounds interceptor question', /nterceptor/i.test(ex.slice(0, 600)));
  const q: { basePrompt: string; codebase: CodebaseIndex; web: undefined; userQuestion: string } = {
    basePrompt: '', codebase: axios, web: undefined, userQuestion: 'How do interceptors work?',
  };
  const think = buildSystemPrompt({ ...q, mode: 'think' as ChatMode });
  const plan = buildSystemPrompt({ ...q, mode: 'plan' as ChatMode });
  const chat = buildSystemPrompt({ ...q, mode: 'chat' as ChatMode });
  check('Think mode', 'structured sections injected', think.includes('**Recommendation**') && think.includes('**Next action**'));
  check('Plan mode', 'plan shape injected', plan.includes('**Plan**') && plan.includes('Tests'));
  check('Chat mode', 'no format imposed', !think.includes('**Recommendation**') || !chat.includes('**Recommendation**'));
  check('Chat', 'file paths must be backticked', think.includes('backticks'));

  // C. Web attach + inspect (Web tab)
  check('AttachBar', 'reject non-URL text', extractUrl('just some words') === null && !isHttpUrl('just some words'));
  const web = await fetchWebReadable('https://example.com/');
  check('Web tab', 'fetch returns inspection', !!web.inspection && (web.inspection?.htmlSize ?? 0) > 100);
  check('Web tab', 'inspection context renders', buildInspectionContext('https://example.com/', web.inspection!).includes('Assets:'));
  const thin = await fetchWebReadable('https://webglsamples.org/blob/blob.html');
  check('Web tab', 'thin page kept, flagged weak', !!thin.inspection && thin.readableText.length < WEAK_TEXT_THRESHOLD, `${thin.readableText.length} chars`);

  // D. WorkLog timeline (chat history)
  let run = activateStep(repoWorkRun('a/b'), 'open', 'github.com/a/b');
  run = completeStep(run, 'open', '2 files');
  check('WorkLog', 'step activation/completion', run.steps.some((s) => s.status === 'done' && s.detail === '2 files'));
  const doneRun = { ...run, steps: run.steps.map((s) => ({ ...s, status: 'done' as const })) };
  const weak = finishRun(weaken(doneRun), 'Limited page evidence · 301 readable chars');
  check('WorkLog', 'weak-evidence flag + summary', weak.steps.some((s) => s.weak) && (weak.summary ?? '').startsWith('Limited'));
  const errRun = finishRun(failStep(planWorkRun(), 'goal', 'boom'), undefined, 'error');
  check('WorkLog', 'error run state', errRun.status === 'error');
  check('ModeSelector', 'plan run template', planWorkRun().steps.length === 4 && webWorkRun('https://x.com/').steps.length === 7);

  // E. Evidence data (badges + CodeViewer decisions)
  check('CodeViewer', 'badge data present', fetched.includes('lib/axios.js') && axios.files.some((f) => f.path === 'lib/axios.js'));
  check('CodeViewer', 'unfetched path detectable', !('lib/never-fetched-xyz.ts' in axios.contents));

  // F. Version + changelog (header + panel)
  check('Header', 'package.json version is semver 0.x', /^0\.\d+\.\d+$/.test((pkg as { version: string }).version));
  check('Changelog', 'panel mirrors package.json', CHANGELOG[0].version === (pkg as { version: string }).version);
  check('Changelog', 'no fabricated dates', CHANGELOG.every((e) => !('date' in e)));

  // G. Free-tier gating (chat send gate + Settings copy)
  check('Settings', 'key precedence', getEffectiveApiKey('user-k') === 'user-k' && getEffectiveApiKey('') === BUILT_IN_API_KEY);
  check('Settings', 'free limit matches built-in key', HAS_BUILT_IN_KEY === (BUILT_IN_API_KEY.length > 0) && (HAS_BUILT_IN_KEY ? FREE_MESSAGE_LIMIT === 2 : FREE_MESSAGE_LIMIT === 0));
  check('Chat', 'title generation', generateTitle('  hello   world  ') === 'hello world');

  // G2. Image input (composer attach + multimodal payload, no auto-switch)
  const textOnly = buildPayloadMessages(
    [{ id: '1', role: 'user', content: 'hi', createdAt: 0 }], 'sys');
  check('Chat', 'text-only payload keeps string shape',
    textOnly[1].content === 'hi' && textOnly[0].role === 'system');
  const multi = buildPayloadMessages(
    [{ id: '1', role: 'user', content: 'see this', createdAt: 0, images: ['data:image/jpeg;base64,AAA'] }], 'sys');
  const parts = multi[1].content;
  check('Chat', 'image payload uses content parts',
    Array.isArray(parts) && parts.length === 2 &&
    parts[0].type === 'text' && (parts[0] as { text: string }).text === 'see this' &&
    parts[1].type === 'image_url');
  check('Chat', 'vision error detected',
    isVisionError('This model does not support image input.') && !isVisionError('Request failed (429)'));
  // H. Live LLM (opt-in: VERTEX_LIVE_TEST=1: spends one tiny completion)
  if (process.env.VERTEX_LIVE_TEST === '1') {
    const raw = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
    const liveKey = (raw.match(/^VITE_OPENROUTER_API_KEY\s*=\s*(.*)\s*$/m)?.[1] ?? '').trim();
    try {
      await streamChatCompletion({
        apiKey: 'bad-key', model: 'openrouter/auto',
        messages: [{ id: '1', role: 'user', content: 'hi', createdAt: 0 }],
        temperature: 0, systemPrompt: 'x', signal: new AbortController().signal, onToken: () => {},
      });
      check('Chat', 'bad key fails cleanly', false);
    } catch (e) {
      check('Chat', 'bad key fails cleanly', /401|auth|unauthorized|invalid|key/i.test(String((e as Error).message)));
    }
    if (liveKey) {
      const ctrl = new AbortController();
      let streamed = '';
      try {
        await streamChatCompletion({
          apiKey: liveKey, model: 'openrouter/auto',
          messages: [{ id: '1', role: 'user', content: 'Reply with exactly: vertex-alive', createdAt: 0 }],
          temperature: 0, systemPrompt: 'Be literal.', signal: ctrl.signal,
          onToken: (t) => { streamed += t; if (streamed.length > 60) ctrl.abort(); },
        });
      } catch { /* abort-after-tokens expected */ }
      check('Chat', 'live stream end-to-end', streamed.includes('vertex-alive'), JSON.stringify(streamed.slice(0, 40)));
    } else {
      console.log('[SKIP] [UI: Chat] live stream: no key in .env');
    }
  } else {
    console.log('[SKIP] [UI: Chat] live LLM checks: set VERTEX_LIVE_TEST=1 to include (spends one tiny completion)');
  }

  console.log(`\nTOTAL: ${pass} pass, ${fail} fail.`);
  if (fail) process.exit(1);
}
main();
