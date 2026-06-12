export const DEFAULT_SETTINGS = {
  NATIVE_LANG: 'ru',
  LEARNING_LANG: 'en',
  HISTORY_LIMIT: 20,
  UI_SCALE: 1.0,
  THEME: 'system' as const,
  AUTO_PLAYBACK: 'off' as const,
  AUTO_PLAYBACK_LIMIT: 100,
  TTS_ENGINE: 'google' as const,
  AZURE_KEY: '',
  AZURE_REGION: 'westeurope',
  SHOW_TRANSCRIPTION: true,
  SHOW_DEFINITIONS: true,
  SHOW_EXAMPLES: true,
  SHOW_SYNONYMS: true,
};

export const DEFAULT_HOTKEYS = {
  PIN: 'KeyP',
  SETTINGS: 'KeyS',
  HISTORY_BACK: 'ArrowLeft',
  HISTORY_FORWARD: 'ArrowRight',
  TOGGLE_AUTOPLAY: 'KeyA',
  REPLAY: 'KeyR',
};

export const UI_CONSTANTS = {
  MIN_POPUP_HEIGHT: 150,
  MAX_POPUP_HEIGHT: 555,
  MIN_POPUP_WIDTH: 250,
  DEFAULT_POPUP_WIDTH: 350,
  MIN_UI_SCALE: 0.8,
  MAX_UI_SCALE: 1.5,
};
