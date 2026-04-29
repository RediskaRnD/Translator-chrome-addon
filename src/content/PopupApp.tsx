import React, { useState, useEffect, useCallback } from 'react';
import { LANGUAGES, getLanguageName } from "../shared/languages";
import { getAccentsForLanguage } from "../shared/accents";
import { CacheManager } from "../shared/CacheManager";
import { HistoryItem } from "../shared/types";

interface PopupAppProps {
  x?: number;
  y?: number;
  initialText: string;
  onClose: () => void;
  version: string;
}

export const PopupApp: React.FC<PopupAppProps> = ({ x: propX, y: propY, initialText, version }) => {
  const popupRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: propX || 0, y: propY || 0 });
  const [isPinned, setIsPinned] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [isResizing, setIsResizing] = useState(false);
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  const [originalText, setOriginalText] = useState(initialText);
  const [translatedText, setTranslatedText] = useState("");
  const [dictionary, setDictionary] = useState<{ pos: string, terms: string[] }[]>([]);
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("ru");
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(0);

  // Load settings
  useEffect(() => {
    chrome.storage.local.get(['uiScale', 'theme'], (settings) => {
      if (settings.uiScale) setScale(settings.uiScale as number);
      if (settings.theme) setTheme(settings.theme as 'light' | 'dark' | 'system');
    });
  }, []);

  // Apply theme to the popup element
  useEffect(() => {
    const popupElement = popupRef.current;
    if (!popupElement) return;

    const applyTheme = (currentTheme: 'light' | 'dark' | 'system') => {
      if (currentTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        popupElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      } else {
        popupElement.setAttribute('data-theme', currentTheme);
      }
    };

    applyTheme(theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return;
  }, [theme]); // No need for translatedText anymore as popupElement is stable via ref

  // Update position if new coordinates are provided (not pinned)
  useEffect(() => {
    if (propX !== undefined && propY !== undefined) {
      setPos({ x: propX, y: propY });
    }
  }, [propX, propY]);

  // Update text and trigger translation when initialText prop changes
  useEffect(() => {
    setOriginalText(initialText);
  }, [initialText]);

  // Drag & Resize logic
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.header-controls') || target.tagName === 'SELECT' || target.tagName === 'OPTION' || target.classList.contains('resize-handle-bottom')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const updateHistoryLength = useCallback(async () => {
    const history = await CacheManager.getHistory();
    setHistoryLength(history.length);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
      if (isResizing) {
        const popupElement = document.querySelector('.translator-popup-container')?.shadowRoot?.querySelector('.popup') as HTMLElement;
        if (popupElement) {
          const rect = popupElement.getBoundingClientRect();
          const newHeight = (e.clientY - rect.top) / scale;
          setManualHeight(Math.max(150, newHeight));
        }
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, scale]);

  // Communicating with index.tsx via a custom property on the container
  useEffect(() => {
    const container = document.querySelector('.translator-popup-container');
    if (container) {
      (container as any).isPinned = isPinned;
    }
  }, [isPinned]);

  const requestTranslation = useCallback((text: string, src: string, target: string) => {
    chrome.runtime.sendMessage(
      {
        type: "TRANSLATE",
        payload: { text, from: src, to: target },
      },
      (res) => {
        if (res) {
          const detected = res.detectedLanguage || "en";
          chrome.storage.local.get(["nativeLang", "learningLang"], (settings) => {
            const native = (settings.nativeLang as string) || "ru";
            const learning = (settings.learningLang as string) || "en";

            if (src === "auto" && detected === native) {
              setFrom(detected);
              setTo(learning);
              requestTranslation(text, detected, learning);
              return;
            }

            setTranslatedText(res.translatedText);
            setDictionary(res.dictionary || []);
            setHistoryIndex(0);
            updateHistoryLength();
          });
        }
      }
    );
  }, [updateHistoryLength]);

  useEffect(() => {
    chrome.storage.local.get(["nativeLang"], (settings) => {
      const native = (settings.nativeLang as string) || "ru";
      setTo(native);
      requestTranslation(initialText, "auto", native);
    });
  }, [initialText, requestTranslation]);

  const speak = (text: string, langCode: string) => {
    chrome.runtime.sendMessage({ type: "SPEAK", payload: { text, langCode } });
  };

  const navigateHistory = async (direction: number) => {
    const history = await CacheManager.getHistory();
    const newIndex = historyIndex + direction;
    if (newIndex >= 0 && newIndex < history.length) {
      const item: HistoryItem = history[newIndex];
      setHistoryIndex(newIndex);
      setOriginalText(item.text);
      setFrom(item.from);
      setTo(item.to);

      let data = item.translation;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          data = { translatedText: data, dictionary: [] };
        }
      }

      setTranslatedText(data.translatedText || "");

      if (data.dictionary) {
        setDictionary(data.dictionary);
      } else if (data.alternatives) {
        setDictionary([{ pos: 'alternatives', terms: data.alternatives }]);
      } else {
        setDictionary([]);
      }
    }
  };

  const wordForForvo = originalText.split(/\s+/)[0].toLowerCase().replace(/[.,\/#!$%\^&*;:{}=\-_`~()]/g, "");
  const forvoHref = `https://forvo.com/word/${encodeURIComponent(wordForForvo)}/#${from === "auto" ? "en" : from}`;

  const handleWordClick = (word: string) => {
    const cleanWord = word.replace(/[.,\/#!$%\^&*;:{}=\-_`~()]/g, "");
    if (!cleanWord) return;

    const newFrom = to;
    const newTo = from === 'auto' ? 'en' : from;
    setFrom(newFrom);
    setTo(newTo);
    setOriginalText(cleanWord);
    requestTranslation(cleanWord, newFrom, newTo);
  };

  const renderLine = (text: string, lang: string, key?: string, isTranslation?: boolean) => {
    const accents = getAccentsForLanguage(lang);
    const list = accents.length > 0 ? accents : [{ code: lang, label: "🔊" }];

    return (
      <div className="line" key={key || text}>
        <div className="word-text">
          {isTranslation ? (
            text.split(/(\s+)/).map((part, i) => (
              part.trim() ? (
                <span
                  key={i}
                  className="clickable-word"
                  onClick={() => handleWordClick(part)}
                >
                  {part}
                </span>
              ) : part
            ))
          ) : text}
        </div>
        <div className="accent-buttons">
          {list.map((a) => (
            <button key={a.code} className="accent-btn" onClick={() => speak(text, a.code)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const openOptions = () => {
    chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  };

  const popupStyle: React.CSSProperties = {
    left: pos.x,
    top: pos.y,
    height: manualHeight !== null ? `${manualHeight}px` : 'auto',
    maxHeight: manualHeight !== null ? 'none' : '555px',
    zoom: scale
  };

  const getShortCode = (code: string) => {
    if (code === 'auto') return 'AUTO';
    return code.split('-')[0].toUpperCase();
  };

  return (
    <div className="popup" style={popupStyle} ref={popupRef}>
      <div className="header" onMouseDown={handleMouseDown} style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
        <div className="lang-selects">
          <div className="select-wrapper" title={getLanguageName(from)}>
            <span className="lang-code-display">{getShortCode(from)}</span>
            <select value={from} onChange={(e) => { setFrom(e.target.value); requestTranslation(originalText, e.target.value, to); }}>
              {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
          <span>→</span>
          <div className="select-wrapper" title={getLanguageName(to)}>
            <span className="lang-code-display">{getShortCode(to)}</span>
            <select value={to} onChange={(e) => { setTo(e.target.value); requestTranslation(originalText, from, e.target.value); }}>
              {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </div>
        </div>
        <div className="header-controls">
          <button className="nav-btn" disabled={historyIndex >= historyLength - 1} onClick={() => navigateHistory(1)} title="History Back">←</button>
          <button className="nav-btn" disabled={historyIndex <= 0} onClick={() => navigateHistory(-1)} title="History Forward">→</button>
          <button className="nav-btn" onClick={openOptions} title="Settings">⚙️</button>
          <button
            className={`nav-btn ${isPinned ? 'pinned' : ''}`}
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin' : 'Pin'}
            style={{ color: isPinned ? '#3498db' : '#7f8c8d', fontWeight: isPinned ? 'bold' : 'normal' }}
          >
            📌
          </button>
        </div>
      </div>

      <div className="content-scrollable">
        <div className="section">
          {renderLine(originalText, from === "auto" ? "en" : from)}
        </div>

        <div className="section" style={{ borderTop: '1px solid #eee' }}>
          {renderLine(translatedText, to, 'main-translation', true)}

          {dictionary.map((group, idx) => (
            <div key={idx} style={{ marginTop: '12px' }}>
              <div className="pos-header">
                <span>{group.pos}</span>
                <div className="pos-line"></div>
              </div>
              {group.terms.map((term, tIdx) => renderLine(term, to, `${idx}-${tIdx}`, true))}
            </div>
          ))}
        </div>
      </div>

      <div className="footer">
        <a href={forvoHref} className="forvo-link" target="_blank" rel="noreferrer">Forvo: "{wordForForvo}"</a>
        <span style={{ fontSize: '9px', color: '#bdc3c7' }}>v{version}</span>
      </div>

      <div
        className="resize-handle-bottom"
        onMouseDown={handleResizeStart}
      ></div>

      <style>{`
        .popup {
          --popup-bg: #ffffff;
          --header-bg: #f1f3f5;
          --footer-bg: #f8f9fa;
          --text-color: #2c3e50;
          --text-secondary: #7f8c8d;
          --border-color: #d0d0d0;
          --header-border: #e0e0e0;
          --btn-bg: #ffffff;
          --btn-border: #cccccc;
          --btn-hover-bg: #e0e0e0;
          --pos-text: #b2bec3;
          --pos-line: #f1f2f6;
          --accent-btn-border: #dddddd;
          --primary-color: #3498db;

          position: fixed;
          background: var(--popup-bg);
          border-radius: 8px;
          box-shadow: 0 4px 30px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          color: var(--text-color);
          z-index: 2147483647;
          overflow: hidden;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          resize: horizontal;
          min-width: 250px;
          min-height: 150px;
          width: 350px;
          pointer-events: auto;
          transition: background 0.3s, color 0.3s, border-color 0.3s;
        }

        .popup[data-theme='dark'] {
          --popup-bg: #2c2c2c;
          --header-bg: #1e1e1e;
          --footer-bg: #1e1e1e;
          --text-color: #e0e0e0;
          --text-secondary: #a0a0a0;
          --border-color: #444444;
          --header-border: #333333;
          --btn-bg: #3d3d3d;
          --btn-border: #555555;
          --btn-hover-bg: #4d4d4d;
          --pos-text: #888888;
          --pos-line: #3d3d3d;
          --accent-btn-border: #555555;
          --primary-color: #3498db;
        }

        .header {
          background: var(--header-bg);
          padding: 6px 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--header-border);
          flex-shrink: 0;
          user-select: none;
        }
        .lang-selects { display: flex; align-items: center; gap: 4px; user-select: none; }
        .select-wrapper { position: relative; display: flex; align-items: center; padding: 2px 4px; border-radius: 3px; transition: background 0.2s; }
        .select-wrapper:hover { background: var(--btn-hover-bg); }
        .lang-code-display { font-size: 11px; font-weight: bold; color: var(--text-color); cursor: pointer; }
        .select-wrapper select {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        .header-controls { display: flex; align-items: center; gap: 2px; }
        .nav-btn {
          background: var(--btn-bg); border: 1px solid var(--btn-border); border-radius: 3px;
          padding: 2px 5px; cursor: pointer; font-size: 13px; color: var(--text-secondary);
          user-select: none;
          display: flex; align-items: center; justify-content: center;
        }
        .nav-btn:hover { background: var(--btn-hover-bg); }
        .nav-btn:disabled { opacity: 0.5; cursor: default; }
        .nav-btn.pinned { border-color: var(--primary-color); }
        .content-scrollable {
          flex: 1;
          overflow-y: auto;
        }
        .section { padding: 10px 12px; }
        .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 2px; }
        .line:last-child { margin-bottom: 0; }
        .word-text { line-height: 1.4; word-break: break-word; flex: 1; }
        .clickable-word { cursor: pointer; border-bottom: 1px dashed transparent; transition: border-color 0.2s; }
        .clickable-word:hover { border-bottom-color: var(--primary-color); color: var(--primary-color); }
        .pos-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: var(--pos-text);
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
          user-select: none;
        }
        .pos-line { flex: 1; height: 1px; background: var(--pos-line); }
        .accent-buttons { display: flex; gap: 3px; user-select: none; }
        .accent-btn {
          width: 28px; height: 18px; display: flex; align-items: center; justify-content: center;
          background: var(--btn-bg); border: 1px solid var(--accent-btn-border); border-radius: 3px;
          font-size: 9px; font-weight: bold; cursor: pointer; color: var(--text-secondary);
          user-select: none;
        }
        .accent-btn:hover { background: var(--primary-color); color: white; }
        .footer { padding: 4px 12px; background: var(--footer-bg); border-top: 1px solid var(--header-border); display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; user-select: none; }
        .forvo-link { color: var(--primary-color); text-decoration: none; font-size: 11px; cursor: pointer; user-select: none; }
        .resize-handle-bottom {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 6px;
          cursor: ns-resize;
          background: transparent;
        }
        .resize-handle-bottom:hover {
          background: rgba(52, 152, 219, 0.1);
        }
      `}</style>
    </div>
  );
};
