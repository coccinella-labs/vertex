import { useEffect } from 'react';
import { X } from 'lucide-react';
import { CHANGELOG } from '@/lib/changelog';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ChangelogPanel({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="VERTEX changelog">
      <div className="absolute inset-0 bg-ink-950/40 dark:bg-ink-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col glass rounded-2xl shadow-2xl animate-fade-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200 dark:border-ink-700">
          <div>
            <p className="eyebrow mb-1">VERTEX Changelog</p>
            <h2 className="font-display text-xl uppercase tracking-tight text-ink-900 dark:text-white">v{__APP_VERSION__}</h2>
          </div>
          <button onClick={onClose} className="text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors flex-shrink-0" aria-label="Close changelog">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5 space-y-7">
          {CHANGELOG.map((entry) => (
            <section key={entry.version}>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-900 dark:text-white mb-2">
                v{entry.version} · {entry.title}
              </p>
              {entry.added && (
                <div className="mb-1.5">
                  <p className="eyebrow mb-1">Added</p>
                  <ul className="text-sm font-light space-y-0.5 list-disc list-inside text-ink-600 dark:text-ink-300">
                    {entry.added.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.changed && (
                <div className="mb-1.5">
                  <p className="eyebrow mb-1">Changed</p>
                  <ul className="text-sm font-light space-y-0.5 list-disc list-inside text-ink-600 dark:text-ink-300">
                    {entry.changed.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.fixed && (
                <div className="mb-1.5">
                  <p className="eyebrow mb-1">Fixed</p>
                  <ul className="text-sm font-light space-y-0.5 list-disc list-inside text-ink-600 dark:text-ink-300">
                    {entry.fixed.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.limits && (
                <div>
                  <p className="eyebrow mb-1">Limits</p>
                  <ul className="text-sm font-light space-y-0.5 list-disc list-inside text-ink-500 dark:text-ink-400">
                    {entry.limits.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
