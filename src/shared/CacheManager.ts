import { HistoryItem } from './types';

export class CacheManager {
  private static CACHE_KEY = 'translation_cache';
  private static HISTORY_KEY = 'translation_history';

  public static async getTranslation(text: string, from: string, to: string): Promise<string | null> {
    const key = `${from}_${to}_${text.toLowerCase()}`;
    const cacheData = await chrome.storage.local.get(this.CACHE_KEY);
    const cache = cacheData[this.CACHE_KEY] as Record<string, string> || {};
    return cache[key] || null;
  }

  public static async saveTranslation(text: string, from: string, to: string, translation: string) {
    const key = `${from}_${to}_${text.toLowerCase()}`;
    const cacheData = await chrome.storage.local.get(this.CACHE_KEY);
    const cache = cacheData[this.CACHE_KEY] as Record<string, string> || {};
    cache[key] = translation;
    await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
    await this.addToHistory(text, from, to, translation);
  }

  private static async addToHistory(text: string, from: string, to: string, translation: string) {
    const historyData = await chrome.storage.local.get([this.HISTORY_KEY, 'historyLimit']);
    let history = (historyData[this.HISTORY_KEY] as HistoryItem[]) || [];
    const limit = (historyData.historyLimit as number) || 20;

    // Remove if already exists (move to top)
    history = history.filter(item => item.text.toLowerCase() !== text.toLowerCase());
    
    history.unshift({
      text,
      from,
      to,
      translation,
      timestamp: Date.now()
    });

    if (history.length > limit) {
      history = history.slice(0, limit);
    }

    await chrome.storage.local.set({ [this.HISTORY_KEY]: history });
  }

  public static async getHistory(): Promise<HistoryItem[]> {
    const data = await chrome.storage.local.get(this.HISTORY_KEY);
    return (data[this.HISTORY_KEY] as HistoryItem[]) || [];
  }
}
