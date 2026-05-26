import { Message } from "./shared/types";
import { CacheManager } from "./shared/CacheManager";
import { getAccentsForLanguage } from "./shared/accents";
import { DEFAULT_SETTINGS, DEFAULT_HOTKEYS } from "./shared/constants";

const VERSION = chrome.runtime.getManifest().version;
let currentSpeechId = 0;

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
      "autoPlaybackLimit",
      "hotkeys",
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
      if (!result.preferredVoices) defaults.preferredVoices = {};
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
    const { text, langCode } = message.payload;
    handleSpeak(text, langCode);
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
  return false;
});

async function handleStopAudio() {
  console.log("Background: handleStopAudio called. ID before increment:", currentSpeechId);
  currentSpeechId++; // Cancel any pending handleSpeak operations
  console.log("Background: ID after increment:", currentSpeechId);
  chrome.tts.stop();
  
  // Nuclear option: Close the offscreen document to force-stop all HTML5 Audio
  try {
    const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
    });

    console.log("Background: Existing offscreen contexts:", existingContexts.length);
    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
      console.log("Background: chrome.offscreen.closeDocument() executed");
    }
  } catch (e) {
    console.error("Background: Error closing offscreen document:", e);
  }
}

async function handleSpeak(text: string, langCode: string) {
  const mySpeechId = ++currentSpeechId;
  console.log(`Background: handleSpeak start. Text: "${text}", Lang: ${langCode}, My ID: ${mySpeechId}`);
  
  try {
    const settings = await chrome.storage.local.get(["preferredVoices", "preferredAccents"]);
    if (mySpeechId !== currentSpeechId) {
      console.log(`Background: handleSpeak cancelled after storage.local.get (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
      return;
    }

    const preferredVoices = (settings.preferredVoices || {}) as Record<string, string>;
    const preferredAccents = (settings.preferredAccents || {}) as Record<string, string>;

    const preferredVoiceName = preferredVoices[langCode];

    // Determine the best accent code to use
    let preferredAccent = preferredAccents[langCode];
    if (!preferredAccent) {
      const defaultAccents = getAccentsForLanguage(langCode);
      preferredAccent = defaultAccents.length > 0 ? defaultAccents[0].code : langCode;
    }

    if (preferredVoiceName) {
      console.log(`Background: Using chrome.tts.speak with voice: ${preferredVoiceName}`);
      chrome.tts.speak(text, {
        voiceName: preferredVoiceName,
        lang: preferredAccent,
      });
      return;
    }

    const cacheKey = `audio_${preferredAccent}_${text.toLowerCase().trim()}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (mySpeechId !== currentSpeechId) {
      console.log(`Background: handleSpeak cancelled after cache check (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
      return;
    }

    if (cached[cacheKey]) {
      console.log(`Background: Using cached audio for: "${text}"`);
      await playAudio(cached[cacheKey] as string, mySpeechId);
      return;
    }

    console.log(`Background: Fetching audio from Google TTS for: "${text}"`);
    // Use lowercase for tl parameter to improve compatibility with Google TTS
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${preferredAccent.toLowerCase()}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (mySpeechId !== currentSpeechId) {
      console.log(`Background: handleSpeak cancelled after fetch (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (mySpeechId !== currentSpeechId) {
      console.log(`Background: handleSpeak cancelled after arrayBuffer (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
      return;
    }

    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64data = `data:audio/mpeg;base64,${btoa(binary)}`;

    // Save to cache with self-healing on quota error
    try {
      await chrome.storage.local.set({ [cacheKey]: base64data });
    } catch (e: any) {
      if (e.message && (e.message.includes('quota') || e.message.includes('Quota'))) {
        console.warn("Background: Storage quota exceeded, clearing audio cache...");
        await CacheManager.clearAudioCache();
        try {
          await chrome.storage.local.set({ [cacheKey]: base64data });
        } catch (innerE) {
          console.error("Background: Still getting quota error after clearing cache", innerE);
        }
      } else {
        throw e;
      }
    }
    
    console.log(`Background: Audio cached for: "${text}"`);

    if (mySpeechId === currentSpeechId) {
      await playAudio(base64data, mySpeechId);
    } else {
      console.log(`Background: handleSpeak final block cancelled (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
    }
  } catch (e: any) {
    console.error("Background Speak Error:", e);
  }
}

async function playAudio(dataUrl: string, mySpeechId?: number) {
  if (mySpeechId !== undefined && mySpeechId !== currentSpeechId) {
    console.log(`Background: playAudio aborted before start (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
    return;
  }

  const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
  try {
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
    });

    if (existingContexts.length === 0) {
      console.log("Background: Creating offscreen document...");
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "Playing pronunciation",
      });
      console.log("Background: Offscreen document created.");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    if (mySpeechId !== undefined && mySpeechId !== currentSpeechId) {
      console.log(`Background: playAudio aborted after document check (My ID: ${mySpeechId}, Current: ${currentSpeechId})`);
      return;
    }

    console.log("Background: Sending PLAY_AUDIO to offscreen.");
    chrome.runtime.sendMessage({ type: "PLAY_AUDIO", url: dataUrl });
  } catch (e) {
    console.error("Offscreen Document Error:", e);
  }
}

async function handleTranslation(text: string, from: string, to: string) {
  const cached = await CacheManager.getTranslation(text, from, to);
  if (cached) {
    // Refresh history position
    await CacheManager.addToHistory(text, from, to, cached);
    try {
      return JSON.parse(cached);
    } catch (e) {
      return { translatedText: cached, alternatives: [] };
    }
  }
  const result = await translate(text, from, to);
  if (result.translatedText && !result.translatedText.startsWith("Error")) {
    await CacheManager.saveTranslation(text, from, to, JSON.stringify(result));
  }
  return result;
}

async function translate(text: string, from: string, to: string) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&dt=at&dt=bd&q=${encodeURIComponent(text)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const mainTranslation = data[0].map((item: any) => item[0]).join("");

    // Group alternatives by parts of speech
    const dictionary: { pos: string; terms: string[] }[] = [];
    if (data[1]) {
      data[1].forEach((item: any) => {
        const pos = item[0]; // Part of speech (e.g., "noun", "verb")
        const terms = item[1]; // Array of translations
        dictionary.push({ pos, terms });
      });
    }

    return {
      translatedText: mainTranslation,
      dictionary: dictionary,
      detectedLanguage: data[2],
    };
  } catch (error) {
    return { translatedText: "Error", dictionary: [] };
  }
}
