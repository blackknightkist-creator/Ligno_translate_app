/**
 * LingoPro Privacy-First Local Storage Engine
 * 
 * Manages local user history and settings with strict privacy controls:
 * - History storage toggle (can be disabled at any time)
 * - Individual entry deletion & full one-click wipe
 * - Export history to JSON or TXT
 * - Zero voice audio persistence (audio is always ephemeral)
 */

import { HistoryItem, AppSettings, ToneStyle } from '../types';

const STORAGE_KEYS = {
  HISTORY: 'lingopro_history_v1',
  SETTINGS: 'lingopro_settings_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  preferredTargetLang: 'auto',
  defaultTone: 'professional',
  enableVoiceInterim: true,
  autoDetectLanguage: true,
  storeHistoryLocally: true,
  ttsVoicePreference: 'auto',
  highContrastMode: false,
};

/**
 * Load user settings with fallback to defaults
 */
export function getStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.warn('Failed to read settings from localStorage', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save user settings
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings to localStorage', e);
  }
}

/**
 * Load history items (max 50 to prevent local storage bloat)
 */
export function getHistory(): HistoryItem[] {
  try {
    const settings = getStoredSettings();
    if (!settings.storeHistoryLocally) return [];

    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to read history from localStorage', e);
  }
  return [];
}

/**
 * Add a new history item if history storage is enabled
 */
export function addHistoryItem(item: Omit<HistoryItem, 'id' | 'timestamp'>): HistoryItem | null {
  try {
    const settings = getStoredSettings();
    if (!settings.storeHistoryLocally) return null;

    const current = getHistory();
    const newItem: HistoryItem = {
      ...item,
      id: 'lp_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
      timestamp: Date.now(),
    };

    // Keep newest 50 items
    const updated = [newItem, ...current].slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.warn('Failed to add history item', e);
    return null;
  }
}

/**
 * Remove a single history item by ID
 */
export function removeHistoryItem(id: string): void {
  try {
    const current = getHistory();
    const filtered = current.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Failed to remove history item', e);
  }
}

/**
 * Completely wipe all stored history
 */
export function clearAllHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  } catch (e) {
    console.warn('Failed to clear history', e);
  }
}

/**
 * Export history items as downloadable JSON or text file
 */
export function exportHistoryFile(format: 'json' | 'txt'): void {
  const items = getHistory();
  let content = '';
  let filename = `lingopro_history_${new Date().toISOString().slice(0, 10)}`;
  let mimeType = 'text/plain';

  if (format === 'json') {
    content = JSON.stringify(items, null, 2);
    filename += '.json';
    mimeType = 'application/json';
  } else {
    filename += '.txt';
    content = items
      .map(
        (i) =>
          `[${new Date(i.timestamp).toLocaleString()}] [${i.mode.toUpperCase()}] (${i.inputLanguage})\nINPUT: ${i.inputText}\nOUTPUT: ${i.primaryOutput}\n${i.secondaryOutput ? `SECONDARY: ${i.secondaryOutput}\n` : ''}----------------------------------------\n`
      )
      .join('\n');
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
