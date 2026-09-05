import { MessageSquare, Trash2, Plus, X, ExternalLink, FolderGit2, Globe } from 'lucide-react';
import type { Conversation } from '@/types';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onClose }: Props) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="h-full flex flex-col bg-white/80 dark:bg-ink-950/80 backdrop-blur-xl border-r border-ink-200 dark:border-ink-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-ink-200 dark:border-ink-800">
        <div className="flex items-center gap-2.5">
          <div className="brand-orb" aria-hidden="true" />
          <span className="font-display text-[0.9rem] uppercase tracking-tight text-ink-900 dark:text-white">Vertex</span>
        </div>
          <button
            onClick={onClose}
            className="md:hidden text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-white transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
          <X className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        </button>
      </div>

      {/* New chat */}
      <div className="p-3">
        <button
          onClick={onNew}
          className="pill-lime w-full justify-center"
        >
          <Plus className="w-4 h-4 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
          New chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {sorted.length === 0 ? (
          <p className="text-xs text-ink-400 dark:text-ink-500 px-3 py-4 font-light">
            No conversations yet.
          </p>
        ) : (
          <div className="space-y-0.5">
            {sorted.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  activeId === conv.id
                    ? 'bg-violet-500/15 border border-violet-500/30'
                    : 'hover:bg-ink-100 dark:hover:bg-ink-800 border border-transparent'
                }`}
                onClick={() => onSelect(conv.id)}
              >
                <MessageSquare className="w-3.5 h-3.5 text-ink-400 dark:text-ink-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="flex-1 text-sm text-ink-700 dark:text-ink-200 truncate font-medium">
                  {conv.title}
                </span>
                {(conv.codebase || conv.web || (conv.mode && conv.mode !== 'chat')) && (
                  <span className="flex items-center gap-1 flex-shrink-0" title={[
                    conv.codebase ? `Repo: ${conv.codebase.owner}/${conv.codebase.repo}` : '',
                    conv.web ? `Web: ${conv.web.title || conv.web.url}` : '',
                    conv.mode && conv.mode !== 'chat' ? `Mode: ${conv.mode}` : '',
                  ].filter(Boolean).join(' · ')}>
                    {conv.codebase && <FolderGit2 className="w-3 h-3 text-violet-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />}
                    {conv.web && <Globe className="w-3 h-3 text-violet-500 flex-shrink-0" strokeWidth={2} aria-hidden="true" />}
                    {conv.mode && conv.mode !== 'chat' && (
                      <span className="text-[0.55rem] font-bold uppercase tracking-wider text-lime-600 dark:text-lime-400">
                        {conv.mode === 'think' ? 'T' : 'P'}
                      </span>
                    )}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(conv.id);
                  }}
                  aria-label={`Delete ${conv.title}`}
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-ink-400 dark:text-ink-500 hover:text-lime-500 dark:hover:text-lime-400 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-ink-200 dark:border-ink-700 p-3">
        <a
          href="https://vertexlabsofficial.lovable.app"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-ink-500 dark:text-ink-500 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-lime-500 dark:hover:text-lime-400"
        >
          <span>
            <span className="block text-[0.6rem] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">Company</span>
            <span className="text-xs font-medium">Vertex Labs</span>
          </span>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
