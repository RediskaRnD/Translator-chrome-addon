import React, { useState, useEffect } from 'react';
import { LANGUAGES } from '../shared/languages';
import { getAccentsForLanguage } from '../shared/accents';
import { DEFAULT_SETTINGS, DEFAULT_HOTKEYS } from '../shared/constants';

type SettingsTab = 'engine' | 'voice' | 'theme' | 'hotkeys' | 'other';

export const OptionsApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('voice');
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

  const DEFAULT_TEST_PHRASE = "I'm ready to translate your world. Choose a voice that sounds best to you!";

  const handleTestVoice = async (lang: string) => {
    let textToSpeak = testText.trim() || DEFAULT_TEST_PHRASE;

    // If not English, translate it to target language
    if (!lang.startsWith('en')) {
      setStatus('Translating test phrase...');
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage({
          type: "TRANSLATE",
          payload: { text: textToSpeak, from: 'auto', to: lang }
        }, resolve);
      });
      if (response && response.translatedText && response.translatedText !== 'Error') {
        textToSpeak = response.translatedText;
      }
      setStatus('');
    }

    const accents = getAccentsForLanguage(lang);
    const selectedAccent = preferredAccents[lang] || (accents.length > 0 ? accents[0].code : lang);

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

  const VoiceSelector: React.FC<{ lang: string; label: string; onLangChange: (val: string) => void }> = ({ lang, label, onLangChange }) => {
    const accents = getAccentsForLanguage(lang);
    const selectedAccent = preferredAccents[lang] || (accents.length > 0 ? accents[0].code : lang);
    const selectedGender = preferredGenders[lang] || 'Female';

    let currentVoices: any[] = [];
    let availableAzureLocales: string[] = [];

    if (ttsEngine === 'azure') {
      const baseLang = lang.split('-')[0].toLowerCase();
      const relevantVoices = azureVoices.filter(v => v.Locale.toLowerCase().startsWith(baseLang));
      availableAzureLocales = Array.from(new Set(relevantVoices.map(v => v.Locale)))
        .filter(loc => !loc.includes('-Latn-'))
        .sort();

      currentVoices = relevantVoices
        .filter(v => (v.Locale === selectedAccent || v.Locale.startsWith(selectedAccent + '-')) && v.Gender === selectedGender)
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
        <div className="voice-box-header">
          <div className="input-field mini no-margin">
            <label>{label}</label>
            <select value={lang} onChange={(e) => onLangChange(e.target.value)} className="lang-main-select">{langOptions}</select>
          </div>
        </div>

        <div className="voice-settings-row">
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
                <button className={selectedGender === 'Female' ? 'active' : ''} onClick={() => setPreferredGenders({ ...preferredGenders, [lang]: 'Female' })}>Female</button>
                <button className={selectedGender === 'Male' ? 'active' : ''} onClick={() => setPreferredGenders({ ...preferredGenders, [lang]: 'Male' })}>Male</button>
              </div>
            </div>
          )}
        </div>

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
                  {voice.DisplayName} {voice.SampleRateHertz ? `${voice.SampleRateHertz / 1000} kHz` : ''}
                </option>
              ))
            ) : (
              currentVoices.map((voice) => (
                <option key={voice.voiceName} value={voice.voiceName}>{voice.voiceName}</option>
              ))
            )}
          </select>
        </div>
        <button className="test-voice-btn" onClick={() => handleTestVoice(lang)} disabled={ttsEngine === 'azure' && currentVoices.length === 0}>Hear Preview</button>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'engine':
        return (
          <section className="setting-group">
            <h3>TTS Provider</h3>
            <div className="engine-selector">
              <button className={`engine-btn ${ttsEngine === 'google' ? 'active' : ''}`} onClick={() => setTtsEngine('google')}>
                <div className="engine-icon">G</div>
                <div className="engine-info">
                  <span className="engine-name">Google Translate</span>
                  <span className="engine-desc">Standard voices, no setup required.</span>
                </div>
              </button>
              <button className={`engine-btn ${ttsEngine === 'azure' ? 'active' : ''}`} onClick={() => setTtsEngine('azure')}>
                <div className="engine-icon">A</div>
                <div className="engine-info">
                  <span className="engine-name">Azure Cognitive Services</span>
                  <span className="engine-desc">Neural human-like voices (API Key required).</span>
                </div>
              </button>
            </div>
            {ttsEngine === 'azure' && (
              <div className="azure-config-panel">
                <div className="input-field"><label>API Key</label><input type="password" value={azureKey} placeholder="Paste your Azure key here" onChange={(e) => setAzureKey(e.target.value)} /></div>
                <div className="input-field"><label>Region</label><input type="text" value={azureRegion} placeholder="e.g. westeurope" onChange={(e) => setAzureRegion(e.target.value)} /></div>
                <button className="secondary-btn" onClick={handleTestAzure}>Test Connection</button>
              </div>
            )}
          </section>
        );
      case 'voice':
        return (
          <section className="setting-group">
            <h3>Voice & Languages</h3>
            <div className="test-panel">
              <p className="field-desc">Custom Test Phrase</p>
              <textarea
                value={testText}
                onChange={(e) => setVoiceTestText(e.target.value)}
                rows={2}
                placeholder={DEFAULT_TEST_PHRASE}
              />
              <p className="field-desc">If you enter text in English, it will be automatically translated when testing non-English voices.</p>
            </div>
            <div className="voice-grid">
              <VoiceSelector lang={nativeLang} label="Native Language" onLangChange={setNativeLang} />
              <VoiceSelector lang={learningLang} label="Learning Language" onLangChange={setLearningLang} />
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
        const hotkeyGroups = [
          { title: 'Navigation', keys: ['HISTORY_BACK', 'HISTORY_FORWARD'] },
          { title: 'Quick Actions', keys: ['PIN', 'SETTINGS'] },
          { title: 'Audio Control', keys: ['TOGGLE_AUTOPLAY', 'REPLAY'] },
        ];
        return (
          <section className="setting-group">
            <h3>Keyboard Shortcuts</h3>
            <p className="section-desc">Click on a button and press the desired key combination.</p>
            <div className="hotkey-sections">
              {hotkeyGroups.map(group => (
                <div key={group.title} className="hotkey-section">
                  <h4>{group.title}</h4>
                  <div className="hotkey-list">
                    {group.keys.map(action => (
                      <div key={action} className="hotkey-row">
                        <span className="hotkey-action-name">{action.replace('_', ' ')}</span>
                        <button
                          className={`hotkey-pill ${recordingKey === action ? 'recording' : ''}`}
                          onClick={() => setRecordingKey(action)}
                        >
                          {recordingKey === action ? 'Press key...' : (hotkeys[action] || 'None').replace('Key', '')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      case 'other':
        return (
          <>
            <section className="setting-group">
              <h3>Behavior & Limits</h3>
              <div className="input-field">
                <label>History Limit</label>
                <p className="field-desc">How many recent translations to keep in history.</p>
                <input type="number" min="1" max="100" value={historyLimit} onChange={(e) => setHistoryLimit(parseInt(e.target.value) || 20)} />
              </div>
              <div className="input-field">
                <label>Auto-play Limit (chars)</label>
                <p className="field-desc">Max length of text to automatically speak after translation.</p>
                <input type="number" min="10" max="1000" value={autoPlaybackLimit} onChange={(e) => setAutoPlaybackLimit(parseInt(e.target.value) || 100)} />
              </div>
            </section>
          </>
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
            <button className={activeTab === 'voice' ? 'active' : ''} onClick={() => setActiveTab('voice')}>Voice & Lang</button>
            <button className={activeTab === 'engine' ? 'active' : ''} onClick={() => setActiveTab('engine')}>TTS Engine</button>
            <button className={activeTab === 'theme' ? 'active' : ''} onClick={() => setActiveTab('theme')}>Theme</button>
            <button className={activeTab === 'hotkeys' ? 'active' : ''} onClick={() => setActiveTab('hotkeys')}>Hotkeys</button>
            <button className={activeTab === 'other' ? 'active' : ''} onClick={() => setActiveTab('other')}>Other</button>
          </nav>
          <div className="sidebar-footer">
            <button className="clear-cache-link" onClick={() => { if (confirm('Clear cache?')) chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }, () => setStatus('Cleared')); }}>Clear Cache</button>
          </div>
        </aside>
        <main className="main-content">
          <header className="content-header">
            <div>
              <h1>{activeTab === 'voice' ? 'Voice & Languages' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            </div>
            <button className="save-top-btn" onClick={handleSave}>Save Changes</button>
          </header>
          <div className="tab-body">{renderContent()}</div>
          {status && <div className="floating-status">{status}</div>}
        </main>
      </div>
      <style>{`
        :root { 
          --primary: #3498db; 
          --primary-hover: #2980b9;
          --bg: #f8f9fa; 
          --sidebar-bg: #ffffff; 
          --text: #2c3e50; 
          --text-dim: #7f8c8d; 
          --border: #e0e6ed; 
          --input-bg: #ffffff; 
          --card-bg: #ffffff;
          --danger: #e74c3c;
        }
        [data-theme='dark'] { 
          --bg: #121212; 
          --sidebar-bg: #1e1e1e; 
          --text: #e0e0e0; 
          --text-dim: #a0a0a0; 
          --border: #333333; 
          --input-bg: #2d2d2d; 
          --card-bg: #252525;
        }
        body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); }
        .app-layout { display: flex; justify-content: center; min-height: 100vh; padding: 20px; }
        .app-container { display: flex; width: 100%; max-width: 1100px; background: var(--sidebar-bg); border-radius: 12px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        
        .sidebar { width: 240px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; padding: 24px 0; flex-shrink: 0; }
        .sidebar-header { padding: 0 24px 24px; display: flex; align-items: center; gap: 12px; }
        .sidebar-header h2 { margin: 0; font-size: 20px; }
        .nav-menu { flex: 1; display: flex; flex-direction: column; }
        .nav-menu button { background: none; border: none; padding: 14px 24px; text-align: left; font-size: 15px; color: var(--text-dim); cursor: pointer; border-left: 4px solid transparent; transition: all 0.2s; }
        .nav-menu button:hover { background: rgba(0,0,0,0.02); color: var(--text); }
        .nav-menu button.active { background: rgba(52, 152, 219, 0.08); color: var(--primary); border-left-color: var(--primary); font-weight: 600; }
        
        .main-content { flex: 1; padding: 40px 60px; position: relative; overflow-y: auto; max-height: 90vh; }
        .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .content-header h1 { margin: 0; font-size: 28px; font-weight: 700; }
        .save-top-btn { background: var(--primary); color: white; border: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3); }
        .save-top-btn:hover { background: var(--primary-hover); }
        
        .setting-group { margin-bottom: 48px; }
        .setting-group h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-dim); border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 24px; }
        .section-desc { font-size: 14px; color: var(--text-dim); margin-bottom: 24px; margin-top: -16px; }
        
        .input-field { margin-bottom: 24px; }
        .input-field label { display: block; font-weight: 600; font-size: 15px; margin-bottom: 6px; }
        .field-desc { font-size: 13px; color: var(--text-dim); margin-bottom: 8px; }
        
        select, input[type="text"], input[type="number"], input[type="password"], textarea { 
          width: 100%; padding: 12px; border: 1.5px solid var(--border); border-radius: 8px; background: var(--input-bg); color: var(--text); outline: none; transition: border-color 0.2s; font-size: 15px; 
        }
        select:focus, input:focus, textarea:focus { border-color: var(--primary); }
        
        .engine-selector { display: flex; gap: 16px; margin-bottom: 24px; }
        .engine-btn { flex: 1; padding: 20px; background: var(--card-bg); border: 2px solid var(--border); border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 16px; text-align: left; transition: all 0.2s; }
        .engine-btn:hover { border-color: var(--text-dim); }
        .engine-btn.active { border-color: var(--primary); background: rgba(52, 152, 219, 0.04); }
        .engine-icon { width: 48px; height: 48px; background: var(--border); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; color: var(--text-dim); }
        .engine-btn.active .engine-icon { background: var(--primary); color: white; }
        .engine-info { display: flex; flex-direction: column; }
        .engine-name { font-weight: 700; font-size: 16px; color: var(--text); }
        .engine-desc { font-size: 13px; color: var(--text-dim); }
        
        .voice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .voice-selector-box { padding: 24px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .voice-box-header { margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border); }
        .lang-main-select { font-weight: 700; font-size: 16px !important; border-color: transparent !important; padding-left: 0 !important; cursor: pointer; }
        .voice-settings-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .no-margin { margin: 0; }
        
        .gender-toggle { display: flex; background: var(--border); border-radius: 8px; overflow: hidden; padding: 2px; }
        .gender-toggle button { flex: 1; border: none; padding: 8px; background: transparent; color: var(--text-dim); cursor: pointer; font-size: 12px; font-weight: 600; border-radius: 6px; }
        .gender-toggle button.active { background: var(--sidebar-bg); color: var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        
        .test-voice-btn { width: 100%; margin-top: 16px; background: rgba(52, 152, 219, 0.1); border: 1.5px solid var(--primary); color: var(--primary); padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 700; transition: all 0.2s; }
        .test-voice-btn:hover:not(:disabled) { background: var(--primary); color: white; }
        .test-voice-btn:disabled { opacity: 0.5; cursor: not-allowed; border-color: var(--border); color: var(--text-dim); }
        
        .hotkey-sections { display: flex; flex-direction: column; gap: 32px; }
        .hotkey-section h4 { margin: 0 0 16px; font-size: 15px; color: var(--text); }
        .hotkey-list { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .hotkey-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .hotkey-row:last-child { border-bottom: none; }
        .hotkey-action-name { font-weight: 500; font-size: 15px; text-transform: capitalize; }
        .hotkey-pill { min-width: 100px; padding: 8px 16px; background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px; font-family: monospace; font-weight: 700; color: var(--primary); cursor: pointer; transition: all 0.2s; }
        .hotkey-pill:hover { border-color: var(--primary); background: rgba(52, 152, 219, 0.05); }
        .hotkey-pill.recording { background: var(--primary); color: white; border-color: var(--primary); animation: pulse 1.5s infinite; }
        
        .floating-status { position: fixed; bottom: 32px; right: 32px; background: #2ecc71; color: white; padding: 14px 28px; border-radius: 12px; font-weight: 600; z-index: 1000; box-shadow: 0 8px 24px rgba(46, 204, 113, 0.3); }
        .sidebar-footer { padding: 24px; border-top: 1px solid var(--border); }
        .clear-cache-link { width: 100%; background: none; border: 1.5px solid var(--border); color: var(--text-dim); padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s; }
        .clear-cache-link:hover { border-color: var(--danger); color: var(--danger); }
        
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.02); } }
      `}</style>
    </div>
  );
};
