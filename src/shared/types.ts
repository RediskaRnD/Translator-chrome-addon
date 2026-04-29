export interface TranslationRequest {
  text: string;
  from: string;
  to: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
}

export interface Settings {
  nativeLang: string;
  learningLang: string;
  preferredVoice?: string;
  historyLimit: number;
  theme: 'light' | 'dark' | 'system';
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

