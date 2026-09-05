import { Brain, MessagesSquare, ClipboardList } from 'lucide-react';
import type { ChatMode } from '@/types';

interface Props {
  mode: ChatMode;
  onChange: (m: ChatMode) => void;
}

const MODES: { id: ChatMode; label: string; title: string; icon: typeof Brain }[] = [
  { id: 'chat', label: 'Chat', title: 'Normal Q&A', icon: MessagesSquare },
  { id: 'think', label: 'Think', title: 'Question → Context → Observations → Options → Recommendation', icon: Brain },
  { id: 'plan', label: 'Plan', title: 'Files to change, APIs, UI, tests, risks', icon: ClipboardList },
];

export function ModeSelector({ mode, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-full border border-ink-200 dark:border-ink-700 bg-white/60 dark:bg-ink-900/60">
      {MODES.map(({ id, label, title, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={title}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-bold uppercase tracking-[0.12em] transition-colors ${
            mode === id
              ? 'bg-lime-400 text-ink-950'
              : 'text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200'
          }`}
        >
          <Icon className="w-3 h-3 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="hidden min-[420px]:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
