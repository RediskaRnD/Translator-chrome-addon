export interface Accent {
  code: string;
  name: string;
  label: string;
}

export const LANGUAGE_ACCENTS: Record<string, Accent[]> = {
  'en': [
    { code: 'en-US', name: 'American English', label: 'US' },
    { code: 'en-GB', name: 'British English', label: 'UK' },
    { code: 'en-AU', name: 'Australian English', label: 'AU' },
  ],
  'ru': [
    { code: 'ru-RU', name: 'Russian', label: 'RU' },
  ],
  'de': [
    { code: 'de-DE', name: 'German', label: 'DE' },
  ],
  'fr': [
    { code: 'fr-FR', name: 'French', label: 'FR' },
    { code: 'fr-CA', name: 'Canadian French', label: 'CA' },
  ],
  'es': [
    { code: 'es-ES', name: 'Spanish (Spain)', label: 'ES' },
    { code: 'es-US', name: 'Spanish (Latin America)', label: 'LA' },
  ],
  'it': [
    { code: 'it-IT', name: 'Italian', label: 'IT' },
  ],
  'zh': [
    { code: 'zh-CN', name: 'Chinese (Mandarin)', label: 'CN' },
    { code: 'zh-TW', name: 'Chinese (Taiwan)', label: 'TW' },
  ],
  'ja': [
    { code: 'ja-JP', name: 'Japanese', label: 'JP' },
  ],
  'ko': [
    { code: 'ko-KR', name: 'Korean', label: 'KR' },
  ],
};

export function getAccentsForLanguage(lang: string): Accent[] {
  // If 'auto', we don't know the accents until detected, but we can return a default or empty
  return LANGUAGE_ACCENTS[lang] || [];
}
