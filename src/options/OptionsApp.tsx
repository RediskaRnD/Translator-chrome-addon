import React, { useState, useEffect } from 'react';
import { LANGUAGES } from '../shared/languages';

export const OptionsApp: React.FC = () => {
  const [nativeLang, setNativeLang] = useState('ru');
  const [learningLang, setLearningLang] = useState('en');
  const [preferredVoice, setPreferredVoice] = useState('');
  const [historyLimit, setHistoryLimit] = useState(20);
  const [voices, setVoices] = useState<chrome.tts.TtsVoice[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    chrome.storage.local.get(['nativeLang', 'learningLang', 'preferredVoice', 'historyLimit'], (settings) => {
      if (settings.nativeLang) setNativeLang(settings.nativeLang as string);
      if (settings.learningLang) setLearningLang(settings.learningLang as string);
      if (settings.preferredVoice) setPreferredVoice(settings.preferredVoice as string);
      if (settings.historyLimit) setHistoryLimit(settings.historyLimit as number);
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
      historyLimit
    }, () => {
      setStatus('Settings saved!');
      setTimeout(() => setStatus(''), 2000);
    });
  };

  const langOptions = Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, name]) => (
      <option key={code} value={code}>{name}</option>
    ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', fontFamily: 'sans-serif' }}>
      <h2>Translator Settings</h2>
      
      <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <strong>Your Native Language (Primary):</strong>
        <small>Translations will default TO this language if source is foreign.</small>
        <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value)}>
          {langOptions}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <strong>Language You Are Learning:</strong>
        <small>Translations will default TO this if source is your Native language.</small>
        <select value={learningLang} onChange={(e) => setLearningLang(e.target.value)}>
          {langOptions}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <strong>Preferred Voice (Optional):</strong>
        <select value={preferredVoice} onChange={(e) => setPreferredVoice(e.target.value)}>
          <option value="">Default Voice</option>
          {voices.map((voice) => (
            <option key={voice.voiceName} value={voice.voiceName}>
              {voice.voiceName} ({voice.lang})
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <strong>History Limit:</strong>
        <input 
          type="number" 
          min="1" 
          max="100" 
          value={historyLimit} 
          onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 1)} 
        />
      </label>

      <button 
        onClick={handleSave} 
        style={{ padding: '10px', cursor: 'pointer', background: '#3498db', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
      >
        Save Settings
      </button>
      {status && <div style={{ color: '#27ae60', fontWeight: 'bold' }}>{status}</div>}
    </div>
  );
};
