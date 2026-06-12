import { TranslationResponse, FreeDictionaryData } from './types';

export async function translate(text: string, from: string, to: string): Promise<TranslationResponse> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&dt=at&dt=bd&dt=rm&q=${encodeURIComponent(text)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();

    // Extract main translation
    const mainTranslation = data[0]
      .filter((item: any) => item[0])
      .map((item: any) => item[0])
      .join("");

    // Extract transcription (transliteration of source text)
    let transcriptionFrom = "";
    let transcriptionTo = "";
    if (data[0] && data[0].length > 1) {
      transcriptionFrom = data[0][1][3] || "";
      transcriptionTo = data[0][1][2] || "";
    }

    const dictionary: { pos: string; terms: string[] }[] = [];
    if (data[1]) {
      data[1].forEach((item: any) => {
        const pos = item[0];
        const terms = item[1];
        dictionary.push({ pos, terms });
      });
    }
    return {
      translatedText: mainTranslation,
      dictionary: dictionary,
      detectedLanguage: data[2],
      transcription: { from: transcriptionFrom, to: transcriptionTo },
    };
  } catch (error) {
    console.error("Translation Error:", error);
    return { translatedText: "Error", dictionary: [] };
  }
}

export async function fetchFreeDictionary(word: string, lang: string = 'en'): Promise<FreeDictionaryData[] | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(word)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data as FreeDictionaryData[];
  } catch (error) {
    console.error("Free Dictionary API Error:", error);
    return null;
  }
}
