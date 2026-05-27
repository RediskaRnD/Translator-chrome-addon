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
  const [preferredGenders, setPreferredGenders] = useState<Record<string, 'Male' | 'Female'>>({});
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

  const [ttsEngine, setTtsEngine] = useState<'google' | 'azure'>(DEFAULT_SETTINGS.TTS_ENGINE);
  const [azureKey, setAzureKey] = useState(DEFAULT_SETTINGS.AZURE_KEY);
  const [azureRegion, setAzureRegion] = useState(DEFAULT_SETTINGS.AZURE_REGION);
  const [azureVoices, setAzureVoices] = useState<any[]>([]);

  const [testText, setVoiceTestText] = useState("I'm ready to translate your world. Choose a voice that sounds best to you!");

  useEffect(() => {
    chrome.storage.local.get([
      'nativeLang', 'learningLang', 'preferredVoices', 'preferredAccents', 'preferredGenders',
      'historyLimit', 'uiScale', 'theme', 'autoPlayback', 'autoPlaybackLimit', 
      'hotkeys', 'ttsEngine', 'azureKey', 'azureRegion'
    ], (settings) => {
      if (settings.nativeLang) setNativeLang(settings.nativeLang as string);
      if (settings.learningLang) setLearningLang(settings.learningLang as string);
      if (settings.preferredVoices) setPreferredVoices(settings.preferredVoices as Record<string, string>);
      if (settings.preferredAccents) setPreferredAccents(settings.preferredAccents as Record<string, string>);
      if (settings.preferredGenders) setPreferredGenders(settings.preferredGenders as Record<string, 'Male' | 'Female'>);
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
      nativeLang, learningLang, preferredVoices, preferredAccents, preferredGenders,
      historyLimit, uiScale, theme, autoPlayback, autoPlaybackLimit, 
      hotkeys, ttsEngine, azureKey, azureRegion
    }, () => {
      setStatus('Settings saved successfully!');
      setTimeout(() => setStatus(''), 3000);
    });
  };

  const handleTestAzure = async () => {
    if (!azureKey || !azureRegion) { setStatus('Please enter Azure Key and Region first'); return; }
    setStatus('Testing Azure connection...');
    try {
      const url = `https://${azureRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
      const response = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': azureKey } });
      if (response.ok) {
        const voicesData = await response.json();
        setStatus(`Success! Found ${voicesData.length} Azure voices.`);
      } else {
        setStatus(`Azure Error: ${response.status} ${response.statusText}`);
      }
    } catch (e: any) { setStatus(`Connection Failed: ${e.message || 'Unknown error'}`); }
    setTimeout(() => setStatus(''), 8000);
  };

  const handleTestVoice = (lang: string) => {
    const accents = getAccentsForLanguage(lang);
    const selectedAccent = preferredAccents[lang] || (accents.length > 0 ? accents[0].code : lang);
    
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
        bypassCache: true,
        options: {
          ttsEngine,
          azureKey,
          azureRegion,
          preferredVoices,
          preferredAccents,
          preferredGenders
        }
      } 
    });
  };

  const langOptions = Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, name]) => (
      <option key={code} value={code}>{name}</option>
    ));

  const VoiceSelector: React.FC<{ lang: string }> = ({ lang }) => {
    const accents = getAccentsForLanguage(lang);
    const selectedAccent = preferredAccents[lang] || (accents.length > 0 ? accents[0].code : lang);
    const selectedGender = preferredGenders[lang] || 'Female';
    
    let currentVoices: any[] = [];
    let availableAzureLocales: string[] = [];

    if (ttsEngine === 'azure') {
      const baseLang = lang.split('-')[0].toLowerCase();
      const relevantVoices = azureVoices.filter(v => v.Locale.toLowerCase().startsWith(baseLang));
      availableAzureLocales = Array.from(new Set(relevantVoices.map(v => v.Locale))).sort();

      currentVoices = relevantVoices
        .filter(v => v.Locale === selectedAccent && v.Gender === selectedGender)
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
          <label>Region / Accent</label>
          <select 
            value={selectedAccent} 
            onChange={(e) => {
              const newAccent = e.target.value;
              setPreferredAccents({ ...preferredAccents, [lang]: newAccent });
              const newVoices = { ...preferredVoices };
              delete newVoices[newAccent];
              delete newVoices[lang];
              setPreferredVoices(newVoices);
            }}
          >
            {ttsEngine === 'azure' && availableAzureLocales.length > 0 ? (
              availableAzureLocales.map(loc => <option key={loc} value={loc}>{loc}</option>)
            ) : (
              accents.map(a => <option key={a.code} value={a.code}>{a.name} ({a.label})</option>)
            )}
          </select>
        </div>

        {ttsEngine === 'azure' && (
          <div className="input-field mini">
            <label>Gender</label>
            <div className="gender-toggle">
              <button className={selectedGender === 'Female' ? 'active' : ''} onClick={() => setPreferredGenders({...preferredGenders, [lang]: 'Female'})}>Female</button>
              <button className={selectedGender === 'Male' ? 'active' : ''} onClick={() => setPreferredGenders({...preferredGenders, [lang]: 'Male'})}>Male</button>
            </div>
          </div>
        )}

        <div className="input-field mini">
          <label>Specific Voice</label>
          <select 
            value={preferredVoices[selectedAccent] || preferredVoices[lang] || ''} 
            onChange={(e) => {
              const voiceKey = ttsEngine === 'azure' ? selectedAccent : lang;
              setPreferredVoices({ ...preferredVoices, [voiceKey]: e.target.value });
            }}
          >
            <option value="">{ttsEngine === 'azure' ? (currentVoices.length > 0 ? `-- Default ${selectedGender} --` : '-- No voices --') : 'System Default'}</option>
            {ttsEngine === 'azure' ? (
              currentVoices.map((voice) => (
                <option key={voice.ShortName} value={voice.ShortName}>
                  {voice.DisplayName} {voice.ShortName.includes('Neural') ? '(N)' : ''}
                </option>
              ))
            ) : (
              currentVoices.map((voice) => (
                <option key={voice.voiceName} value={voice.voiceName}>{voice.voiceName}</option>
              ))
            )}
          </select>
        </div>
        <button className="test-voice-btn" onClick={() => handleTestVoice(lang)} disabled={ttsEngine === 'azure' && currentVoices.length === 0}>Hear Voice Preview</button>
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
                <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value)}>{langOptions}</select>
              </div>
              <div className="input-field">
                <label>Learning Language</label>
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
                <div className="input-field"><label>API Key</label><input type="password" value={azureKey} onChange={(e) => setAzureKey(e.target.value)} /></div>
                <div className="input-field"><label>Region</label><input type="text" value={azureRegion} onChange={(e) => setAzureRegion(e.target.value)} /></div>
                <button className="secondary-btn" onClick={handleTestAzure}>Test Connection</button>
              </div>
            )}
          </section>
        );
      case 'voice':
        return (
          <section className="setting-group">
            <h3>Voice Personalization</h3>
            <div className="test-panel"><label>Test Phrase</label><textarea value={testText} onChange={(e) => setVoiceTestText(e.target.value)} rows={3} /></div>
            <div className="voice-grid"><VoiceSelector lang={nativeLang} /><VoiceSelector lang={learningLang} /></div>
          </section>
        );
      case 'theme':
        return (
          <section className="setting-group">
            <h3>Visual Style</h3>
            <div className="input-field"><label>Theme Mode</label><select value={theme} onChange={(e) => setTheme(e.target.value as any)}><option value="system">Follow System</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
            <div className="input-field"><label>UI Scale ({uiScale.toFixed(1)}x)</label><input type="range" min="0.8" max="1.5" step="0.1" value={uiScale} onChange={(e) => setUiScale(parseFloat(e.target.value))} /></div>
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
                  <button className={`hotkey-record-btn ${recordingKey === action ? 'recording' : ''}`} onClick={() => setRecordingKey(action)}>{recordingKey === action ? 'Press key...' : code || 'None'}</button>
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
          <div className="sidebar-header"><span className="logo">🌐</span><h2>Settings</h2></div>
          <nav className="nav-menu">
            <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>General</button>
            <button className={activeTab === 'engine' ? 'active' : ''} onClick={() => setActiveTab('engine')}>TTS Engine</button>
            <button className={activeTab === 'voice' ? 'active' : ''} onClick={() => setActiveTab('voice')}>Voice</button>
            <button className={activeTab === 'theme' ? 'active' : ''} onClick={() => setActiveTab('theme')}>Theme & Scale</button>
            <button className={activeTab === 'hotkeys' ? 'active' : ''} onClick={() => setActiveTab('hotkeys')}>Hotkeys</button>
          </nav>
          <div className="sidebar-footer"><button className="clear-cache-link" onClick={() => { if(confirm('Clear cache?')) chrome.runtime.sendMessage({type:'CLEAR_CACHE'},()=>setStatus('Cleared')); }}>Clear All Cache</button></div>
        </aside>
        <main className="main-content">
          <header className="content-header"><h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1><button className="save-top-btn" onClick={handleSave}>Save Changes</button></header>
          <div className="tab-body">{renderContent()}</div>
          {status && <div className="floating-status">{status}</div>}
        </main>
      </div>
      <style>{`
        :root { --primary: #3498db; --bg: #f8f9fa; --sidebar-bg: #ffffff; --text: #2c3e50; --text-dim: #7f8c8d; --border: #e0e6ed; --input-bg: #ffffff; }
        [data-theme='dark'] { --bg: #121212; --sidebar-bg: #1e1e1e; --text: #e0e0e0; --text-dim: #a0a0a0; --border: #333333; --input-bg: #2d2d2d; }
        body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); }
        .app-layout { display: flex; justify-content: center; min-height: 100vh; }
        .app-container { display: flex; width: 100%; max-width: 1100px; background: var(--sidebar-bg); box-shadow: 0 0 30px rgba(0,0,0,0.05); }
        .sidebar { width: 240px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 20px 0; flex-shrink: 0; }
        .sidebar-header { padding: 0 24px 20px; display: flex; align-items: center; gap: 12px; }
        .nav-menu { flex: 1; display: flex; flex-direction: column; }
        .nav-menu button { background: none; border: none; padding: 12px 24px; text-align: left; font-size: 15px; color: var(--text-dim); cursor: pointer; border-left: 3px solid transparent; }
        .nav-menu button.active { background: rgba(52, 152, 219, 0.1); color: var(--primary); border-left-color: var(--primary); font-weight: 600; }
        .main-content { flex: 1; padding: 40px 60px; position: relative; max-width: 800px; }
        .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .save-top-btn { background: var(--primary); color: white; border: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .setting-group { margin-bottom: 40px; }
        .setting-group h3 { font-size: 14px; text-transform: uppercase; color: var(--text-dim); border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 20px; }
        .input-field { margin-bottom: 20px; }
        .input-field label { display: block; font-weight: 600; margin-bottom: 4px; }
        select, input, textarea { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--input-bg); color: var(--text); outline: none; }
        .engine-selector { display: flex; gap: 12px; margin-bottom: 20px; }
        .engine-btn { flex: 1; padding: 15px; background: var(--input-bg); border: 2px solid var(--border); border-radius: 10px; cursor: pointer; color: var(--text-dim); font-weight: 600; }
        .engine-btn.active { border-color: var(--primary); color: var(--primary); background: rgba(52, 152, 219, 0.05); }
        .azure-config-panel { padding: 20px; background: rgba(0,0,0,0.02); border-radius: 10px; border: 1px dashed var(--border); }
        .voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .voice-selector-box { padding: 20px; background: var(--sidebar-bg); border: 1px solid var(--border); border-radius: 10px; }
        .gender-toggle { display: flex; gap: 1px; background: var(--border); border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
        .gender-toggle button { flex: 1; border: none; padding: 6px; background: var(--input-bg); color: var(--text-dim); cursor: pointer; font-size: 12px; font-weight: 600; }
        .gender-toggle button.active { background: var(--primary); color: white; }
        .test-voice-btn { width: 100%; margin-top: 10px; background: rgba(52, 152, 219, 0.1); border: 1px solid var(--primary); color: var(--primary); padding: 8px; border-radius: 6px; cursor: pointer; font-weight: 600; }
        .hotkey-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .hotkey-record-btn.recording { background: var(--primary); color: white; animation: pulse 1.5s infinite; }
        .floating-status { position: fixed; bottom: 30px; right: 30px; background: #27ae60; color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600; z-index: 1000; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
      `}</style>
    </div>
  );
};
