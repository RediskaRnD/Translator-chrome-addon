import React, { useState, useEffect } from 'react';
import { LANGUAGES } from '../shared/languages';

export const OptionsApp: React.FC = () => {
  const [nativeLang, setNativeLang] = useState('ru');
  const [learningLang, setLearningLang] = useState('en');
  const [preferredVoice, setPreferredVoice] = useState('');
  const [historyLimit, setHistoryLimit] = useState(20);
  const [uiScale, setUiScale] = useState(1.0);
  const [voices, setVoices] = useState<chrome.tts.TtsVoice[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    chrome.storage.local.get(['nativeLang', 'learningLang', 'preferredVoice', 'historyLimit', 'uiScale'], (settings) => {
      if (settings.nativeLang) setNativeLang(settings.nativeLang as string);
      if (settings.learningLang) setLearningLang(settings.learningLang as string);
      if (settings.preferredVoice) setPreferredVoice(settings.preferredVoice as string);
      if (settings.historyLimit) setHistoryLimit(settings.historyLimit as number);
      if (settings.uiScale) setUiScale(settings.uiScale as number);
    });

    chrome.tts.getVoices((v) => {
      setVoices(v);
    });
  }, []);

  const handleSave = () => {
    chrome.storage.local.set({
      nativeLang,
      learningLang,
      preferredVoice,
      historyLimit,
      uiScale
    }, () => {
      setStatus('Settings saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    });
  };

  const langOptions = Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, name]) => (
      <option key={code} value={code}>{name}</option>
    ));

  return (
    <div className="container">
      <div className="card">
        <header className="card-header">
          <div className="logo-icon">🌐</div>
          <h1>Quick Translator Settings</h1>
        </header>

        <main className="card-body">
          <section className="setting-group">
            <h3>Languages</h3>
            <div className="input-field">
              <label>Native Language (Primary)</label>
              <p className="description">Source will translate TO this by default.</p>
              <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value)}>
                {langOptions}
              </select>
            </div>

            <div className="input-field">
              <label>Learning Language</label>
              <p className="description">Used if source is already in your native language.</p>
              <select value={learningLang} onChange={(e) => setLearningLang(e.target.value)}>
                {langOptions}
              </select>
            </div>
          </section>

          <section className="setting-group">
            <h3>Appearance & Behavior</h3>
            <div className="input-field">
              <label>UI Scale ({uiScale.toFixed(1)}x)</label>
              <p className="description">Adjust the size of the translation window.</p>
              <input 
                type="range" 
                min="0.8" 
                max="1.5" 
                step="0.1" 
                value={uiScale} 
                onChange={(e) => setUiScale(parseFloat(e.target.value))} 
              />
            </div>

            <div className="input-field">
              <label>History Limit</label>
              <p className="description">Number of recent translations to remember.</p>
              <input 
                type="number" 
                min="1" 
                max="100" 
                value={historyLimit} 
                onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 1)} 
              />
            </div>
          </section>

          <section className="setting-group">
            <h3>Text-to-Speech</h3>
            <div className="input-field">
              <label>Preferred Voice</label>
              <select value={preferredVoice} onChange={(e) => setPreferredVoice(e.target.value)}>
                <option value="">System Default</option>
                {voices.map((voice) => (
                  <option key={voice.voiceName} value={voice.voiceName}>
                    {voice.voiceName} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          </section>
        </main>

        <footer className="card-footer">
          <button className="save-btn" onClick={handleSave}>
            Save Configuration
          </button>
          {status && <div className="status-message">{status}</div>}
        </footer>
      </div>

      <style>{`
        :root {
          --primary-color: #3498db;
          --bg-color: #f5f7fa;
          --card-bg: #ffffff;
          --text-color: #2c3e50;
          --text-secondary: #7f8c8d;
          --border-color: #e0e6ed;
        }
        body {
          background-color: var(--bg-color);
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: var(--text-color);
        }
        .container {
          display: flex;
          justify-content: center;
          padding: 40px 20px;
        }
        .card {
          background: var(--card-bg);
          width: 100%;
          max-width: 500px;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.05);
          border: 1px solid var(--border-color);
          overflow: hidden;
        }
        .card-header {
          background: #fcfcfd;
          padding: 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo-icon {
          font-size: 32px;
        }
        .card-header h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .card-body {
          padding: 24px;
        }
        .setting-group {
          margin-bottom: 32px;
        }
        .setting-group:last-child {
          margin-bottom: 0;
        }
        .setting-group h3 {
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--text-secondary);
          margin: 0 0 16px 0;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
        }
        .input-field {
          margin-bottom: 20px;
        }
        .input-field:last-child {
          margin-bottom: 0;
        }
        .input-field label {
          display: block;
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 15px;
        }
        .description {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
        }
        select, input[type="number"], input[type="range"] {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        select:focus, input[type="number"]:focus {
          border-color: var(--primary-color);
        }
        input[type="range"] {
          padding: 0;
          height: 30px;
          background: transparent;
        }
        .card-footer {
          padding: 20px 24px;
          background: #fcfcfd;
          border-top: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .save-btn {
          background-color: var(--primary-color);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }
        .save-btn:hover {
          background-color: #2980b9;
        }
        .save-btn:active {
          transform: translateY(1px);
        }
        .status-message {
          color: #27ae60;
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};
