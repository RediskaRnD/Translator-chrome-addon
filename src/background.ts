import { Message, TranslationResponse } from "./shared/types";
import { CacheManager } from "./shared/CacheManager";
import { getAccentsForLanguage } from "./shared/accents";
import { DEFAULT_SETTINGS, DEFAULT_HOTKEYS } from "./shared/constants";
import { translate, fetchFreeDictionary } from "./shared/api";

const VERSION = chrome.runtime.getManifest().version;
let currentSpeechId = 0;

const DICT_SUPPORTED_LANGS: Record<string, string> = {
  en: "en",
  hi: "hi",
  es: "es",
  fr: "fr",
  ja: "ja",
  ru: "ru",
  de: "de",
  it: "it",
  ko: "ko",
  pt: "pt-BR",
  ar: "ar",
  tr: "tr",
};

const GOOGLE_TTS_LANGS = [
  "af",
  "sq",
  "ar",
  "hy",
  "bn",
  "ca",
  "zh",
  "zh-cn",
  "zh-tw",
  "hr",
  "cs",
  "da",
  "nl",
  "en",
  "eo",
  "fi",
  "fr",
  "de",
  "el",
  "hi",
  "hu",
  "is",
  "id",
  "it",
  "ja",
  "km",
  "ko",
  "la",
  "lv",
  "mk",
  "no",
  "pl",
  "pt",
  "ro",
  "ru",
  "sr",
  "sk",
  "es",
  "sw",
  "sv",
  "ta",
  "th",
  "tr",
  "uk",
  "vi",
  "cy",
];

// Set default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    [
      "nativeLang",
      "learningLang",
      "historyLimit",
      "uiScale",
      "theme",
      "autoPlayback",
      "preferredVoices",
      "preferredAccents",
      "preferredGenders",
      "autoPlaybackLimit",
      "hotkeys",
      "showTranscription",
      "showDefinitions",
      "showExamples",
      "showSynonyms",
    ],
    (result) => {
      const defaults: any = {};
      if (!result.nativeLang) defaults.nativeLang = DEFAULT_SETTINGS.NATIVE_LANG;
      if (!result.learningLang) defaults.learningLang = DEFAULT_SETTINGS.LEARNING_LANG;
      if (!result.historyLimit) defaults.historyLimit = DEFAULT_SETTINGS.HISTORY_LIMIT;
      if (result.uiScale === undefined) defaults.uiScale = DEFAULT_SETTINGS.UI_SCALE;
      if (!result.theme) defaults.theme = DEFAULT_SETTINGS.THEME;
      if (!result.autoPlayback) defaults.autoPlayback = DEFAULT_SETTINGS.AUTO_PLAYBACK;
      if (result.autoPlaybackLimit === undefined) defaults.autoPlaybackLimit = DEFAULT_SETTINGS.AUTO_PLAYBACK_LIMIT;
      if (result.showTranscription === undefined) defaults.showTranscription = DEFAULT_SETTINGS.SHOW_TRANSCRIPTION;
      if (result.showDefinitions === undefined) defaults.showDefinitions = DEFAULT_SETTINGS.SHOW_DEFINITIONS;
      if (result.showExamples === undefined) defaults.showExamples = DEFAULT_SETTINGS.SHOW_EXAMPLES;
      if (result.showSynonyms === undefined) defaults.showSynonyms = DEFAULT_SETTINGS.SHOW_SYNONYMS;
      if (!result.preferredVoices) defaults.preferredVoices = {};
      if (!result.preferredGenders) defaults.preferredGenders = {};
      if (!result.hotkeys) defaults.hotkeys = DEFAULT_HOTKEYS;
      if (!result.preferredAccents) {
        defaults.preferredAccents = {
          en: "en-US",
          fr: "fr-FR",
          es: "es-ES",
          zh: "zh-CN",
        };
      }

      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    },
  );
});

// Красивый лог инициализации
console.log(
  `%c--- SYSTEM LOADED V${VERSION} ---`,
  "background: #222; color: #bada55; font-size: 20px; font-weight: bold; padding: 4px; border-radius: 4px;",
);

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === "TRANSLATE") {
    const { text, from, to } = message.payload;
    handleTranslation(text, from, to).then(sendResponse);
    return true;
  }

  if (message.type === "SPEAK") {
    const { text, langCode, bypassCache, options } = message.payload;
    handleSpeak(text, langCode, !!bypassCache, options);
    sendResponse({ success: true, version: VERSION });
    return false;
  }

  if (message.type === "STOP_AUDIO") {
    handleStopAudio();
    return false;
  }

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    return false;
  }

  if (message.type === "CLEAR_CACHE") {
    CacheManager.clearAllCache().then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "GET_SUPPORTED_LANGUAGES") {
    getSupportedLangs().then(sendResponse);
    return true;
  }
  return false;
});

async function getSupportedLangs(): Promise<string[]> {
  const settings = (await chrome.storage.local.get(["ttsEngine", "azureVoicesCache"])) as any;
  if (settings.ttsEngine === "azure" && settings.azureVoicesCache) {
    const azureLocales = Array.from(
      new Set(settings.azureVoicesCache.map((v: any) => v.Locale.split("-")[0].toLowerCase())),
    );
    return azureLocales as string[];
  }
  return GOOGLE_TTS_LANGS;
}

async function handleStopAudio() {
  currentSpeechId++;
  chrome.tts.stop();
  try {
    // Send message to offscreen to stop playback immediately
    chrome.runtime.sendMessage({ type: "STOP_AUDIO_OFFSCREEN" });

    const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
    });
    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (e) {}
}

async function handleSpeak(text: string, langCode: string, bypassCache: boolean = false, previewOptions?: any) {
  const mySpeechId = ++currentSpeechId;
  console.log(`Background: handleSpeak. Text: "${text}", Lang: ${langCode}, Preview: ${!!previewOptions}`);

  try {
    const settings = (await chrome.storage.local.get([
      "preferredVoices",
      "preferredAccents",
      "preferredGenders",
      "ttsEngine",
      "azureKey",
      "azureRegion",
    ])) as any;
    if (mySpeechId !== currentSpeechId) return;

    // Use preview options if provided (unsaved UI state), otherwise use stored settings
    const engine = previewOptions?.ttsEngine || settings.ttsEngine || "google";
    const preferredVoices = previewOptions?.preferredVoices || settings.preferredVoices || {};
    const preferredAccents = previewOptions?.preferredAccents || settings.preferredAccents || {};
    const preferredGenders = previewOptions?.preferredGenders || settings.preferredGenders || {};
    const azureKey = previewOptions?.azureKey || settings.azureKey || "";
    const azureRegion = previewOptions?.azureRegion || settings.azureRegion || "";

    // Determine exact accent/locale to use
    // If langCode is just 'en', we look up the preferred accent (e.g. 'en-US')
    let accentToUse = langCode;
    if (!langCode.includes("-")) {
      accentToUse = preferredAccents[langCode] || getAccentsForLanguage(langCode)[0]?.code || langCode;
    }

    if (engine === "azure" && azureKey && azureRegion) {
      await handleSpeakAzure(
        text,
        accentToUse,
        azureKey,
        azureRegion,
        mySpeechId,
        bypassCache,
        preferredVoices,
        preferredGenders,
      );
    } else {
      await handleSpeakGoogle(text, accentToUse, preferredVoices, mySpeechId, bypassCache);
    }
  } catch (e) {
    console.error("Background Speak Error:", e);
  }
}

async function handleSpeakAzure(
  text: string,
  accentCode: string,
  key: string,
  region: string,
  mySpeechId: number,
  bypassCache: boolean,
  preferredVoices: Record<string, string>,
  preferredGenders: Record<string, "Male" | "Female">,
) {
  try {
    const cacheKey = `audio_azure_${accentCode}_${text.toLowerCase().trim()}`;
    const settings = await chrome.storage.local.get([cacheKey, "azureVoicesCache"]);
    if (mySpeechId !== currentSpeechId) return;

    if (!bypassCache && settings[cacheKey]) {
      await playAudio(settings[cacheKey] as string, mySpeechId);
      return;
    }

    const baseLang = accentCode.split("-")[0];
    const targetGender = preferredGenders[baseLang] || "Female";

    let voices = settings.azureVoicesCache as any[] | undefined;
    if (!voices || !Array.isArray(voices)) {
      const voicesUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      const voicesRes = await fetch(voicesUrl, { headers: { "Ocp-Apim-Subscription-Key": key } });
      if (voicesRes.ok) {
        voices = await voicesRes.json();
        chrome.storage.local.set({ azureVoicesCache: voices });
      }
    }

    let selectedVoiceShortName = preferredVoices[accentCode] || preferredVoices[baseLang];
    const isValidAzureName = selectedVoiceShortName && selectedVoiceShortName.split("-").length >= 3;

    if (!isValidAzureName && voices && Array.isArray(voices)) {
      console.log(`Background [Azure]: Finding best match for ${accentCode} (${targetGender})`);
      const bestVoice =
        voices.find(
          (v: any) => v.Locale === accentCode && v.Gender === targetGender && v.ShortName.includes("Neural"),
        ) ||
        voices.find((v: any) => v.Locale === accentCode && v.Gender === targetGender) ||
        voices.find((v: any) => v.Locale === accentCode && v.ShortName.includes("Neural")) ||
        voices.find(
          (v: any) => v.Locale.startsWith(baseLang) && v.Gender === targetGender && v.ShortName.includes("Neural"),
        ) ||
        voices.find((v: any) => v.Locale.startsWith(baseLang) && v.ShortName.includes("Neural"));

      if (!bestVoice) {
        console.warn(`Background [Azure]: No voice found for ${accentCode}, falling back to Google`);
        throw new Error("NO_AZURE_VOICE");
      }
      selectedVoiceShortName = bestVoice.ShortName;
    }

    console.log(`Background [Azure]: Using voice ${selectedVoiceShortName} for accent ${accentCode}`);

    const ttsUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = `<speak version='1.0' xml:lang='${accentCode}'><voice xml:lang='${accentCode}' name='${selectedVoiceShortName}'>${text}</voice></speak>`;

    const response = await fetch(ttsUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      },
      body: ssml,
    });

    if (!response.ok) throw new Error(`Azure TTS error: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    if (mySpeechId !== currentSpeechId) return;

    const base64data = `data:audio/mpeg;base64,${arrayBufferToBase64(arrayBuffer)}`;
    if (!bypassCache) await chrome.storage.local.set({ [cacheKey]: base64data });
    await playAudio(base64data, mySpeechId);
  } catch (e) {
    console.warn("Background [Azure]: Failed, fallback to Google", e);
    await handleSpeakGoogle(text, accentCode, {}, mySpeechId, bypassCache);
  }
}

async function handleSpeakGoogle(
  text: string,
  accentCode: string,
  preferredVoices: Record<string, string>,
  mySpeechId: number,
  bypassCache: boolean,
) {
  // Google preferred voices can be accent-specific or base-lang specific
  const preferredVoiceName = preferredVoices[accentCode] || preferredVoices[accentCode.split("-")[0]];

  if (preferredVoiceName && !preferredVoiceName.includes("-")) {
    chrome.tts.speak(text, { voiceName: preferredVoiceName, lang: accentCode });
    return;
  }

  const cacheKey = `audio_${accentCode}_${text.toLowerCase().trim()}`;
  const cached = await chrome.storage.local.get(cacheKey);
  if (mySpeechId !== currentSpeechId) return;

  if (!bypassCache && cached[cacheKey]) {
    await playAudio(cached[cacheKey] as string, mySpeechId);
    return;
  }

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${accentCode.toLowerCase()}&client=tw-ob&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (mySpeechId !== currentSpeechId) return;

  if (!response.ok) {
    console.warn(`Background [Google]: TTS not supported for ${accentCode} (Status: ${response.status})`);
    throw new Error("GOOGLE_TTS_NOT_SUPPORTED");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (mySpeechId !== currentSpeechId) return;

  const base64data = `data:audio/mpeg;base64,${arrayBufferToBase64(arrayBuffer)}`;
  if (!bypassCache) {
    try {
      await chrome.storage.local.set({ [cacheKey]: base64data });
    } catch (e: any) {
      if (e.message?.includes("quota")) {
        await CacheManager.clearAudioCache();
        await chrome.storage.local.set({ [cacheKey]: base64data });
      }
    }
  }
  await playAudio(base64data, mySpeechId);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function playAudio(dataUrl: string, mySpeechId?: number) {
  if (mySpeechId !== undefined && mySpeechId !== currentSpeechId) return;
  const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
  try {
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
    });
    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "Playing pronunciation",
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (mySpeechId !== undefined && mySpeechId !== currentSpeechId) return;
    chrome.runtime.sendMessage({ type: "PLAY_AUDIO", url: dataUrl });
  } catch (e) {
    console.error("Offscreen Document Error:", e);
  }
}

async function handleTranslation(text: string, from: string, to: string) {
  const cached = await CacheManager.getTranslation(text, from, to);
  if (cached) {
    await CacheManager.addToHistory(text, from, to, cached);
    try {
      return JSON.parse(cached);
    } catch (e) {
      return { translatedText: cached, alternatives: [] };
    }
  }

  const settings = await chrome.storage.local.get(["showDefinitions", "showExamples", "showSynonyms"]);
  const shouldFetchDict = settings.showDefinitions || settings.showExamples || settings.showSynonyms;
  const isSingleWord = text.trim().split(/\s+/).length === 1;

  let result: TranslationResponse;
  
  if (from !== "auto" && shouldFetchDict && isSingleWord && DICT_SUPPORTED_LANGS[from.split("-")[0]]) {
    // Parallel fetch if language is known
    const dictLang = DICT_SUPPORTED_LANGS[from.split("-")[0]];
    const [translationRes, freeDictData] = await Promise.all([
      translate(text, from, to),
      fetchFreeDictionary(text.trim(), dictLang)
    ]);
    result = translationRes;
    if (freeDictData) result.freeDictionary = freeDictData;
  } else {
    // Sequential fetch if language is 'auto' (need detection first)
    result = await translate(text, from, to);
    
    const langCode = from === "auto" ? result.detectedLanguage : from;
    const dictLang = langCode ? DICT_SUPPORTED_LANGS[langCode.split("-")[0]] : null;
    
    if (shouldFetchDict && dictLang && isSingleWord) {
      const freeDictData = await fetchFreeDictionary(text.trim(), dictLang);
      if (freeDictData) {
        result.freeDictionary = freeDictData;
      }
    }
  }

  if (result.translatedText && !result.translatedText.startsWith("Error")) {
    await CacheManager.saveTranslation(text, from, to, JSON.stringify(result));
  }
  return result;
}
