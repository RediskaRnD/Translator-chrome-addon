import React, { useState, useEffect, useCallback } from 'react';
import { LANGUAGES } from "../shared/languages";
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

export const PopupApp: React.FC<PopupAppProps> = ({ x: propX, y: propY, initialText, onClose, version }) => {
  const [pos, setPos] = useState({ x: propX || 0, y: propY || 0 });
  const [isPinned, setIsPinned] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [originalText, setOriginalText] = useState(initialText);

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
  const [translatedText, setTranslatedText] = useState("");
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [from, setFrom] = useState("auto");
  const [to, setTo] = useState("ru");
  const [historyIndex, setHistoryIndex] = useState(0);
  const [historyLength, setHistoryLength] = useState(0);

  // Drag logic
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.header-controls') || target.tagName === 'SELECT' || target.tagName === 'OPTION') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Communicating with index.tsx via a custom property on the container
  useEffect(() => {
    const container = document.querySelector('.translator-popup-container');
    if (container) {
      (container as any).isPinned = isPinned;
    }
  }, [isPinned]);

  const updateHistoryLength = useCallback(async () => {
    const history = await CacheManager.getHistory();
    setHistoryLength(history.length);
  }, []);

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
            setAlternatives(res.alternatives || []);
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
      setTranslatedText(item.translation.translatedText);
      setAlternatives(item.translation.alternatives || []);
    }
  };

  const wordForForvo = originalText.split(/\s+/)[0].toLowerCase().replace(/[^\wа-яё]/gi, "");
  const forvoHref = `https://forvo.com/word/${encodeURIComponent(wordForForvo)}/#${from === "auto" ? "en" : from}`;

  const renderLine = (text: string, lang: string) => {
    const accents = getAccentsForLanguage(lang);
    const list = accents.length > 0 ? accents : [{ code: lang, label: "🔊" }];

    return (
      <div className="line" key={text}>
        <div className="word-text">{text}</div>
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

  return (
    <div className="popup" style={{ left: pos.x, top: pos.y }}>
      <div className="header" onMouseDown={handleMouseDown} style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
        <div className="lang-selects">
          <select value={from} onChange={(e) => { setFrom(e.target.value); requestTranslation(originalText, e.target.value, to); }}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <span>→</span>
          <select value={to} onChange={(e) => { setTo(e.target.value); requestTranslation(originalText, from, e.target.value); }}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div className="header-controls">
          <button 
            className={`nav-btn ${isPinned ? 'pinned' : ''}`} 
            onClick={() => setIsPinned(!isPinned)}
            title={isPinned ? 'Unpin' : 'Pin'}
            style={{ color: isPinned ? '#3498db' : '#7f8c8d', fontWeight: isPinned ? 'bold' : 'normal' }}
          >
            📌
          </button>
          <button className="nav-btn" disabled={historyIndex >= historyLength - 1} onClick={() => navigateHistory(1)}>←</button>
          <button className="nav-btn" disabled={historyIndex <= 0} onClick={() => navigateHistory(-1)}>→</button>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
      </div>
      
      <div className="content-scrollable">
        <div className="section">
          {renderLine(originalText, from === "auto" ? "en" : from)}
        </div>
        
        <div className="section" style={{ borderTop: '1px solid #eee' }}>
          {renderLine(translatedText, to)}
          {alternatives.map(alt => renderLine(alt, to))}
        </div>
      </div>

      <div className="footer">
        <a href={forvoHref} className="forvo-link" target="_blank" rel="noreferrer">Forvo: "{wordForForvo}"</a>
        <span style={{ fontSize: '9px', color: '#bdc3c7' }}>v{version}</span>
      </div>

      <style>{`
        .popup {
          position: fixed;
          background: #ffffff;
          border-radius: 8px;
          box-shadow: 0 4px 30px rgba(0,0,0,0.3);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          color: #2c3e50;
          z-index: 2147483647;
          overflow: hidden;
          border: 1px solid #d0d0d0;
          display: flex;
          flex-direction: column;
          resize: both;
          min-width: 250px;
          min-height: 150px;
          width: 350px;
          pointer-events: auto;
        }
        .header {
          background: #f1f3f5;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e0e0e0;
          flex-shrink: 0;
          user-select: none;
        }
        .lang-selects { display: flex; align-items: center; gap: 6px; }
        .nav-btn {
          background: #fff; border: 1px solid #ccc; border-radius: 3px;
          padding: 1px 6px; cursor: pointer; font-size: 14px; color: #7f8c8d;
          margin-right: 4px;
          user-select: none;
        }
        .nav-btn:disabled { opacity: 0.5; cursor: default; }
        .nav-btn.pinned { border-color: #3498db; }
        .close-btn { background: none; border: none; color: #95a5a6; font-size: 20px; cursor: pointer; line-height: 1; user-select: none; }
        .content-scrollable {
          flex: 1;
          overflow-y: auto;
        }
        .section { padding: 10px 12px; }
        .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
        .line:last-child { margin-bottom: 0; }
        .word-text { line-height: 1.4; word-break: break-word; flex: 1; }
        .accent-buttons { display: flex; gap: 3px; }
        .accent-btn {
          width: 28px; height: 18px; display: flex; align-items: center; justify-content: center;
          background: #fff; border: 1px solid #ddd; border-radius: 3px;
          font-size: 9px; font-weight: bold; cursor: pointer; color: #7f8c8d;
        }
        .accent-btn:hover { background: #3498db; color: white; }
        .footer { padding: 4px 12px; background: #f8f9fa; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
        .forvo-link { color: #3498db; text-decoration: none; font-size: 11px; cursor: pointer; }
      `}</style>
    </div>
  );
};
