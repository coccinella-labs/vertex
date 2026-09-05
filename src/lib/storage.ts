import type { Conversation, Settings, Theme } from '@/types';
import { DEFAULT_SETTINGS } from '@/lib/openrouter';

const CONV_KEY = 'vertex:conversations';
const SETTINGS_KEY = 'vertex:settings';
const THEME_KEY = 'vertex:theme';

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(CONV_KEY, JSON.stringify(conversations));
  } catch {
    // Quota exceeded (e.g. several image-heavy chats): keep text and work
    // logs, drop image bytes so history never breaks. In-session images stay.
    try {
      const slim = conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => {
          const { images, ...rest } = m;
          void images;
          return rest;
        }),
      }));
      localStorage.setItem(CONV_KEY, JSON.stringify(slim));
    } catch {
      // storage unavailable: chat continues in memory for this session
    }
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
