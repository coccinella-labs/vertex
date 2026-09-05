interface Props {
  onSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  { label: 'Paste repo', text: 'https://github.com/facebook/react: map its architecture and entry points.' },
  { label: 'Understand', text: 'Explain this repository to me as if I just joined the team.' },
  { label: 'Think', text: 'Help me think through where to add authentication in a typical React + API codebase.' },
  { label: 'Plan', text: 'I want to add GitHub OAuth. Turn it into a plan: files, API, UI, tests, risks.' },
];

export function EmptyState({ onSuggestion }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto scrollbar-thin">
      <div className="m-auto w-full flex flex-col items-center px-6 py-10">
      <p className="eyebrow mb-3">Focus chat</p>
      <h1 className="display text-5xl md:text-6xl text-ink-900 dark:text-white dark:text-glow-violet mb-3">
        How can I help?
      </h1>
      <p className="text-ink-500 dark:text-ink-400 font-light mb-10 text-center max-w-md">
        Drop a link, or start below.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggestion(s.text)}
            className="text-left p-4 glass glass-hover rounded-xl group"
          >
            <p className="eyebrow mb-1.5 group-hover:text-lime-500 dark:group-hover:text-lime-400 transition-colors">
              {s.label}
            </p>
            <p className="text-sm text-ink-600 dark:text-ink-300 font-light line-clamp-2">
              {s.text}
            </p>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
}
