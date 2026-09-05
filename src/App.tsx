import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Settings, Sun, Moon, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import type { Conversation, ChatMessage, Settings as SettingsType, Theme, ChatMode, WorkRun } from '@/types';
import type { WorkspaceTab } from '@/components/WorkspaceTabs';
import { streamChatCompletion, generateTitle, DEFAULT_SETTINGS, getEffectiveApiKey, FREE_MESSAGE_LIMIT, isVisionError } from '@/lib/openrouter';
import {
  loadConversations, saveConversations,
  loadSettings, saveSettings,
  loadTheme, saveTheme,
  uid,
} from '@/lib/storage';
import { parseGitHubUrl, fetchCodebaseIndex, isGitHubUrl } from '@/lib/github';
import { extractUrl, fetchWebReadable, isHttpUrl, WEAK_TEXT_THRESHOLD } from '@/lib/web';
import { buildSystemPrompt } from '@/lib/prompts';
import {
  repoWorkRun, webWorkRun, planWorkRun,
  activateStep, completeStep, failStep, finishRun, weaken,
} from '@/lib/agent';
import { WorkLog } from '@/components/WorkLog';
import { CodeViewer } from '@/components/CodeViewer';
import { ChangelogPanel } from '@/components/ChangelogPanel';
import { Sidebar } from '@/components/Sidebar';
import { MessageBubble } from '@/components/MessageBubble';
import { ChatInput } from '@/components/ChatInput';
import { SettingsModal } from '@/components/SettingsModal';
import { EmptyState } from '@/components/EmptyState';
import { WorkspaceTabs } from '@/components/WorkspaceTabs';
import { ModeSelector } from '@/components/ModeSelector';
import { AttachBar } from '@/components/AttachBar';
import { CodebasePanel } from '@/components/CodebasePanel';
import { WebPanel } from '@/components/WebPanel';
import { NotesPanel } from '@/components/NotesPanel';

export default function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('chat');
  const [pendingMode, setPendingMode] = useState<ChatMode>('chat');
  /** Currently-running observable work (repo / web / plan). Attached to the assistant message when done. */
  const [activeWork, setActiveWork] = useState<WorkRun | null>(null);
  /** Path open in the code viewer (Answer → evidence → source). */
  const [viewerPath, setViewerPath] = useState<string | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [freeMessagesUsed, setFreeMessagesUsed] = useState(() => {
    const stored = localStorage.getItem('vertex:freeMessagesUsed');
    return stored ? parseInt(stored, 10) : 0;
  });

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = loadTheme();
    setTheme(t);
    setConversations(loadConversations());
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('vertex:freeMessagesUsed', String(freeMessagesUsed));
  }, [freeMessagesUsed]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const activeMode: ChatMode = activeConversation?.mode ?? pendingMode;
  const knownFiles = activeConversation?.codebase?.index
    ? new Set([
        ...activeConversation.codebase.index.files.map((f) => f.path),
        ...activeConversation.codebase.index.importantFiles,
        ...Object.keys(activeConversation.codebase.index.contents),
      ])
    : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el && workspaceTab === 'chat') el.scrollTop = el.scrollHeight;
  }, [activeConversation?.messages, workspaceTab, activeWork]);

  // Reset tab when switching conversations
  useEffect(() => {
    setWorkspaceTab('chat');
    setViewerPath(null);
  }, [activeId]);

  const newConversation = useCallback(() => {
    setActiveId(null);
    setInput('');
    setPendingImages([]);
    setError(null);
    setSidebarOpen(false);
    setWorkspaceTab('chat');
    setActiveWork(null);
    setViewerPath(null);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
    setPendingImages([]);
    setSidebarOpen(false);
    setWorkspaceTab('chat');
    setActiveWork(null);
    setViewerPath(null);
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  const updateConversation = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  const setMode = useCallback((mode: ChatMode) => {
    if (activeId) {
      updateConversation(activeId, (c) => ({ ...c, mode, updatedAt: c.updatedAt }));
    } else {
      setPendingMode(mode);
    }
  }, [activeId, updateConversation]);

  const ensureConversation = useCallback((firstMessageTitle?: string): string => {
    // Returns a conversation id, creating one if needed (for attachments without messages yet)
    if (activeId) return activeId;
    const id = uid();
    const now = Date.now();
    const conv: Conversation = {
      id,
      title: firstMessageTitle ? generateTitle(firstMessageTitle) : 'Codebase workspace',
      messages: [],
      createdAt: now,
      updatedAt: now,
      mode: pendingMode,
      notes: '',
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    return id;
  }, [activeId, pendingMode]);

  const attachRepo = useCallback(async (rawUrl: string, targetId?: string) => {
    const parsed = parseGitHubUrl(rawUrl);
    if (!parsed) {
      setError('Not a GitHub link. Try owner/repo.');
      return;
    }
    const convId = targetId ?? ensureConversation(`${parsed.owner}/${parsed.repo}`);
    const label = `${parsed.owner}/${parsed.repo}`;
    const run = activateStep(repoWorkRun(label), 'open', `github.com/${label}`);
    setActiveWork(run);
    updateConversation(convId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? label : c.title,
      codebase: { url: `https://github.com/${label}`, owner: parsed.owner, repo: parsed.repo, status: 'loading' },
      updatedAt: Date.now(),
    }));
    setWorkspaceTab('codebase');
    const onStage = (stage: string, detail?: string) => {
      setActiveWork((prev) => {
        if (!prev) return prev;
        let next = prev;
        if (stage === 'open') next = activateStep(next, 'open', detail);
        else if (stage === 'tree') next = activateStep(completeStep(next, 'open', detail), 'tree', detail);
        else if (stage === 'files') next = activateStep(completeStep(next, 'tree', detail), 'files', detail);
        else if (stage === 'entry') next = activateStep(completeStep(next, 'files', detail), 'entry', detail);
        else if (stage === 'deps') next = activateStep(completeStep(next, 'entry', detail), 'deps', detail);
        else if (stage === 'answer') next = activateStep(completeStep(next, 'deps', detail), 'answer', detail);
        return next;
      });
    };
    try {
      const index = await fetchCodebaseIndex(parsed.owner, parsed.repo, { onStage });
      const summary = `${index.fileCount} files examined · ${Object.keys(index.contents).length} relevant files`;
      setActiveWork((prev) => (prev ? finishRun(prev, summary) : prev));
      const finished = await new Promise<WorkRun | null>((resolve) => {
        // let the UI paint the completed state briefly; capture latest run
        setTimeout(() => {
          let captured: WorkRun | null = null;
          setActiveWork((prev) => {
            captured = prev ? finishRun(prev, summary) : prev;
            return null;
          });
          resolve(captured);
        }, 600);
      });
      void finished;
      updateConversation(convId, (c) => ({
        ...c,
        title: c.messages.length === 0 ? label : c.title,
        codebase: { url: index.repoUrl, owner: parsed.owner, repo: parsed.repo, status: 'ready', index },
        updatedAt: Date.now(),
      }));
      // Post a summary assistant message so the work log lives in chat history too
      const summaryMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content:
          `Indexed **${label}**: ${summary}.\n\n` +
          `Entry points: ${index.entryPoints.slice(0, 5).join(', ') || 'none'}`,
        createdAt: Date.now(),
      };
      updateConversation(convId, (c) => ({ ...c, messages: [...c.messages, summaryMsg], updatedAt: Date.now() }));
      setWorkspaceTab('chat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed';
      setActiveWork((prev) => (prev ? finishRun(failStep(prev, 'tree', msg), undefined, 'error') : prev));
      setTimeout(() => setActiveWork(null), 1200);
      updateConversation(convId, (c) => ({
        ...c,
        codebase: {
          url: `https://github.com/${label}`,
          owner: parsed.owner, repo: parsed.repo, status: 'error',
          error: msg,
        },
        updatedAt: Date.now(),
      }));
    }
  }, [ensureConversation, updateConversation]);

  const attachWeb = useCallback(async (rawUrl: string, targetId?: string) => {
    const url = extractUrl(rawUrl);
    if (!url || !isHttpUrl(url)) {
      setError('Not a website URL. Try https://example.com.');
      return;
    }
    const convId = targetId ?? ensureConversation(url);
    const run = activateStep(webWorkRun(url), 'open', url);
    setActiveWork(run);
    updateConversation(convId, (c) => ({
      ...c,
      web: { url, status: 'loading' },
      updatedAt: Date.now(),
    }));
    setWorkspaceTab('web');
    const onStage = (stage: string, detail?: string) => {
      setActiveWork((prev) => {
        if (!prev) return prev;
        let next = prev;
        if (stage === 'open') next = activateStep(next, 'open', detail);
        else if (stage === 'structure') next = activateStep(completeStep(next, 'open', 'page opened'), 'structure', detail);
        else if (stage === 'nav') next = activateStep(completeStep(next, 'structure', detail), 'nav', detail);
        else if (stage === 'visual') next = activateStep(completeStep(next, 'nav', detail), 'visual', detail);
        else if (stage === 'layout') next = activateStep(completeStep(next, 'visual', detail), 'layout', detail);
        else if (stage === 'responsive') next = activateStep(completeStep(next, 'layout', detail), 'responsive', detail);
        else if (stage === 'components') next = activateStep(completeStep(next, 'responsive', detail), 'components', detail);
        else if (stage === 'answer') next = completeStep(next, 'components', detail);
        return next;
      });
    };
    try {
      const result = await fetchWebReadable(url, undefined, onStage);
      const comps = result.inspection?.suggestedComponents.slice(0, 3).join(', ') ?? '';
      const thin = result.readableText.length < WEAK_TEXT_THRESHOLD;
      const summary = thin
        ? `Limited page evidence · ${result.readableText.length} readable chars`
        : `${result.title ?? 'Page'} · ${result.readableText.length} chars${comps ? ` · ${comps}` : ''}`;
      setActiveWork((prev) => (prev ? finishRun(thin ? weaken(prev) : prev, summary) : prev));
      setTimeout(() => setActiveWork(null), 600);
      updateConversation(convId, (c) => ({
        ...c,
        web: { url, status: 'ready', title: result.title, readableText: result.readableText, fetchedAt: Date.now(), inspection: result.inspection },
        updatedAt: Date.now(),
      }));
      const summaryMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: result.readableText.length < WEAK_TEXT_THRESHOLD
          ? `Inspected **${result.title ?? url}**: little text (${result.readableText.length} chars), structure captured. See the Web tab.`
          : `Inspected **${result.title ?? url}**: ${result.readableText.length} chars, ${result.inspection ? `${result.inspection.navLinks.length} nav links, ${result.inspection.sectionCount} sections` : 'no structure'}. See the Web tab.`,
        createdAt: Date.now(),
      };
      updateConversation(convId, (c) => ({ ...c, messages: [...c.messages, summaryMsg], updatedAt: Date.now() }));
      setWorkspaceTab('chat');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'fetch failed';
      setActiveWork((prev) => (prev ? finishRun(failStep(prev, 'open', msg), undefined, 'error') : prev));
      setTimeout(() => setActiveWork(null), 1200);
      updateConversation(convId, (c) => ({
        ...c,
        web: { url, status: 'error', error: msg },
        updatedAt: Date.now(),
      }));
    }
  }, [ensureConversation, updateConversation]);

  const handleSend = useCallback(async (text: string) => {
    const content = text.trim();
    if ((!content && pendingImages.length === 0) || streaming) return;

    const usingFreeKey = !settings.apiKey;
    const effectiveKey = getEffectiveApiKey(settings.apiKey);
    if (!effectiveKey) {
      setSettingsOpen(true);
      setError('Add your OpenRouter key in Settings to continue. Keys stay in this browser.');
      return;
    }
    if (usingFreeKey && freeMessagesUsed >= FREE_MESSAGE_LIMIT) {
      setSettingsOpen(true);
      setError(`Free messages used up. Add your OpenRouter key to continue.`);
      return;
    }

    setError(null);
    setInput('');
    setPendingImages([]);
    setWorkspaceTab('chat');

    // Paste → Understand: auto-attach GitHub / website links found in the message
    let convId = activeId;
    let codebaseForPrompt = convId ? conversations.find((c) => c.id === convId)?.codebase?.index : undefined;
    let webForPrompt = convId ? conversations.find((c) => c.id === convId)?.web : undefined;
    const mode: ChatMode = (convId ? conversations.find((c) => c.id === convId)?.mode : undefined) ?? pendingMode;

    // Create the user message up front so the empty state clears the
    // instant Enter is pressed, even while indexing fetches run below.
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
      createdAt: Date.now(),
      ...(pendingImages.length > 0 ? { images: pendingImages } : {}),
    };

    if (!convId) {
      convId = uid();
      const newConv: Conversation = {
        id: convId,
        title: generateTitle(content || 'Shared an image'),
        messages: [userMsg],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mode: pendingMode,
        notes: '',
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(convId);
    }

    const sendId = convId;
    const githubDetected = isGitHubUrl(content);
    const webDetected = !githubDetected && !!extractUrl(content) && isHttpUrl(extractUrl(content)!);

    // --- Visible work: create the run up front (observable work only, no private CoT) ---
    const holder: { run: WorkRun | null; kind: WorkRun['kind'] | null } = { run: null, kind: null };
    const pushRun = (next: WorkRun | null) => {
      holder.run = next;
      if (next) holder.kind = next.kind;
      setActiveWork(next);
    };
    if (githubDetected) {
      const parsed0 = parseGitHubUrl(content);
      pushRun(activateStep(repoWorkRun(parsed0 ? `${parsed0.owner}/${parsed0.repo}` : 'repository'), 'tree', 'starting'));
    } else if (webDetected) {
      pushRun(activateStep(webWorkRun(extractUrl(content)!), 'open', extractUrl(content)!));
    } else if (mode === 'plan') {
      pushRun(activateStep(planWorkRun(), 'goal', content.slice(0, 80)));
    }
    const bump = (fn: (r: WorkRun) => WorkRun) => {
      if (holder.run) pushRun(fn(holder.run));
    };

    // Fire-and-await lightweight attach so the *current* answer already has context.
    if (githubDetected) {
      const parsed = parseGitHubUrl(content);
      const existing = conversations.find((c) => c.id === sendId)?.codebase;
      if (parsed && (!existing || `${existing.owner}/${existing.repo}` !== `${parsed.owner}/${parsed.repo}` || existing.status !== 'ready')) {
        updateConversation(sendId, (c) => ({
          ...c,
          codebase: { url: content.slice(0, 200), owner: parsed.owner, repo: parsed.repo, status: 'loading' },
          updatedAt: Date.now(),
        }));
        const onStage = (stage: string, detail?: string) => {
          if (!holder.run) return;
          if (stage === 'open') bump((r) => activateStep(r, 'open', detail));
          else if (stage === 'tree') bump((r) => activateStep(completeStep(r, 'open', detail), 'tree', detail));
          else if (stage === 'files') bump((r) => activateStep(completeStep(r, 'tree', detail), 'files', detail));
          else if (stage === 'entry') bump((r) => activateStep(completeStep(r, 'files', detail), 'entry', detail));
          else if (stage === 'deps') bump((r) => activateStep(completeStep(r, 'entry', detail), 'deps', detail));
          else if (stage === 'answer') bump((r) => activateStep(completeStep(r, 'deps', detail), 'answer', detail));
        };
        try {
          const index = await fetchCodebaseIndex(parsed.owner, parsed.repo, { onStage });
          codebaseForPrompt = index;
          updateConversation(sendId, (c) => ({
            ...c, codebase: { url: index.repoUrl, owner: parsed.owner, repo: parsed.repo, status: 'ready', index },
            updatedAt: Date.now(),
          }));
          if (holder.run) {
            const summary = `${index.fileCount} files examined · ${Object.keys(index.contents).length} relevant files`;
            pushRun(finishRun(holder.run, summary));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'fetch failed';
          if (holder.run) pushRun(finishRun(failStep(holder.run, 'open', msg), undefined, 'error'));
          updateConversation(sendId, (c) => ({
            ...c,
            codebase: { url: content.slice(0, 200), owner: parsed.owner, repo: parsed.repo, status: 'error', error: msg },
            updatedAt: Date.now(),
          }));
        }
      } else if (existing?.index) {
        codebaseForPrompt = existing.index;
        if (holder.run && existing.index) {
          pushRun(finishRun(holder.run, `${existing.index.fileCount} files examined · cached`));
        }
      }
    } else {
      const existing = conversations.find((c) => c.id === sendId)?.codebase?.index;
      if (existing) codebaseForPrompt = existing;
    }

    const maybeUrl = extractUrl(content);
    if (maybeUrl && isHttpUrl(maybeUrl) && !isGitHubUrl(maybeUrl)) {
      const existing = conversations.find((c) => c.id === sendId)?.web;
      if (!existing || (existing.url !== maybeUrl && existing.status !== 'loading')) {
        updateConversation(sendId, (c) => ({ ...c, web: { url: maybeUrl, status: 'loading' }, updatedAt: Date.now() }));
        const onStage = (stage: string, detail?: string) => {
          if (!holder.run || holder.kind !== 'web') return;
          if (stage === 'open') bump((r) => activateStep(r, 'open', detail));
          else if (stage === 'structure') bump((r) => activateStep(completeStep(r, 'open', 'page opened'), 'structure', detail));
          else if (stage === 'nav') bump((r) => activateStep(completeStep(r, 'structure', detail), 'nav', detail));
          else if (stage === 'visual') bump((r) => activateStep(completeStep(r, 'nav', detail), 'visual', detail));
          else if (stage === 'layout') bump((r) => activateStep(completeStep(r, 'visual', detail), 'layout', detail));
          else if (stage === 'responsive') bump((r) => activateStep(completeStep(r, 'layout', detail), 'responsive', detail));
          else if (stage === 'components') bump((r) => activateStep(completeStep(r, 'responsive', detail), 'components', detail));
          else if (stage === 'answer') bump((r) => completeStep(r, 'components', detail));
        };
        try {
          const result = await fetchWebReadable(maybeUrl, undefined, onStage);
          webForPrompt = { url: maybeUrl, status: 'ready', title: result.title, readableText: result.readableText, fetchedAt: Date.now(), inspection: result.inspection };
          updateConversation(sendId, (c) => ({ ...c, web: webForPrompt, updatedAt: Date.now() }));
          if (holder.run) {
            const thin = result.readableText.length < WEAK_TEXT_THRESHOLD;
            const summary = thin
              ? `Limited page evidence · ${result.readableText.length} readable chars`
              : `${result.title ?? 'Page'} · ${result.readableText.length} chars read`;
            pushRun(finishRun(thin ? weaken(holder.run) : holder.run, summary));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'fetch failed';
          webForPrompt = { url: maybeUrl, status: 'error', error: msg };
          updateConversation(sendId, (c) => ({ ...c, web: webForPrompt, updatedAt: Date.now() }));
          if (holder.run) pushRun(finishRun(failStep(holder.run, 'open', msg), undefined, 'error'));
        }
      } else if (existing) {
        webForPrompt = existing;
        if (holder.run) pushRun(finishRun(holder.run, 'Page context reused from cache'));
      }
    } else {
      const existing = conversations.find((c) => c.id === sendId)?.web;
      if (existing) webForPrompt = existing;
    }

    // Plan-mode visible progress for the reasoning phase (prompt assembly, not private CoT)
    if (holder.kind === 'plan' && holder.run) {
      bump((r) => activateStep(completeStep(r, 'goal', 'goal captured'), 'arch', codebaseForPrompt ? `${codebaseForPrompt.owner}/${codebaseForPrompt.repo}` : 'no codebase attached'));
      await new Promise((res) => setTimeout(res, 250));
      bump((r) => activateStep(completeStep(r, 'arch', codebaseForPrompt ? 'architecture checked' : 'general guidance'), 'files'));
      await new Promise((res) => setTimeout(res, 250));
      bump((r) => activateStep(completeStep(r, 'files', 'affected files identified'), 'plan', 'streaming answer'));
    }

    const systemPrompt = buildSystemPrompt({
      basePrompt: settings.systemPrompt,
      mode,
      codebase: codebaseForPrompt,
      web: webForPrompt,
      userQuestion: content,
    });

    const assistantId = uid();
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() };

    const existing = conversations.find((c) => c.id === sendId);
    // conversations state may be stale after awaits; use functional updates.
    // userMsg was already seeded at creation, so dedupe by id, never by content.
    const isNonEmpty = (m: ChatMessage) => m.content !== '' || (m.images?.length ?? 0) > 0;
    const withoutOurs = (msgs: ChatMessage[]) => msgs.filter((m) => m.id !== userMsg.id);
    let messagesForApi: ChatMessage[] = [];
    if (!existing || withoutOurs(existing.messages).length === 0) {
      messagesForApi = [userMsg];
    } else {
      messagesForApi = [...withoutOurs(existing.messages).filter(isNonEmpty), userMsg].slice(-20);
    }
    updateConversation(sendId, (c) => ({
      ...c,
      title: c.messages.length === 0 && c.title === 'Codebase workspace' ? generateTitle(content || 'Shared an image') : c.title,
      messages: [...withoutOurs(c.messages).filter((m) => m.role !== 'assistant' || m.content !== ''), userMsg, assistantMsg],
      updatedAt: Date.now(),
    }));

    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatCompletion({
        apiKey: getEffectiveApiKey(settings.apiKey),
        model: settings.model,
        messages: messagesForApi,
        temperature: settings.temperature,
        systemPrompt,
        signal: controller.signal,
        onToken: (token) => {
          updateConversation(sendId!, (c) => ({
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + token } : m
            ),
          }));
        },
      });
    } catch (err) {
      if (controller.signal.aborted) {
        // user stopped: keep partial content
        setActiveWork((latest) => (latest ? finishRun(latest, 'Stopped by user', 'done') : latest));
      } else {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        if (isVisionError(msg)) {
          setError('This model cannot read images. Switch to a vision-capable model in Settings (e.g. openai/gpt-4o) to continue with images.');
          setSettingsOpen(true);
        } else {
          setError(msg);
        }
        setActiveWork((latest) =>
          latest ? finishRun(failStep(latest, latest.steps.find((s) => s.status === 'active')?.id ?? 'plan', msg), undefined, 'error') : latest
        );
        updateConversation(sendId!, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || '*The response could not be completed.*' }
              : m
          ),
        }));
      }
    } finally {
      // Persist the finished work log on the assistant message (history), clear live banner.
      // Read latest from state: the holder may be stale after async bumps.
      setActiveWork((latest) => {
        const toAttach = latest;
        if (toAttach) {
          const done = toAttach.status === 'running' ? finishRun(toAttach, toAttach.summary) : toAttach;
          updateConversation(sendId!, (c) => ({
            ...c,
            messages: c.messages.map((m) => (m.id === assistantId ? { ...m, work: done } : m)),
          }));
        }
        return null;
      });
      setStreaming(false);
      abortRef.current = null;
      if (usingFreeKey) {
        setFreeMessagesUsed((n) => n + 1);
      }
    }
  }, [activeId, conversations, streaming, settings, updateConversation, freeMessagesUsed, pendingMode, pendingImages]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const askFromPanel = useCallback((q: string) => {
    setWorkspaceTab('chat');
    handleSend(q);
  }, [handleSend]);

  return (
    <div className="h-dvh flex bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-ink-100 overflow-hidden bg-grid">
      {/* Sidebar: desktop */}
      <div
        className={`hidden md:flex flex-shrink-0 transition-all duration-300 overflow-hidden ${
          sidebarCollapsed ? 'w-0' : 'w-64'
        }`}
      >
        <div className="w-64 h-full">
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            onNew={newConversation}
            onDelete={deleteConversation}
            onClose={() => setSidebarCollapsed(false)}
          />
        </div>
      </div>

      {/* Sidebar: mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink-950/40 dark:bg-ink-950/70 backdrop-blur-sm animate-fade-in" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 h-full animate-fade-in">
            <Sidebar
              conversations={conversations}
              activeId={activeId}
              onSelect={selectConversation}
              onNew={newConversation}
              onDelete={deleteConversation}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-4 border-b border-ink-200 dark:border-ink-700 bg-white/60 dark:bg-ink-900/60 backdrop-blur-md flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors flex-shrink-0"
            >
              <Menu className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            </button>
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors flex-shrink-0"
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-pressed={!sidebarCollapsed}
            >
              {sidebarCollapsed
                ? <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
                : <PanelLeftClose className="w-4 h-4" aria-hidden="true" />}
            </button>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500 dark:text-ink-300 truncate ml-2">
              {activeConversation?.title ?? 'New workspace'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ModeSelector mode={activeMode} onChange={setMode} />
            <button
              onClick={() => setChangelogOpen(true)}
              className="px-2 py-1 font-mono text-[0.65rem] text-ink-400 dark:text-ink-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors"
              title="VERTEX changelog"
            >
              v{__APP_VERSION__}
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-9 h-9 flex items-center justify-center text-ink-500 dark:text-ink-400 hover:text-lime-500 dark:hover:text-lime-400 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg transition-colors"
              title="Toggle mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 flex items-center justify-center text-ink-500 dark:text-ink-400 hover:text-lime-500 dark:hover:text-lime-400 hover:bg-ink-100 dark:hover:bg-ink-800 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Workspace tabs + attach: only once a conversation exists.
            The empty state is the starting point; chrome reveals with work. */}
        {activeConversation && activeConversation.messages.length > 0 && (
          <>
            <AttachBar
              codebase={activeConversation?.codebase}
              web={activeConversation?.web}
              onAttachRepo={(u) => attachRepo(u, activeId ?? undefined)}
              onAttachWeb={(u) => attachWeb(u, activeId ?? undefined)}
              onClearCodebase={() => activeId && updateConversation(activeId, (c) => ({ ...c, codebase: undefined, updatedAt: Date.now() }))}
              onClearWeb={() => activeId && updateConversation(activeId, (c) => ({ ...c, web: undefined, updatedAt: Date.now() }))}
              disabled={streaming}
            />
            <WorkspaceTabs
              tab={workspaceTab}
              onChange={setWorkspaceTab}
              hasCodebase={!!activeConversation?.codebase}
              hasWeb={!!activeConversation?.web}
            />
          </>
        )}

        {/* Content */}
        {workspaceTab === 'codebase' ? (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <CodebasePanel codebase={activeConversation?.codebase} onAsk={askFromPanel} onOpenFile={setViewerPath} />
          </div>
        ) : workspaceTab === 'web' ? (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <WebPanel web={activeConversation?.web} onAsk={askFromPanel} />
          </div>
        ) : workspaceTab === 'notes' ? (
          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
            <NotesPanel
              notes={activeConversation?.notes ?? ''}
              onChange={(v) => activeId && updateConversation(activeId, (c) => ({ ...c, notes: v, updatedAt: Date.now() }))}
            />
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <>
                {activeWork && (
                  <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 w-full">
                    <WorkLog run={activeWork} />
                  </div>
                )}
                <EmptyState onSuggestion={(text) => { setInput(text); handleSend(text); }} />
              </>
            ) : (
              <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6 w-full">
                {activeConversation.messages
                  .filter((m) => m.role !== 'assistant' || m.content !== '' || m.work)
                  .map((m, i, arr) => (
                    <div key={m.id} className="space-y-3">
                      {m.role === 'assistant' && m.work && (
                        <WorkLog run={m.work} defaultOpen={false} />
                      )}
                      {(m.content !== '' || m.role === 'user') && (
                        <MessageBubble
                          message={m}
                          streaming={streaming && i === arr.length - 1 && m.role === 'assistant'}
                          knownFiles={knownFiles}
                          onOpenFile={setViewerPath}
                        />
                      )}
                    </div>
                  ))}
                {/* Live work while streaming / fetching */}
                {activeWork && (
                  <WorkLog run={activeWork} />
                )}
                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400 glass rounded-lg px-4 py-3 border-red-400/40">
                    {error}
                  </div>
                )}
              </div>
            )}
            {(!activeConversation || activeConversation.messages.length === 0) && error && (
              <div className="max-w-3xl mx-auto px-4 md:px-6 pb-4 w-full">
                <div className="text-sm text-red-600 dark:text-red-400 glass rounded-lg px-4 py-3 border-red-400/40">
                  {error}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        {workspaceTab === 'chat' && (
          <div className="flex-shrink-0">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={() => handleSend(input)}
              onStop={handleStop}
              streaming={streaming}
              disabled={false}
              images={pendingImages}
              onImagesChange={setPendingImages}
              onError={setError}
            />
          </div>
        )}
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={setSettings}
      />

      {viewerPath && (
        <CodeViewer
          path={viewerPath}
          index={activeConversation?.codebase?.index}
          onClose={() => setViewerPath(null)}
          onAsk={askFromPanel}
        />
      )}

      <ChangelogPanel open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </div>
  );
}
