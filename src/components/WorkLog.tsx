import { useState, useEffect } from 'react';
import { Check, Loader2, X, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import type { WorkRun } from '@/types';

interface Props {
  run: WorkRun;
  /** When collapsed, only title + summary show. Defaults: expanded while running, collapsed when done. */
  defaultOpen?: boolean;
}

export function WorkLog({ run, defaultOpen }: Props) {
  const [open, setOpen] = useState(defaultOpen ?? run.status === 'running');

  // UX rule: expanded while running, auto-collapse on completion. User can re-expand.
  useEffect(() => {
    if (run.status !== 'running') setOpen((prev) => (defaultOpen !== undefined ? prev : false));
    else setOpen((prev) => (defaultOpen !== undefined ? prev : true));
  }, [run.status, defaultOpen]);
  const done = run.status === 'done';
  const failed = run.status === 'error';
  const weak = done && run.steps.some((s) => s.weak);

  return (
    <div className="glass rounded-xl overflow-hidden text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors"
        aria-expanded={open}
      >
        {run.status === 'running' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500 flex-shrink-0" aria-hidden="true" />
        ) : done && weak ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
        ) : done ? (
          <Check className="w-3.5 h-3.5 text-lime-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
        ) : (
          <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
        )}
        <span className="flex-1 truncate text-xs font-bold uppercase tracking-[0.12em] text-ink-600 dark:text-ink-300">
          {run.title}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-0.5 space-y-1.5 animate-fade-in">
          {run.steps.map((s) => (
            <div key={s.id} className="flex items-start gap-2 text-[0.8rem] leading-5">
              <span className="w-4 flex-shrink-0 flex justify-center pt-0.5">
                {s.status === 'done' && s.weak ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                ) : s.status === 'done' ? (
                  <Check className="w-3.5 h-3.5 text-lime-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                ) : s.status === 'active' ? (
                  <span className="text-violet-500 font-bold" aria-hidden="true">→</span>
                ) : s.status === 'error' ? (
                  <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                ) : (
                  <span className="text-ink-300 dark:text-ink-600">○</span>
                )}
              </span>
              <span
                className={
                  s.status === 'pending'
                    ? 'text-ink-400 dark:text-ink-600 font-light'
                    : s.status === 'active'
                      ? 'text-ink-800 dark:text-ink-100 font-medium animate-pulse'
                      : 'text-ink-600 dark:text-ink-300 font-light'
                }
              >
                {s.label}
                {s.detail && (
                  <span className="text-ink-400 dark:text-ink-500 font-mono text-[0.7rem]">: {s.detail}</span>
                )}
              </span>
            </div>
          ))}
          {run.summary && (
            <p className="pt-1.5 mt-1 border-t border-ink-200 dark:border-ink-700 text-[0.7rem] font-mono text-ink-500 dark:text-ink-400">
              {run.summary}
            </p>
          )}
          {failed && !run.summary && (
            <p className="pt-1 text-xs text-red-500">Something failed. See details above.</p>
          )}
        </div>
      )}
    </div>
  );
}
