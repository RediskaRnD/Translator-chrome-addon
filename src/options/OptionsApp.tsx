import React, { useState, useEffect } from 'react';
import { LANGUAGES } from '../shared/languages';
import { getAccentsForLanguage } from '../shared/accents';
import { DEFAULT_SETTINGS, DEFAULT_HOTKEYS } from '../shared/constants';

type SettingsTab = 'general' | 'engine' | 'voice' | 'theme' | 'hotkeys';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [nativeLang, setNativeLang] = useState(DEFAULT_SETTINGS.NATIVE_LANG);
  const [learningLang, setLearningLang] = useState(DEFAULT_SETTINGS.LEARNING_LANG);
  const [preferredVoices, setPreferredVoices] = useState<Record<string, string>>({});
  const [preferredAccents, setPreferredAccents] = useState<Record<string, string>>({});
  const [historyLimit, setHistoryLimit] = useState(DEFAULT_SETTINGS.HISTORY_LIMIT);
  const [uiScale, setUiScale] = useState(DEFAULT_SETTINGS.UI_SCALE);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(DEFAULT_SETTINGS.THEME);
  const [autoPlayback, setAutoPlayback] = useState<'off' | 'from' | 'to'>(DEFAULT_SETTINGS.AUTO_PLAYBACK);
  const [autoPlaybackLimit, setAutoPlaybackLimit] = useState(DEFAULT_SETTINGS.AUTO_PLAYBACK_LIMIT);
  const [hotkeys, setHotkeys] = useState<Record<string, string>>(DEFAULT_HOTKEYS);
  const [systemIsDark, setSystemIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [voices, setVoices] = useState<chrome.tts.TtsVoice[]>([]);
  const [status, setStatus] = useState('');
  const [recordingKey, setRecordingKey] = useState<string | null>(null);

  // Azure settings
  const [ttsEngine, setTtsEngine] = useState<'google' | 'azure'>(DEFAULT_SETTINGS.TTS_ENGINE);
  const [azureKey, setAzureKey] = useState(DEFAULT_SETTINGS.AZURE_KEY);
  const [azureRegion, setAzureRegion] = useState(DEFAULT_SETTINGS.AZURE_REGION);
  const [azureVoices, setAzureVoices] = useState<any[]>([]);

  // Voice Test state
  const [testText, setVoiceTestText] = useState("I'm ready to translate your world. Choose a voice that sounds best to you!");

  useEffect(() => {
    chrome.storage.local.get([
      'nativeLang', 'learningLang', 'preferredVoices', 'preferredAccents', 
      'historyLimit', 'uiScale', 'theme', 'autoPlayback', 'autoPlaybackLimit', 
      'hotkeys', 'ttsEngine', 'azureKey', 'azureRegion'
    ], (settings) => {
      if (settings.nativeLang) setNativeLang(settings.nativeLang as string);
      if (settings.learningLang) setLearningLang(settings.learningLang as string);
      if (settings.preferredVoices) setPreferredVoices(settings.preferredVoices as Record<string, string>);
      if (settings.preferredAccents) setPreferredAccents(settings.preferredAccents as Record<string, string>);
      if (settings.historyLimit) setHistoryLimit(settings.historyLimit as number);
      if (settings.uiScale) setUiScale(settings.uiScale as number);
      if (settings.theme) setTheme(settings.theme as 'light' | 'dark' | 'system');
      if (settings.autoPlayback) setAutoPlayback(settings.autoPlayback as 'off' | 'from' | 'to');
      if (settings.autoPlaybackLimit !== undefined) setAutoPlaybackLimit(settings.autoPlaybackLimit as number);
      if (settings.hotkeys) setHotkeys(settings.hotkeys as Record<string, string>);
      if (settings.ttsEngine) setTtsEngine(settings.ttsEngine as 'google' | 'azure');
      if (settings.azureKey) setAzureKey(settings.azureKey as string);
      if (settings.azureRegion) setAzureRegion(settings.azureRegion as string);
    });

    chrome.tts.getVoices((v) => {
      setVoices(v);
    });
  }, []);

  useEffect(() => {
    if (ttsEngine === 'azure' && azureKey && azureRegion) {
      fetchAzureVoices();
    }
  }, [ttsEngine, azureKey, azureRegion]);

  const fetchAzureVoices = async () => {
    try {
      const url = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      const response = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': azureKey } });
      if (response.ok) {
        const data = await response.json();
        setAzureVoices(data);
      }
    } catch (e) {
      console.error('Failed to fetch Azure voices:', e);
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (recordingKey) {
        e.preventDefault();
        e.stopPropagation();
        setHotkeys({ ...hotkeys, [recordingKey]: e.code });
        setRecordingKey(null);
      }
    };
    if (recordingKey) {
      window.addEventListener('keydown', handleGlobalKeyDown, true);
    }
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [recordingKey, hotkeys]);

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return undefined;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const currentAppliedTheme = theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', currentAppliedTheme);
  }, [theme, systemIsDark]);

  const handleSave = () => {
    chrome.storage.local.set({
      nativeLang,
      learningLang,
      preferredVoices,
      preferredAccents,
      historyLimit,
      uiScale,
      theme,
      autoPlayback,
      autoPlaybackLimit,
      hotkeys,
      ttsEngine,
      azureKey,
      azureRegion
    }, () => {
      setStatus('Settings saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    });
  };

  const handleTestAzure = async () => {
    if (!azureKey || !azureRegion) {
      setStatus('Please enter Azure Key and Region first');
      return;
    }
    setStatus('Testing Azure connection...');
    try {
      const url = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      const response = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': azureKey }
      });
      if (response.ok) {
        const voicesData = await response.json();
        setStatus(`Success! Found ${voicesData.length} Azure voices.`);
      } else {
        setStatus(`Azure Error: ${response.status} ${response.statusText}`);
      }
    } catch (e: any) {
      setStatus(`Connection Failed: ${e.message || 'Unknown error'}`);
    }
    setTimeout(() => setStatus(''), 8000);
  };

  const handleTestVoice = (lang: string) => {
    const accents = getAccentsForLanguage(lang);
    const selectedAccent = preferredAccents[lang] || (accents.length > 0 ? accents[0].code : lang);
    
    // Use language-specific test text if the general one is default
    let textToSpeak = testText;
    if (testText === "I'm ready to translate your world. Choose a voice that sounds best to you!") {
      if (lang.startsWith('ru')) textToSpeak = "Привет! Я готов переводить ваш мир. Выберите голос, который вам нравится.";
      else if (lang.startsWith('en')) textToSpeak = "Hello! I am ready to translate your world. Choose a voice you like.";
    }

    chrome.runtime.sendMessage({ 
      type: "SPEAK", 
      payload: { 
        text: textToSpeak, 
        langCode: selectedAccent,
        bypassCache: true // Crucial for testing different voices
      } 
    });
  };

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear all translation history and audio cache?')) {
      chrome.runtime.sendMessage({ type: "CLEAR_CACHE" }, (res) => {
        if (res && res.success) {
          setStatus('Cache cleared successfully!');
          setTimeout(() => setStatus(''), 3000);
        }
      });
    }
  };

  const langOptions = Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, name]) => (
      <option key={code} value={code}>{name}</option>
    ));

  const VoiceSelector: React.FC<{ lang: string }> = ({ lang }) => {
    const accents = getAccentsForLanguage(lang);
    const selectedAccent = preferredAccents[lang] || (accents.length > 0 ? accents[0].code : lang);
    
    let currentVoices: any[] = [];
    if (ttsEngine === 'azure') {
      currentVoices = azureVoices
        .filter(v => v.Locale.toLowerCase().startsWith(selectedAccent.split('-')[0].toLowerCase()))
        .sort((a, b) => {
          const aNeural = a.ShortName.includes('Neural');
          const bNeural = b.ShortName.includes('Neural');
          if (aNeural && !bNeural) return -1;
          if (!aNeural && bNeural) return 1;
          return a.DisplayName.localeCompare(b.DisplayName);
        });
    } else {
      currentVoices = voices.filter(v => v.lang?.startsWith(selectedAccent.split('-')[0]));
    }

    return (
      <div className="voice-selector-box">
        <h4>{LANGUAGES[lang as keyof typeof LANGUAGES] || lang}</h4>
        
        <div className="input-field mini">
          <label>Accent</label>
          <select 
            value={selectedAccent} 
            onChange={(e) => {
              const newAccent = e.target.value;
              setPreferredAccents({ ...preferredAccents, [lang]: newAccent });
              const newVoices = { ...preferredVoices };
              delete newVoices[lang];
              setPreferredVoices(newVoices);
            }}
          >
            {accents.map(a => <option key={a.code} value={a.code}>{a.name} ({a.label})</option>)}
          </select>
        </div>

        <div className="input-field mini">
          <label>Specific Voice</label>
          <select 
            value={preferredVoices[lang] || ''} 
            onChange={(e) => setPreferredVoices({ ...preferredVoices, [lang]: e.target.value })}
          >
            <option value="">{ttsEngine === 'azure' ? '-- Default Neural --' : 'System Default'}</option>
            {ttsEngine === 'azure' ? (
              currentVoices.map((voice) => (
                <option key={voice.ShortName} value={voice.ShortName}>
                  {voice.DisplayName} {voice.ShortName.includes('Neural') ? '(Neural)' : ''}
                </option>
              ))
            ) : (
              currentVoices.map((voice) => (
                <option key={voice.voiceName} value={voice.voiceName}>{voice.voiceName}</option>
              ))
            )}
          </select>
        </div>
        <button className="test-voice-btn" onClick={() => handleTestVoice(lang)}>Hear Voice Preview</button>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <>
            <section className="setting-group">
              <h3>Language Directions</h3>
              <div className="input-field">
                <label>Native Language</label>
                <p className="description">The primary language you speak.</p>
                <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value)}>{langOptions}</select>
              </div>
              <div className="input-field">
                <label>Learning Language</label>
                <p className="description">The language you are studying.</p>
                <select value={learningLang} onChange={(e) => setLearningLang(e.target.value)}>{langOptions}</select>
              </div>
            </section>
            <section className="setting-group">
              <h3>Behavior</h3>
              <div className="input-field">
                <label>History Limit</label>
                <input type="number" min="1" max="100" value={historyLimit} onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 20)} />
              </div>
              <div className="input-field">
                <label>Auto-play Limit (chars)</label>
                <input type="number" min="10" max="1000" value={autoPlaybackLimit} onChange={(e) => setAutoPlaybackLimit(parseInt(e.target.value) || 100)} />
              </div>
            </section>
          </>
        );
      case 'engine':
        return (
          <section className="setting-group">
            <h3>TTS Provider</h3>
            <div className="engine-selector">
              <button className={`engine-btn ${ttsEngine === 'google' ? 'active' : ''}`} onClick={() => setTtsEngine('google')}>Google (Standard)</button>
              <button className={`engine-btn ${ttsEngine === 'azure' ? 'active' : ''}`} onClick={() => setTtsEngine('azure')}>Azure AI (Neural)</button>
            </div>
            {ttsEngine === 'azure' && (
              <div className="azure-config-panel">
                <div className="input-field">
                  <label>API Key</label>
                  <input type="password" value={azureKey} onChange={(e) => setAzureKey(e.target.value)} placeholder="Azure Speech Key" />
                </div>
                <div className="input-field">
                  <label>Region</label>
                  <input type="text" value={azureRegion} onChange={(e) => setAzureRegion(e.target.value)} placeholder="e.g. westeurope" />
                </div>
                <button className="secondary-btn" onClick={handleTestAzure}>Test Connection</button>
              </div>
            )}
          </section>
        );
      case 'voice':
        return (
          <section className="setting-group">
            <h3>Voice Personalization</h3>
            <div className="test-panel">
              <label>Test Phrase</label>
              <textarea value={testText} onChange={(e) => setVoiceTestText(e.target.value)} rows={3} />
            </div>
            <div className="voice-grid">
              <VoiceSelector lang={nativeLang} />
              <VoiceSelector lang={learningLang} />
            </div>
          </section>
        );
      case 'theme':
        return (
          <section className="setting-group">
            <h3>Visual Style</h3>
            <div className="input-field">
              <label>Theme Mode</label>
              <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
                <option value="system">Follow System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div className="input-field">
              <label>UI Scale ({uiScale.toFixed(1)}x)</label>
              <input type="range" min="0.8" max="1.5" step="0.1" value={uiScale} onChange={(e) => setUiScale(parseFloat(e.target.value))} />
            </div>
          </section>
        );
      case 'hotkeys':
        return (
          <section className="setting-group">
            <h3>Keyboard Shortcuts</h3>
            <div className="hotkey-grid">
              {Object.entries(hotkeys).map(([action, code]) => (
                <div key={action} className="hotkey-item">
                  <span className="hotkey-label">{action.replace('_', ' ')}</span>
                  <button className={`hotkey-record-btn ${recordingKey === action ? 'recording' : ''}`} onClick={() => setRecordingKey(action)}>
                    {recordingKey === action ? 'Press key...' : code || 'None'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        );
      default: return null;
    }
  };

  return (
    <div className="app-layout">
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="logo">🌐</span>
            <h2>Settings</h2>
          </div>
          <nav className="nav-menu">
            <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>General</button>
            <button className={activeTab === 'engine' ? 'active' : ''} onClick={() => setActiveTab('engine')}>TTS Engine</button>
            <button className={activeTab === 'voice' ? 'active' : ''} onClick={() => setActiveTab('voice')}>Voice</button>
            <button className={activeTab === 'theme' ? 'active' : ''} onClick={() => setActiveTab('theme')}>Theme & Scale</button>
            <button className={activeTab === 'hotkeys' ? 'active' : ''} onClick={() => setActiveTab('hotkeys')}>Hotkeys</button>
          </nav>
          <div className="sidebar-footer">
            <button className="clear-cache-link" onClick={handleClearCache}>Clear All Cache</button>
          </div>
        </aside>

        <main className="main-content">
          <header className="content-header">
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <button className="save-top-btn" onClick={handleSave}>Save Changes</button>
          </header>
          <div className="tab-body">{renderContent()}</div>
          {status && <div className="floating-status">{status}</div>}
        </main>
      </div>

      <style>{`
        :root {
          --primary: #3498db; --bg: #f8f9fa; --sidebar-bg: #ffffff; --card: #ffffff;
          --text: #2c3e50; --text-dim: #7f8c8d; --border: #e0e6ed; --input-bg: #ffffff;
        }
        [data-theme='dark'] {
          --bg: #121212; --sidebar-bg: #1e1e1e; --card: #252525;
          --text: #e0e0e0; --text-dim: #a0a0a0; --border: #333333; --input-bg: #2d2d2d;
        }
        body { margin: 0; font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); }
        .app-layout {
          display: flex;
          justify-content: center;
          min-height: 100vh;
        }
        .app-container {
          display: flex;
          width: 100%;
          max-width: 1100px;
          background: var(--sidebar-bg);
          box-shadow: 0 0 30px rgba(0,0,0,0.05);
        }
        
        .sidebar { 
          width: 240px; 
          background: var(--sidebar-bg); 
          border-right: 1px solid var(--border); 
          display: flex; 
          flex-direction: column; 
          padding: 20px 0;
          flex-shrink: 0;
        }
        .sidebar-header { padding: 0 24px 20px; display: flex; align-items: center; gap: 12px; }
        .sidebar-header .logo { font-size: 24px; }
        .sidebar-header h2 { font-size: 18px; margin: 0; }
        
        .nav-menu { flex: 1; display: flex; flex-direction: column; }
        .nav-menu button { background: none; border: none; padding: 12px 24px; text-align: left; font-size: 15px; color: var(--text-dim); cursor: pointer; transition: all 0.2s; border-left: 3px solid transparent; }
        .nav-menu button:hover { background: rgba(0,0,0,0.03); color: var(--text); }
        .nav-menu button.active { background: rgba(52, 152, 219, 0.1); color: var(--primary); border-left-color: var(--primary); font-weight: 600; }
        
        .sidebar-footer { padding: 20px 24px; }
        .clear-cache-link { background: none; border: none; color: #e74c3c; font-size: 13px; cursor: pointer; padding: 0; opacity: 0.8; }
        .clear-cache-link:hover { text-decoration: underline; opacity: 1; }

        .main-content { flex: 1; padding: 40px 60px; position: relative; max-width: 800px; }
        .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .content-header h1 { margin: 0; font-size: 28px; }
        .save-top-btn { background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        
        .setting-group { margin-bottom: 40px; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .setting-group h3 { font-size: 14px; text-transform: uppercase; color: var(--text-dim); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 20px; }
        
        .input-field { margin-bottom: 20px; }
        .input-field label { display: block; font-weight: 600; margin-bottom: 4px; }
        .description { font-size: 13px; color: var(--text-dim); margin-bottom: 8px; }
        select, input[type="text"], input[type="password"], input[type="number"] { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); outline: none; }
        
        .engine-selector { display: flex; gap: 12px; margin-bottom: 20px; }
        .engine-btn { flex: 1; padding: 15px; background: var(--input-bg); border: 2px solid var(--border); border-radius: 10px; cursor: pointer; color: var(--text-dim); font-weight: 600; transition: all 0.2s; }
        .engine-btn.active { border-color: var(--primary); color: var(--primary); background: rgba(52, 152, 219, 0.05); }
        
        .azure-config-panel { padding: 20px; background: rgba(0,0,0,0.02); border-radius: 10px; border: 1px dashed var(--border); }
        .secondary-btn { background: none; border: 1px solid var(--primary); color: var(--primary); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; }
        
        .test-panel { margin-bottom: 30px; }
        .test-panel textarea { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); resize: none; }
        .voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .voice-selector-box { padding: 20px; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; }
        .voice-selector-box h4 { margin: 0 0 15px 0; font-size: 16px; }
        .input-field.mini { margin-bottom: 12px; }
        .input-field.mini label { font-size: 12px; color: var(--text-dim); }
        .test-voice-btn { width: 100%; margin-top: 10px; background: rgba(52, 152, 219, 0.1); border: 1px solid var(--primary); color: var(--primary); padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
        .test-voice-btn:hover { background: var(--primary); color: white; }

        .hotkey-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .hotkey-item { display: flex; flex-direction: column; gap: 5px; }
        .hotkey-label { font-size: 12px; color: var(--text-dim); text-transform: capitalize; }
        .hotkey-record-btn { padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; cursor: pointer; color: var(--text); font-family: monospace; }
        .hotkey-record-btn.recording { background: var(--primary); color: white; animation: pulse 1.5s infinite; }

        .floating-status { position: fixed; bottom: 30px; right: 30px; background: #27ae60; color: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); font-weight: 600; animation: slideIn 0.3s ease; z-index: 1000; }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
};
