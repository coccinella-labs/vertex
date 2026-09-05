import { useState, useEffect } from 'react';
import { X, Key, Cpu, Thermometer, MessageSquareText, Check } from 'lucide-react';
import type { Settings } from '@/types';
import { DEFAULT_SYSTEM_PROMPT, HAS_BUILT_IN_KEY, FREE_MESSAGE_LIMIT } from '@/lib/openrouter';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (s: Settings) => void;
}

export function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [local, setLocal] = useState<Settings>(settings);

  useEffect(() => {
    if (open) setLocal(settings);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 dark:bg-ink-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg glass rounded-2xl shadow-2xl animate-fade-up max-h-[90vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200 dark:border-ink-700">
          <div>
            <p className="eyebrow mb-1">Configure</p>
            <h2 className="font-display text-xl uppercase tracking-tight text-ink-900 dark:text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors flex-shrink-0" aria-label="Close settings">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* API Key */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-2">
              <Key className="w-4 h-4 text-lime-500 dark:text-lime-400 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={local.apiKey}
              onChange={(e) => setLocal({ ...local, apiKey: e.target.value })}
              placeholder="sk-or-v1-…"
              className="w-full bg-white dark:bg-ink-950 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            />
            <p className="text-xs text-ink-500 dark:text-ink-500 mt-1.5 font-light">
              Paste your key from{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-lime-600 dark:text-lime-400 hover:underline">
                openrouter.ai/keys
              </a>
              . Stored only in your browser.
            </p>
            {!local.apiKey && (
              <div className="mt-3 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2.5">
                <p className="text-xs text-violet-600 dark:text-violet-300 font-medium">
                  {HAS_BUILT_IN_KEY
                    ? `You get ${FREE_MESSAGE_LIMIT} free messages. Then add your own key to keep chatting.`
                    : 'Add your own key to chat. Keys stay in this browser.'}
                </p>
              </div>
            )}
          </div>

          {/* Model */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-2">
              <Cpu className="w-4 h-4 text-lime-500 dark:text-lime-400 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              Model
            </label>
            <input
              type="text"
              value={local.model}
              onChange={(e) => setLocal({ ...local, model: e.target.value })}
              placeholder="openrouter/auto"
              className="w-full bg-white dark:bg-ink-950 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2.5 text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            />
            <p className="text-xs text-ink-500 dark:text-ink-500 mt-1.5 font-light">
              Use <code className="text-lime-600 dark:text-lime-400">openrouter/auto</code> for automatic model routing, or specify any model ID.
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-2">
              <Thermometer className="w-4 h-4 text-lime-500 dark:text-lime-400 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              Temperature
              <span className="text-ink-400 dark:text-ink-500 font-mono ml-auto normal-case tracking-normal">{local.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={local.temperature}
              onChange={(e) => setLocal({ ...local, temperature: parseFloat(e.target.value) })}
              className="w-full accent-lime-400"
            />
            <div className="flex justify-between text-[0.65rem] uppercase tracking-wider text-ink-400 dark:text-ink-500 mt-1 font-medium">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300 mb-2">
              <MessageSquareText className="w-4 h-4 text-lime-500 dark:text-lime-400 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              System prompt
            </label>
            <textarea
              value={local.systemPrompt}
              onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })}
              rows={4}
              className="w-full bg-white dark:bg-ink-950 border border-ink-200 dark:border-ink-700 rounded-lg px-3 py-2.5 text-sm text-ink-900 dark:text-ink-100 focus:outline-none focus:border-violet-500 transition-colors resize-none scrollbar-thin"
            />
            <button
              onClick={() => setLocal({ ...local, systemPrompt: DEFAULT_SYSTEM_PROMPT })}
              className="text-xs text-lime-600 dark:text-lime-400 hover:underline mt-1.5 font-medium"
            >
              Reset to default
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-200 dark:border-ink-700">
          <button
            onClick={onClose}
            className="text-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white px-4 py-2 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="pill-lime"
          >
            <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
