export interface Accent {
  code: string;
  name: string;
  label: string;
}

export const LANGUAGE_ACCENTS: Record<string, Accent[]> = {
  // English
  'en': [
    { code: 'en-US', name: 'American English', label: 'US' },
    { code: 'en-GB', name: 'British English', label: 'UK' },
    { code: 'en-AU', name: 'Australian English', label: 'AU' },
    { code: 'en-IN', name: 'Indian English', label: 'IN' },
    { code: 'en-CA', name: 'Canadian English', label: 'CA' },
    { code: 'en-ZA', name: 'South African', label: 'ZA' },
  ],
  // Spanish
  'es': [
    { code: 'es-ES', name: 'Spanish (Spain)', label: 'ES' },
    { code: 'es-MX', name: 'Spanish (Mexico)', label: 'MX' },
    { code: 'es-US', name: 'Spanish (US)', label: 'US' },
  ],
  // Portuguese
  'pt': [
    { code: 'pt-PT', name: 'Portuguese (Portugal)', label: 'PT' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', label: 'BR' },
  ],
  // French
  'fr': [
    { code: 'fr-FR', name: 'French (France)', label: 'FR' },
    { code: 'fr-CA', name: 'French (Canada)', label: 'CA' },
  ],
  // German
  'de': [
    { code: 'de-DE', name: 'German (Germany)', label: 'DE' },
    { code: 'de-AT', name: 'German (Austria)', label: 'AT' },
    { code: 'de-CH', name: 'German (Switzerland)', label: 'CH' },
  ],
  // Chinese
  'zh': [
    { code: 'zh-CN', name: 'Chinese (Mandarin)', label: 'CN' },
    { code: 'zh-TW', name: 'Chinese (Taiwan)', label: 'TW' },
    { code: 'zh-HK', name: 'Chinese (Cantonese)', label: 'HK' },
  ],
  // Dutch
  'nl': [
    { code: 'nl-NL', name: 'Dutch (Netherlands)', label: 'NL' },
    { code: 'nl-BE', name: 'Dutch (Belgium)', label: 'BE' },
  ],
  // Arabic (Usually just standard, but can have regional variations in some engines)
  'ar': [
    { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', label: 'SA' },
    { code: 'ar-EG', name: 'Arabic (Egypt)', label: 'EG' },
  ],
  // Common single-accent languages
  'ru': [{ code: 'ru-RU', name: 'Russian', label: 'RU' }],
  'ja': [{ code: 'ja-JP', name: 'Japanese', label: 'JP' }],
  'ko': [{ code: 'ko-KR', name: 'Korean', label: 'KR' }],
  'it': [{ code: 'it-IT', name: 'Italian', label: 'IT' }],
  'pl': [{ code: 'pl-PL', name: 'Polish', label: 'PL' }],
  'tr': [{ code: 'tr-TR', name: 'Turkish', label: 'TR' }],
  'uk': [{ code: 'uk-UA', name: 'Ukrainian', label: 'UA' }],
  'vi': [{ code: 'vi-VN', name: 'Vietnamese', label: 'VN' }],
  'th': [{ code: 'th-TH', name: 'Thai', label: 'TH' }],
  'hi': [{ code: 'hi-IN', name: 'Hindi', label: 'HI' }],
  'id': [{ code: 'id-ID', name: 'Indonesian', label: 'ID' }],
  'el': [{ code: 'el-GR', name: 'Greek', label: 'GR' }],
  'sv': [{ code: 'sv-SE', name: 'Swedish', label: 'SE' }],
  'da': [{ code: 'da-DK', name: 'Danish', label: 'DK' }],
  'fi': [{ code: 'fi-FI', name: 'Finnish', label: 'FI' }],
  'no': [{ code: 'no-NO', name: 'Norwegian', label: 'NO' }],
  'ro': [{ code: 'ro-RO', name: 'Romanian', label: 'RO' }],
  'hu': [{ code: 'hu-HU', name: 'Hungarian', label: 'HU' }],
  'cs': [{ code: 'cs-CZ', name: 'Czech', label: 'CZ' }],
  'sk': [{ code: 'sk-SK', name: 'Slovak', label: 'SK' }],
  'he': [{ code: 'he-IL', name: 'Hebrew', label: 'IL' }],
  'lt': [{ code: 'lt-LT', name: 'Lithuanian', label: 'LT' }],
  'lv': [{ code: 'lv-LV', name: 'Latvian', label: 'LV' }],
  'et': [{ code: 'et-EE', name: 'Estonian', label: 'EE' }],
  'bg': [{ code: 'bg-BG', name: 'Bulgarian', label: 'BG' }],
  'hr': [{ code: 'hr-HR', name: 'Croatian', label: 'HR' }],
  'sl': [{ code: 'sl-SI', name: 'Slovenian', label: 'SI' }],
};

export function getAccentsForLanguage(lang: string): Accent[] {
  // Normalize code (e.g., 'en-US' -> 'en')
  const baseCode = lang.split('-')[0].toLowerCase();
  
  if (LANGUAGE_ACCENTS[baseCode]) {
    return LANGUAGE_ACCENTS[baseCode];
  }

  // If no accents defined, return a default one based on the language code
  return [{ 
    code: lang, 
    name: lang.toUpperCase(), 
    label: lang.split('-')[0].toUpperCase() 
  }];
}
