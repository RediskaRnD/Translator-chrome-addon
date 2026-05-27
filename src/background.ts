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
    const settings = await chrome.storage.local.get(["preferredVoices", "preferredAccents", "ttsEngine", "azureKey", "azureRegion"]) as {
      preferredVoices?: Record<string, string>;
      preferredAccents?: Record<string, string>;
      ttsEngine?: 'google' | 'azure';
      azureKey?: string;
      azureRegion?: string;
    };
    if (mySpeechId !== currentSpeechId) return;

    const engine = settings.ttsEngine || "google";
    const preferredVoices = settings.preferredVoices || {};
    const preferredAccents = settings.preferredAccents || {};
    const azureKey = settings.azureKey || "";
    const azureRegion = settings.azureRegion || "";

    // Determine exact accent to use
    let accentToUse = langCode;
    if (!langCode.includes('-')) {
      const preferredAccent = preferredAccents[langCode];
      if (preferredAccent) {
        accentToUse = preferredAccent;
      } else {
        const defaultAccents = getAccentsForLanguage(langCode);
        accentToUse = defaultAccents.length > 0 ? defaultAccents[0].code : langCode;
      }
    }

    // Use selected engine
    if (engine === 'azure' && azureKey && azureRegion) {
      await handleSpeakAzure(text, accentToUse, azureKey, azureRegion, mySpeechId);
    } else {
      await handleSpeakGoogle(text, accentToUse, preferredVoices, mySpeechId);
    }
  } catch (e) {
    console.error("Background Speak Error:", e);
  }
}

async function handleSpeakAzure(text: string, accentCode: string, key: string, region: string, mySpeechId: number) {
  try {
    const cacheKey = `audio_azure_${accentCode}_${text.toLowerCase().trim()}`;
    const settings = await chrome.storage.local.get(["preferredVoices", "azureVoicesCache"]);
    if (mySpeechId !== currentSpeechId) return;

    if (settings[cacheKey]) {
      console.log(`Background [Azure]: Using cached audio`);
      await playAudio(settings[cacheKey] as string, mySpeechId);
      return;
    }

    const preferredVoices = (settings.preferredVoices || {}) as Record<string, string>;
    const baseLang = accentCode.split('-')[0];
    
    // 1. Priority: User selected a specific voice in Options for this accent or base language
    let selectedVoiceShortName = preferredVoices[accentCode] || preferredVoices[baseLang];

    if (!selectedVoiceShortName) {
      console.log(`Background [Azure]: No preferred voice, finding best match...`);
      // 2. Fetch/Use voices list to find best neural match
      let voices = settings.azureVoicesCache as any[] | undefined;
      if (!voices || !Array.isArray(voices)) {
        const voicesUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
        const voicesRes = await fetch(voicesUrl, { headers: { 'Ocp-Apim-Subscription-Key': key } });
        if (voicesRes.ok) {
          voices = await voicesRes.json();
          chrome.storage.local.set({ azureVoicesCache: voices }); // Cache for subsequent calls
        }
      }

      if (voices && Array.isArray(voices)) {
        const bestVoice = voices.find((v: any) => v.Locale.toLowerCase() === accentCode.toLowerCase() && v.ShortName.includes('Neural')) 
                       || voices.find((v: any) => v.Locale.toLowerCase().startsWith(baseLang.toLowerCase()) && v.ShortName.includes('Neural'))
                       || voices.find((v: any) => v.Locale.toLowerCase().startsWith(baseLang.toLowerCase()))
                       || { ShortName: 'en-US-AvaNeural' };
        selectedVoiceShortName = bestVoice.ShortName;
      } else {
        selectedVoiceShortName = 'en-US-AvaNeural';
      }
    }

    console.log(`Background [Azure]: Using voice: ${selectedVoiceShortName}`);

    // 3. Synthesize
    const ttsUrl = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const ssml = `<speak version='1.0' xml:lang='${accentCode}'><voice xml:lang='${accentCode}' name='${selectedVoiceShortName}'>${text}</voice></speak>`;
    
    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (!response.ok) throw new Error(`Azure TTS error: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();
    if (mySpeechId !== currentSpeechId) return;

    const base64data = `data:audio/mpeg;base64,${arrayBufferToBase64(arrayBuffer)}`;
    
    // Save to cache (with weighted scoring in future phase)
    await chrome.storage.local.set({ [cacheKey]: base64data });
    
    await playAudio(base64data, mySpeechId);
  } catch (e) {
    console.warn("Background [Azure]: Failed, falling back to Google", e);
    // Fallback logic could be complex, for now we just try handleSpeakGoogle
    // with empty preferences to ensure it works.
    await handleSpeakGoogle(text, accentCode, {}, mySpeechId);
  }
}

async function handleSpeakGoogle(text: string, accentCode: string, preferredVoices: Record<string, string>, mySpeechId: number) {
  const preferredVoiceName = preferredVoices[accentCode] || preferredVoices[accentCode.split('-')[0]];

  if (preferredVoiceName) {
    console.log(`Background [Google]: Using chrome.tts.speak with voice: ${preferredVoiceName}`);
    chrome.tts.speak(text, {
      voiceName: preferredVoiceName,
      lang: accentCode,
    });
    return;
  }

  const cacheKey = `audio_${accentCode}_${text.toLowerCase().trim()}`;
  const cached = await chrome.storage.local.get(cacheKey);
  if (mySpeechId !== currentSpeechId) return;

  if (cached[cacheKey]) {
    console.log(`Background [Google]: Using cached audio`);
    await playAudio(cached[cacheKey] as string, mySpeechId);
    return;
  }

  console.log(`Background [Google]: Fetching from Google TTS...`);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${accentCode.toLowerCase()}&client=tw-ob&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  if (mySpeechId !== currentSpeechId) return;

  const arrayBuffer = await response.arrayBuffer();
  if (mySpeechId !== currentSpeechId) return;

  const base64data = `data:audio/mpeg;base64,${arrayBufferToBase64(arrayBuffer)}`;

  try {
    await chrome.storage.local.set({ [cacheKey]: base64data });
  } catch (e: any) {
    if (e.message?.includes('quota')) {
      await CacheManager.clearAudioCache();
      await chrome.storage.local.set({ [cacheKey]: base64data });
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
