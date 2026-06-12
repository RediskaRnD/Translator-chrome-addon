export interface TranslationRequest {
  text: string;
  from: string;
  to: string;
}

export interface TranslationResponse {
  translatedText: string;
  detectedLanguage?: string;
  transcription?: {
    from: string;
    to: string;
  };
  dictionary?: { pos: string; terms: string[] }[];
  freeDictionary?: FreeDictionaryData[];
}

export interface FreeDictionaryData {
  word: string;
  phonetic?: string;
  phonetics: { text?: string; audio?: string }[];
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
      synonyms: string[];
      antonyms: string[];
    }[];
    synonyms: string[];
    antonyms: string[];
  }[];
}

export type AutoPlaybackMode = "off" | "from" | "to";

export interface Settings {
  nativeLang: string;
  learningLang: string;
  preferredVoices: Record<string, string>; // languageCode -> voiceName
  preferredAccents: Record<string, string>; // languageCode -> accentCode
  historyLimit: number;
  theme: "light" | "dark" | "system";
  autoPlayback: AutoPlaybackMode;
  uiScale: number;
  showTranscription: boolean;
  showDefinitions: boolean;
  showExamples: boolean;
  showSynonyms: boolean;
}

export interface HistoryItem {
  text: string;
  from: string;
  to: string;
  translation: any;
  timestamp: number;
}

export type MessageType =
  | "GET_SUPPORTED_LANGUAGES"
  | "GET_VOICES"
  | "TRANSLATE"
  | "SPEAK"
  | "STOP_AUDIO"
  | "PLAY_SAMPLE"
  | "PING"
  | "OPEN_OPTIONS"
  | "CLEAR_CACHE";

export interface Message {
  type: MessageType;
  payload?: any;
}
