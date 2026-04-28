import { Message } from "../shared/types";
import { CacheManager } from "../shared/CacheManager";

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === "TRANSLATE") {
      const { text, from, to } = message.payload;
      handleTranslation(text, from, to).then(sendResponse);
      return true;
    }

    if (message.type === "GET_VOICES") {
      chrome.tts.getVoices((voices) => {
        sendResponse(voices);
      });
      return true;
    }

    if (message.type === "SPEAK") {
      const { text, langCode } = message.payload;
      console.log("Background: Speaking", text, "in", langCode);
      
      // Используем качественный Google TTS через offscreen
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(text)}`;
      playAudio(url);
      
      sendResponse({ success: true });
      return false;
    }

    return false;
  },
);

async function playAudio(url: string) {
  const OFFSCREEN_PATH = "src/offscreen/offscreen.html";

  try {
    const existingContexts = await (chrome.runtime as any).getContexts({
      contextTypes: ["OFFSCREEN"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_PATH,
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "Playing translation pronunciation",
      });
      // Ждем прогрузки
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    chrome.runtime.sendMessage({ type: "PLAY_AUDIO", url });
  } catch (e) {
    console.error("Offscreen error:", e);
  }
}

async function handleTranslation(text: string, from: string, to: string) {
  const cached = await CacheManager.getTranslation(text, from, to);
  if (cached) {
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
    const alternatives: string[] = [];

    if (data[1] && data[1][0] && data[1][0][1]) {
      alternatives.push(...data[1][0][1].slice(1, 11));
    }

    return {
      translatedText: mainTranslation,
      alternatives: alternatives,
      detectedLanguage: data[2],
    };
  } catch (error) {
    console.error("Translation error:", error);
    return { translatedText: "Error translating text.", alternatives: [] };
  }
}
