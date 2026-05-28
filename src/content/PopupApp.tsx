import React, { useState, useEffect, useCallback } from 'react';
import { IoSettingsOutline, IoCaretForwardOutline, IoCaretBack, IoVolumeMediumOutline, IoVolumeMuteOutline } from "react-icons/io5";
import { BsPin, BsPinAngle } from "react-icons/bs";
import { LANGUAGES, getLanguageName } from "../shared/languages";
import { getAccentsForLanguage } from "../shared/accents";
import { CacheManager } from "../shared/CacheManager";
import { HistoryItem } from "../shared/types";
import { DEFAULT_SETTINGS, UI_CONSTANTS, DEFAULT_HOTKEYS } from '../shared/constants';

interface PopupAppProps {
  x?: number;
  y?: number;
  initialText: string;
  onClose: () => void;
  version: string;
  theme?: 'light' | 'dark' | 'system';
}

function getScript(text: string): 'cyrillic' | 'latin' | null {
  const hasCyrillic = /[а-яА-ЯёЁ]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasCyrillic && !hasLatin) return 'cyrillic';
  if (hasLatin && !hasCyrillic) return 'latin';
  return null;
}

function isLanguageInScript(lang: string, script: 'cyrillic' | 'latin'): boolean {
  const cyrillicLangs = ['ru', 'be', 'uk', 'bg', 'mk', 'sr', 'kk', 'ky', 'tg'];
  const isCyrillicLang = cyrillicLangs.includes(lang.split('-')[0]);

  if (script === 'cyrillic') return isCyrillicLang;
  // Most other common languages in this extension's context use Latin
  return !isCyrillicLang;
}

export const PopupApp: React.FC<PopupAppProps> = ({ x: propX, y: propY, initialText, version, theme: initialTheme, onClose }) => {
  const popupRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: propX || 0, y: propY || 0 });
  const [isPinned, setIsPinned] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isResizing, setIsResizing] = useState(false);
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const [scale, setScale] = useState(DEFAULT_SETTINGS.UI_SCALE);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialTheme || DEFAULT_SETTINGS.THEME);
  const [nativeLang, setNativeLang] = useState(DEFAULT_SETTINGS.NATIVE_LANG);
  const [learningLang, setLearningLang] = useState(DEFAULT_SETTINGS.LEARNING_LANG);
  const [autoPlayback, setAutoPlayback] = useState<'off' | 'from' | 'to'>(DEFAULT_SETTINGS.AUTO_PLAYBACK);
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [originalText, setOriginalText] = useState(initialText);
  const [translatedText, setTranslatedText] = useState("");
  const [dictionary, setDictionary] = useState<{ pos: string, terms: string[] }[]>([]);
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState(DEFAULT_SETTINGS.NATIVE_LANG);
  const [detectedFrom, setDetectedFrom] = useState("");
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hotkeys, setHotkeys] = useState<Record<string, string>>(DEFAULT_HOTKEYS);
  const [supportedLangs, setSupportedLangs] = useState<string[]>([]);
  const isNavigatingHistory = React.useRef(false);
  const isInternalChange = React.useRef(false);

  const currentFrom = from === 'auto' ? detectedFrom : from;

  const updateSupportedLangs = useCallback(() => {
    if (!isContextValid()) return;
    chrome.runtime.sendMessage({ type: "GET_SUPPORTED_LANGUAGES" }, (langs) => {
      if (Array.isArray(langs)) setSupportedLangs(langs);
    });
  }, []);

  const isContextValid = () => typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

  const speak = (text: string, langCode: string, saveAsPreference: boolean = false) => {
    if (!isContextValid()) return;

    // Check if the language is actually supported by the current engine
    const baseLang = langCode.split('-')[0].toLowerCase();
    if (supportedLangs.length > 0 && !supportedLangs.includes(baseLang)) {
      console.log(`QT: Skipping audio for unsupported language: ${langCode}`);
      return;
    }

    chrome.runtime.sendMessage({ type: "SPEAK", payload: { text, langCode } });

    if (saveAsPreference && langCode.includes('-')) {
      const baseLang = langCode.split('-')[0];
      chrome.storage.local.get(['preferredAccents'], (result) => {
        const prefs = (result.preferredAccents || {}) as Record<string, string>;
        prefs[baseLang] = langCode;
        chrome.storage.local.set({ preferredAccents: prefs });
      });
    }
  };

  const updateHistoryLength = useCallback(async () => {
    if (!isContextValid()) return;
    const history = await CacheManager.getHistory();
    setHistoryLength(history.length);
  }, []);

  const replayAudio = () => {
    if (originalText && (autoPlayback === 'from' || autoPlayback === 'off')) {
      speak(originalText, currentFrom);
    } else if (translatedText && autoPlayback === 'to') {
      speak(translatedText, to);
    } else if (originalText) {
      speak(originalText, currentFrom);
    }
  };

  const openOptions = () => {
    if (!isContextValid()) return;
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  };

  const toggleAutoPlayback = () => {
    const modes: ('off' | 'from' | 'to')[] = ['off', 'from', 'to'];
    const nextMode = modes[(modes.indexOf(autoPlayback) + 1) % modes.length];
    setAutoPlayback(nextMode);

    if (isContextValid()) {
      chrome.storage.local.set({ autoPlayback: nextMode });
      chrome.runtime.sendMessage({ type: "STOP_AUDIO" });
    }

    if (nextMode === 'from' && originalText) {
      speak(originalText, currentFrom);
    } else if (nextMode === 'to' && translatedText) {
      speak(translatedText, to);
    }
  };

  const navigateHistory = async (direction: number) => {
    if (!isContextValid()) return;
    const history = await CacheManager.getHistory();
    const newIndex = historyIndex + direction;
    if (newIndex >= 0 && newIndex < history.length) {
      isNavigatingHistory.current = true;
      const item: HistoryItem = history[newIndex];
      setHistoryIndex(newIndex);
      setOriginalText(item.text);
      setFrom(item.from);
      setTo(item.to);

      let data = item.translation;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch (e) { data = { translatedText: data, dictionary: [] }; }
      }

      setTranslatedText(data.translatedText || "");
      setDictionary(data.dictionary || (data.alternatives ? [{ pos: 'alternatives', terms: data.alternatives }] : []));

      chrome.storage.local.get(["autoPlayback", "autoPlaybackLimit"], (settings) => {
        const autoPlayMode = (settings.autoPlayback as 'off' | 'from' | 'to') || DEFAULT_SETTINGS.AUTO_PLAYBACK;
        const autoLimit = (settings.autoPlaybackLimit as number) !== undefined ? (settings.autoPlaybackLimit as number) : DEFAULT_SETTINGS.AUTO_PLAYBACK_LIMIT;

        if (autoPlayMode !== 'off') {
          const textToSpeak = autoPlayMode === 'from' ? item.text : (data.translatedText || "");
          const langToSpeak = autoPlayMode === 'from' ? item.from : item.to;
          if (textToSpeak && textToSpeak.length <= autoLimit) {
            speak(textToSpeak, langToSpeak);
          }
        }
      });

      setTimeout(() => { isNavigatingHistory.current = false; }, 100);
    }
  };

  const requestTranslation = useCallback((text: string, src: string, target: string) => {
    if (!text || !isContextValid()) return;
    chrome.runtime.sendMessage(
      { type: "TRANSLATE", payload: { text, from: src, to: target } },
      (res) => {
        if (res && isContextValid()) {
          const textScript = getScript(text);
          let detected = res.detectedLanguage || (textScript === 'latin' ? learningLang : nativeLang);

          if (textScript && !isLanguageInScript(detected, textScript) && text.length < 30) {
            const fallback = textScript === 'latin' ? learningLang : nativeLang;
            console.log(`QT: Script mismatch detected. Text is ${textScript}, but API said ${detected}. Overriding to ${fallback}.`);
            detected = fallback;
          }

          let finalFrom = src;
          let finalTo = target;

          // Logic for swapping or updating languages
          if (src === 'auto') {
            setDetectedFrom(detected);
            finalFrom = detected;
            // If auto-detected the target, swap it to something else
            if (detected === target) {
              finalTo = (detected === nativeLang ? learningLang : nativeLang);
              setTo(finalTo);
            }
          } else if (detected === target && src !== target) {
            // User explicitly set En->Ru, but we detected Ru. Swap them.
            console.log('QT: Detected target language in explicit mode, swapping...', { detected, target, src });
            finalFrom = target;
            finalTo = src;
            setFrom(finalFrom);
            setTo(finalTo);
          }

          setTranslatedText(res.translatedText);
          setDictionary(res.dictionary || []);
          setHistoryIndex(0);
          updateHistoryLength();

          if (autoPlayback !== 'off') {
            const textToSpeak = autoPlayback === 'from' ? text : res.translatedText;
            const langToSpeak = autoPlayback === 'from' ? finalFrom : finalTo;

            chrome.storage.local.get(["autoPlaybackLimit"], (settings) => {
              const autoLimit = settings.autoPlaybackLimit ?? DEFAULT_SETTINGS.AUTO_PLAYBACK_LIMIT;
              if (textToSpeak.length <= autoLimit) {
                speak(textToSpeak, langToSpeak);
              }
            });
          }
        }
      }
    );
  }, [updateHistoryLength, nativeLang, learningLang, autoPlayback]);

  // Listen for hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in a select/input, don't trigger hotkeys except ESC
      const isTyping = e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (isTyping) return;

      if (e.code === hotkeys.PIN) { e.preventDefault(); setIsPinned(prev => !prev); }
      else if (e.code === hotkeys.SETTINGS) { e.preventDefault(); openOptions(); }
      else if (e.code === hotkeys.HISTORY_BACK) { if (historyIndex < historyLength - 1) { e.preventDefault(); navigateHistory(1); } }
      else if (e.code === hotkeys.HISTORY_FORWARD) { if (historyIndex > 0) { e.preventDefault(); navigateHistory(-1); } }
      else if (e.code === hotkeys.TOGGLE_AUTOPLAY) { e.preventDefault(); toggleAutoPlayback(); }
      else if (e.code === hotkeys.REPLAY) { e.preventDefault(); replayAudio(); }
    };

    // Focus the popup so it captures keys immediately
    if (popupRef.current) {
      popupRef.current.focus();
    }

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase for better reliability
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [hotkeys, historyIndex, historyLength, autoPlayback, originalText, translatedText, from, to, detectedFrom, onClose]);

  useEffect(() => {
    if (!isContextValid()) return;
    const hostname = window.location.hostname;
    chrome.storage.local.get(['uiScale', 'theme', 'autoPlayback', `lang_${hostname}`, 'nativeLang', 'learningLang', 'hotkeys'], (settings) => {
      if (!isContextValid()) return;
      isInternalChange.current = true;
      if (settings.uiScale) setScale(settings.uiScale as number);
      if (settings.theme) setTheme(settings.theme as 'light' | 'dark' | 'system');
      if (settings.autoPlayback) setAutoPlayback(settings.autoPlayback as 'off' | 'from' | 'to');
      if (settings.hotkeys) setHotkeys(settings.hotkeys as Record<string, string>);
      if (settings.nativeLang) setNativeLang(settings.nativeLang as string);
      if (settings.learningLang) setLearningLang(settings.learningLang as string);

      const pageLangs = settings[`lang_${hostname}`] as { from: string, to: string } | undefined;
      if (pageLangs) { setFrom(pageLangs.from); setTo(pageLangs.to); }
      else if (settings.nativeLang) { setTo(settings.nativeLang as string); }

      setIsInitialized(true);
      updateHistoryLength();
      updateSupportedLangs();
      setTimeout(() => { isInternalChange.current = false; }, 100);
    });
  }, [updateSupportedLangs]);

  useEffect(() => {
    if (isInitialized) updateSupportedLangs();
  }, [from, to, isInitialized, updateSupportedLangs]);

  useEffect(() => {
    if (!isInitialized || !isContextValid() || isInternalChange.current) return;
    const hostname = window.location.hostname;
    chrome.storage.local.set({ [`lang_${hostname}`]: { from, to } });
  }, [from, to, isInitialized]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  useEffect(() => { if (propX !== undefined && propY !== undefined) setPos({ x: propX, y: propY }); }, [propX, propY]);

  useEffect(() => { if (initialText) setOriginalText(initialText); }, [initialText]);

  useEffect(() => {
    if (isInitialized && originalText) {
      if (isNavigatingHistory.current) return;
      requestTranslation(originalText, from, to);
    }
  }, [originalText, from, to, isInitialized]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.header-controls') || target.tagName === 'SELECT' || target.tagName === 'OPTION' || target.classList.contains('resize-handle-bottom')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleResizeStart = (e: React.MouseEvent) => { e.preventDefault(); setIsResizing(true); };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) setPos({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      if (isResizing) {
        const popupElement = document.querySelector('.translator-popup-container')?.shadowRoot?.querySelector('.popup') as HTMLElement;
        if (popupElement) {
          const rect = popupElement.getBoundingClientRect();
          const newHeight = (e.clientY - rect.top) / scale;
          setManualHeight(Math.max(UI_CONSTANTS.MIN_POPUP_HEIGHT, newHeight));
        }
      }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, isResizing, dragStart, scale]);

  useEffect(() => {
    const container = document.querySelector('.translator-popup-container');
    if (container) (container as any).isPinned = isPinned;
  }, [isPinned]);

  useEffect(() => { return () => { if (isContextValid()) chrome.runtime.sendMessage({ type: "STOP_AUDIO" }); }; }, []);

  const wordForForvo = originalText.split(/\s+/)[0].toLowerCase().replace(/[.,\/#!$%\^&*;:{}=_`~()]/g, "");
  const forvoHref = `https://forvo.com/word/${encodeURIComponent(wordForForvo)}/#${currentFrom}`;

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[.,\/#!$%\^&*;:{}=_`~()]/g, "");
    if (!cleanWord) return;

    if (from !== 'auto') {
      const oldFrom = from;
      setFrom(to);
      setTo(oldFrom);
    } else {
      // If we are in Auto mode, we stay in Auto mode but swap the target
      setTo(currentFrom === to ? (to === nativeLang ? learningLang : nativeLang) : to);
    }
    setOriginalText(cleanWord);
  };

  const renderLine = (text: string, lang: string, key?: string, isTranslation?: boolean) => {
    const accents = getAccentsForLanguage(lang);
    const list = accents.length > 0 ? accents : [{ code: lang, label: <IoVolumeMediumOutline /> }];
    const isSupported = supportedLangs.includes(lang.split('-')[0].toLowerCase());

    return (
      <div className="line" key={key || text}>
        <div className="word-text">
          {isTranslation ? text.split(/(\s+)/).map((part, i) => part.trim() ? <span key={i} className="clickable-word" onClick={() => handleWordClick(part)}>{part}</span> : part) : text}
        </div>
        {isSupported && (
          <div className="accent-buttons">
            {list.map((a) => <button key={a.code} className="accent-btn" onClick={() => speak(text, a.code, true)}>{a.label}</button>)}
          </div>
        )}
      </div>
    );
  };

  const getAutoPlaybackIcon = () => {
    switch (autoPlayback) {
      case 'from': return <><IoVolumeMediumOutline /> <small style={{ marginLeft: '2px', fontSize: '70%' }}>A</small></>;
      case 'to': return <><IoVolumeMediumOutline /> <small style={{ marginLeft: '2px', fontSize: '70%' }}>B</small></>;
      default: return <IoVolumeMuteOutline />;
    }
  };

  const popupStyle: React.CSSProperties = {
    left: pos.x, top: pos.y,
    height: manualHeight !== null ? `${manualHeight}px` : 'auto',
    maxHeight: manualHeight !== null ? 'none' : `${UI_CONSTANTS.MAX_POPUP_HEIGHT}px`,
    zoom: scale
  };

  const getShortCode = (code: string) => {
    if (code === 'auto') {
      return `*${detectedFrom.split('-')[0].toUpperCase()}`;
    }
    return code.split('-')[0].toUpperCase();
  };
  const currentAppliedTheme = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  return (
    <div className="popup" style={popupStyle} ref={popupRef} data-theme={currentAppliedTheme}>
      <div className="header" onMouseDown={handleMouseDown} style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
        <div className="lang-selects">
          <div className="select-wrapper" title={getLanguageName(from)}>
            <span className="lang-code-display">{getShortCode(from)}</span>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          <span>→</span>
          <div className="select-wrapper" title={getLanguageName(to)}>
            <span className="lang-code-display">{getShortCode(to)}</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {Object.entries(LANGUAGES).filter(([code]) => code !== 'auto').map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
        </div>
        <div className="header-controls">
          <button className="nav-btn" onClick={toggleAutoPlayback} title="Toggle Auto-play">{getAutoPlaybackIcon()}</button>
          <button className="nav-btn" disabled={historyIndex >= historyLength - 1} onClick={() => navigateHistory(1)} title="History Back"><IoCaretBack /></button>
          <button className="nav-btn" disabled={historyIndex <= 0} onClick={() => navigateHistory(-1)} title="History Forward"><IoCaretForwardOutline /></button>
          <button className="nav-btn" onClick={openOptions} title="Settings"><IoSettingsOutline /></button>
          <button className={`nav-btn ${isPinned ? 'pinned' : ''}`} onClick={() => setIsPinned(!isPinned)} title={isPinned ? 'Unpin' : 'Pin'} style={{ color: isPinned ? '#3498db' : '#7f8c8d' }}>
            {isPinned ? <BsPin /> : <BsPinAngle />}
          </button>
        </div>
      </div>
      <div className="content-scrollable">
        <div className="section">{renderLine(originalText, currentFrom)}</div>
        <div className="section" style={{ borderTop: '1px solid #eee' }}>
          {renderLine(translatedText, to, 'main-translation', true)}
          {dictionary.map((group, idx) => (
            <div key={idx} style={{ marginTop: '12px' }}>
              <div className="pos-header"><span>{group.pos}</span><div className="pos-line"></div></div>
              {group.terms.map((term, tIdx) => renderLine(term, to, `${idx}-${tIdx}`, true))}
            </div>
          ))}
        </div>
      </div>
      <div className="footer">
        <a href={forvoHref} className="forvo-link" target="_blank" rel="noreferrer">Forvo: "{wordForForvo}"</a>
        <span style={{ fontSize: '9px', color: '#bdc3c7' }}>v{version}</span>
      </div>
      <div className="resize-handle-bottom" onMouseDown={handleResizeStart}></div>
      <style>{`
        .popup {
          --popup-bg: #ffffff; --header-bg: #f1f3f5; --footer-bg: #f8f9fa; --text-color: #2c3e50; --text-secondary: #7f8c8d;
          --border-color: #d0d0d0; --header-border: #e0e0e0; --btn-bg: #ffffff; --btn-border: #cccccc; --btn-hover-bg: #e0e0e0;
          --pos-text: #b2bec3; --pos-line: #f1f2f6; --accent-btn-border: #dddddd; --primary-color: #3498db;
          position: fixed; background: var(--popup-bg); border-radius: 8px; box-shadow: 0 4px 30px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px; color: var(--text-color); z-index: 2147483647; overflow: hidden; border: 1px solid var(--border-color);
          display: flex; flex-direction: column; resize: horizontal; min-width: 250px; min-height: 150px; width: 350px; pointer-events: auto;
          transition: background 0.3s, color 0.3s, border-color 0.3s;
        }
        .popup[data-theme='dark'] {
          --popup-bg: #2c2c2c; --header-bg: #1e1e1e; --footer-bg: #1e1e1e; --text-color: #e0e0e0; --text-secondary: #a0a0a0;
          --border-color: #444444; --header-border: #333333; --btn-bg: #3d3d3d; --btn-border: #555555; --btn-hover-bg: #4d4d4d;
          --pos-text: #888888; --pos-line: #3d3d3d; --accent-btn-border: #555555; --primary-color: #3498db;
        }
        .header { background: var(--header-bg); padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--header-border); flex-shrink: 0; user-select: none; }
        .lang-selects { display: flex; align-items: center; gap: 4px; user-select: none; }
        .select-wrapper { position: relative; display: flex; align-items: center; padding: 2px 4px; border-radius: 3px; transition: background 0.2s; }
        .select-wrapper:hover { background: var(--btn-hover-bg); }
        .lang-code-display { font-size: 11px; font-weight: bold; color: var(--text-color); cursor: pointer; }
        .select-wrapper select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        .header-controls { display: flex; align-items: center; gap: 4px; }
        .nav-btn { background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; font-size: 22px; color: var(--text-secondary); user-select: none; display: flex; align-items: center; justify-content: center; transition: background 0.2s, color 0.2s; }
        .nav-btn:hover { background: var(--btn-hover-bg); color: var(--primary-color); }
        .nav-btn:disabled { opacity: 0.3; cursor: default; }
        .nav-btn.pinned { color: var(--primary-color); }
        .content-scrollable { flex: 1; overflow-y: auto; }
        .section { padding: 10px 12px; }
        .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 2px; }
        .word-text { line-height: 1.4; word-break: break-word; flex: 1; }
        .clickable-word { cursor: pointer; border-bottom: 1px dashed transparent; transition: border-color 0.2s; }
        .clickable-word:hover { border-bottom-color: var(--primary-color); color: var(--primary-color); }
        .pos-header { display: flex; align-items: center; gap: 8px; font-size: 10px; color: var(--pos-text); text-transform: uppercase; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.5px; user-select: none; }
        .pos-line { flex: 1; height: 1px; background: var(--pos-line); }
        .accent-buttons { display: flex; gap: 3px; user-select: none; }
        .accent-btn { width: 22px; height: 18px; display: flex; align-items: center; justify-content: center; background: var(--btn-bg); border: 1px solid var(--accent-btn-border); border-radius: 3px; font-size: 9px; font-weight: bold; cursor: pointer; color: var(--text-secondary); user-select: none; }
        .accent-btn:hover { background: var(--primary-color); color: white; }
        .footer { padding: 4px 12px; background: var(--footer-bg); border-top: 1px solid var(--header-border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; user-select: none; }
        .forvo-link { color: var(--primary-color); text-decoration: none; font-size: 11px; cursor: pointer; user-select: none; }
        .resize-handle-bottom { position: absolute; bottom: 0; left: 0; right: 0; height: 6px; cursor: ns-resize; background: transparent; }
        .resize-handle-bottom:hover { background: rgba(52, 152, 219, 0.1); }
      `}</style>
    </div>
  );
};
