export interface TranslationRequest {
  text: string;
  from: string;
  to: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
}

export type AutoPlaybackMode = 'off' | 'from' | 'to';

export interface Settings {
  nativeLang: string;
  learningLang: string;
  preferredVoices: Record<string, string>; // languageCode -> voiceName
  historyLimit: number;
  theme: 'light' | 'dark' | 'system';
  autoPlayback: AutoPlaybackMode;
  uiScale: number;
}

export interface HistoryItem {
  text: string;
  from: string;
  to: string;
  translation: any;
  timestamp: number;
}

export type MessageType = 'TRANSLATE' | 'SPEAK' | 'GET_VOICES' | 'PING' | 'OPEN_OPTIONS';

export interface Message {
  type: MessageType;
  payload?: any;
}

