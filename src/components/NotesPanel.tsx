import { useState } from 'react';

interface Props {
  notes: string;
  onChange: (v: string) => void;
}

function timeOf(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function NotesPanel({ notes, onChange }: Props) {
  const [savedAt, setSavedAt] = useState<number | null>(null);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 w-full">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="eyebrow">Workspace notes</p>
        <p className="text-[0.65rem] text-ink-400 dark:text-ink-500 font-medium" aria-live="polite">
          {savedAt ? `Saved · ${timeOf(savedAt)}` : 'Saved locally as you type'}
        </p>
      </div>
      <p className="text-xs text-ink-400 dark:text-ink-500 font-light mb-3">
        Scratchpad for this conversation. Saved locally.
      </p>
      <textarea
        value={notes}
        onChange={(e) => {
          onChange(e.target.value);
          setSavedAt(Date.now());
        }}
        placeholder="What did you learn? What needs checking? Next actions…"
        rows={12}
        className="w-full glass rounded-xl p-4 text-sm font-light bg-transparent focus:outline-none focus:border-violet-400 dark:focus:border-violet-500/50 resize-y placeholder:text-ink-400 dark:placeholder:text-ink-500"
      />
    </div>
  );
}
