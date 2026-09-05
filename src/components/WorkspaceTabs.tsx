import { MessageSquare, FolderGit2, Globe, StickyNote } from 'lucide-react';

export type WorkspaceTab = 'chat' | 'codebase' | 'web' | 'notes';

interface Props {
  tab: WorkspaceTab;
  onChange: (t: WorkspaceTab) => void;
  hasCodebase: boolean;
  hasWeb: boolean;
}

const TABS: { id: WorkspaceTab; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'codebase', label: 'Codebase', icon: FolderGit2 },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'notes', label: 'Notes', icon: StickyNote },
];

export function WorkspaceTabs({ tab, onChange, hasCodebase, hasWeb }: Props) {
  return (
    <div className="flex items-center gap-1 px-4 md:px-6 pt-3 max-w-3xl mx-auto w-full">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        const dot = (id === 'codebase' && hasCodebase) || (id === 'web' && hasWeb);
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] font-bold uppercase tracking-[0.15em] transition-colors ${
              active
                ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/30'
                : 'text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-200 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
            {label}
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />}
          </button>
        );
      })}
    </div>
  );
}
