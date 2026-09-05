import type { ChatMessage, Settings } from '@/types';

const API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openrouter/auto';

export const BUILT_IN_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
/** No shared key ships with VERTEX (privacy). When empty, there is no free tier. User key required. */
export const HAS_BUILT_IN_KEY = BUILT_IN_API_KEY.length > 0;
export const FREE_MESSAGE_LIMIT = HAS_BUILT_IN_KEY ? 2 : 0;

export const DEFAULT_SYSTEM_PROMPT =
  'You are a thoughtful, grounded assistant. Be concise and direct. ' +
  'Prefer brevity over verbosity. Use markdown when structure helps. ' +
  'Maintain a calm, measured tone. Avoid excessive enthusiasm or filler.';

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: DEFAULT_MODEL,
  temperature: 0.7,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

export function getEffectiveApiKey(userKey: string): string {
  return userKey || BUILT_IN_API_KEY;
}

export type PayloadContent =
  | string
  | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];

export interface PayloadMessage {
  role: string;
  content: PayloadContent;
}

/** Build the API message list. Text-only messages keep the plain-string
 *  shape (current path unchanged); messages with images use multimodal
 *  content parts. Exported for CLI parity checks. */
export function buildPayloadMessages(messages: ChatMessage[], systemPrompt: string): PayloadMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    ...messages.map((m): PayloadMessage => {
      if (m.images && m.images.length > 0) {
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            ...m.images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
          ],
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];
}

/** True when a request failure means the selected model cannot read images. */
export function isVisionError(message: string): boolean {
  return /does not support (image|vision)|image[^.]{0,40}not supported|vision[^.]{0,40}not supported|multimodal|image_url/i.test(message);
}

interface StreamOptions {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  systemPrompt: string;
  signal: AbortSignal;
  onToken: (token: string) => void;
}

export async function streamChatCompletion(opts: StreamOptions): Promise<void> {
  const { apiKey, model, messages, temperature, systemPrompt, signal, onToken } = opts;

  const payloadMessages = buildPayloadMessages(messages, systemPrompt);

  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Vertex Chat',
    },
    body: JSON.stringify({
      model,
      messages: payloadMessages,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `Request failed (${res.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) message = parsed.error.message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;

      try {
        const json = JSON.parse(data);
        const token = json?.choices?.[0]?.delta?.content;
        if (token) onToken(token);
      } catch {
        // skip malformed chunk
      }
    }
  }
}

export function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 40) return cleaned;
  return cleaned.slice(0, 40) + '…';
}
