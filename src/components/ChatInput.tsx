import { useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';
import { ArrowUp, Square, ImagePlus, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  disabled: boolean;
  images: string[];
  onImagesChange: (imgs: string[]) => void;
  onError: (msg: string) => void;
}

const MAX_IMAGES = 4;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_DIM = 1568;

/** Downscale to a vision-friendly JPEG data URL so stored conversations stay small. */
async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

export function ChatInput({ value, onChange, onSend, onStop, streaming, disabled, images, onImagesChange, onError }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const canSend = (!!value.trim() || images.length > 0) && !streaming && !disabled;

  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) return;
    if (images.length + imgs.length > MAX_IMAGES) {
      onError(`Up to ${MAX_IMAGES} images per message.`);
      return;
    }
    const next = [...images];
    for (const f of imgs) {
      if (f.size > MAX_FILE_BYTES) {
        onError(`"${f.name || 'Image'}" is over 8 MB.`);
        continue;
      }
      try {
        next.push(await fileToDataUrl(f));
      } catch {
        onError('Could not read that image.');
      }
    }
    onImagesChange(next.slice(0, MAX_IMAGES));
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData?.items ?? [])) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) void addFiles(files);
  };

  return (
    <div className="px-4 md:px-6" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
      <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 glass rounded-[28px] focus-within:border-violet-400 dark:focus-within:border-violet-500/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_48px_-10px_rgba(124,58,237,0.55)] transition-colors transition-shadow duration-300">
          {images.length > 0 && (
            <div className="absolute -top-11 left-4 flex gap-1.5">
              {images.map((src, i) => (
                <span key={i} className="relative">
                  <img src={src} alt={`Attached image ${i + 1}`} className="w-10 h-10 rounded-lg object-cover border border-ink-200 dark:border-ink-700" />
                  <button
                    onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 flex items-center justify-center"
                    title="Remove image"
                    aria-label={`Remove image ${i + 1}`}
                  >
                    <X className="w-2.5 h-2.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={streaming || disabled}
            className="ml-2 mb-2.5 w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-ink-400 dark:text-ink-500 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors disabled:opacity-30"
            title="Attach images"
            aria-label="Attach images"
          >
            <ImagePlus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder="Message Vertex…"
            aria-label="Message Vertex"
            rows={1}
            className="flex-1 self-center min-h-[56px] max-h-[200px] overflow-hidden bg-transparent resize-none px-2 py-4 text-sm leading-6 text-ink-900 dark:text-ink-100 placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:outline-none"
          />
          <div className="p-2.5">
            {streaming ? (
              <button
                onClick={onStop}
                className="w-9 h-9 rounded-full bg-ink-100 dark:bg-ink-700 border border-ink-200 dark:border-ink-600 text-ink-700 dark:text-ink-100 flex items-center justify-center hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors"
                title="Stop"
              >
                <Square className="w-3.5 h-3.5 fill-current flex-shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!canSend}
                className="w-9 h-9 rounded-full bg-lime-400 text-ink-950 flex items-center justify-center hover:bg-lime-300 hover:shadow-[0_0_20px_-5px_rgba(163,230,53,0.6)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                title="Send"
              >
                <ArrowUp className="w-4 h-4 flex-shrink-0" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[0.65rem] uppercase tracking-[0.2em] text-ink-400 dark:text-ink-600 mt-2.5 font-medium">
          Verify what matters.
        </p>
      </div>
    </div>
  );
}
