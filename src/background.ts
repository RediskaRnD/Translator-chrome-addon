import { Message } from "./shared/types";
import { CacheManager } from "./shared/CacheManager";

const VERSION = chrome.runtime.getManifest().version;

// Красивый лог инициализации
console.log(
  `%c--- SYSTEM LOADED V${VERSION} ---`,
  "background: #222; color: #bada55; font-size: 20px; font-weight: bold; padding: 4px; border-radius: 4px;"
);

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
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

    if (message.type === "OPEN_OPTIONS") {
      chrome.runtime.openOptionsPage();
      return false;
    }
    return false;
  },
);

async function handleSpeak(text: string, langCode: string) {
  try {
    const cacheKey = `audio_${langCode}_${text.toLowerCase().trim()}`;
    const cached = await chrome.storage.local.get(cacheKey);
    
    if (cached[cacheKey]) {
      console.log("Using cached audio for:", text);
      await playAudio(cached[cacheKey] as string);
      return;
    }

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64data = `data:audio/mpeg;base64,${btoa(binary)}`;

    // Save to cache
    await chrome.storage.local.set({ [cacheKey]: base64data });
    console.log("Audio cached for:", text);

    await playAudio(base64data);
  } catch (e: any) {
    console.error("Background Speak Error:", e);
  }
}

async function playAudio(dataUrl: string) {
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
    chrome.runtime.sendMessage({ type: "PLAY_AUDIO", url: dataUrl });
  } catch (e) {
    console.error("Offscreen Document Error:", e);
  }
}

async function handleTranslation(text: string, from: string, to: string) {
  const cached = await CacheManager.getTranslation(text, from, to);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { return { translatedText: cached, alternatives: [] }; }
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
    const dictionary: { pos: string, terms: string[] }[] = [];
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
      detectedLanguage: data[2] 
    };
  } catch (error) {
    return { translatedText: "Error", dictionary: [] };
  }
}
