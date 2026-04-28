import { LANGUAGES } from '../shared/languages';

const app = document.getElementById('app');

async function init() {
  const settings = await chrome.storage.local.get(['nativeLang', 'learningLang', 'preferredVoice', 'historyLimit']);
  
  const langOptions = Object.entries(LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .map(([code, name]) => `<option value="${code}">${name}</option>`)
    .join('');

  if (app) {
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 15px; max-width: 400px; font-family: sans-serif;">
        <h2>Translator Settings</h2>
        
        <label style="display: flex; flex-direction: column; gap: 5px;">
          <strong>Your Native Language (Primary):</strong>
          <small>Translations will default TO this language if source is foreign.</small>
          <select id="native-lang">${langOptions}</select>
        </label>

        <label style="display: flex; flex-direction: column; gap: 5px;">
          <strong>Language You Are Learning:</strong>
          <small>Translations will default TO this if source is your Native language.</small>
          <select id="learning-lang">${langOptions}</select>
        </label>

        <label style="display: flex; flex-direction: column; gap: 5px;">
          <strong>Preferred Voice (Optional):</strong>
          <select id="voice-select">
            <option value="">Default Voice</option>
          </select>
        </label>

        <label style="display: flex; flex-direction: column; gap: 5px;">
          <strong>History Limit:</strong>
          <input type="number" id="history-limit" min="1" max="100" value="${settings.historyLimit || 20}">
        </label>

        <button id="save-btn" style="padding: 10px; cursor: pointer; background: #3498db; color: white; border: none; border-radius: 4px; font-weight: bold;">Save Settings</button>
        <div id="status" style="color: #27ae60; font-weight: bold;"></div>
      </div>
    `;

    const nativeSelect = document.getElementById('native-lang') as HTMLSelectElement;
    const learningSelect = document.getElementById('learning-lang') as HTMLSelectElement;
    const voiceSelect = document.getElementById('voice-select') as HTMLSelectElement;
    const historyInput = document.getElementById('history-limit') as HTMLInputElement;
    const saveBtn = document.getElementById('save-btn');
    const status = document.getElementById('status');

    nativeSelect.value = (typeof settings.nativeLang === 'string' ? settings.nativeLang : '') || 'ru';
    learningSelect.value = (typeof settings.learningLang === 'string' ? settings.learningLang : '') || 'en';

    // Load voices
    chrome.tts.getVoices((voices) => {
      voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.voiceName || '';
        option.textContent = `${voice.voiceName} (${voice.lang})`;
        voiceSelect.appendChild(option);
      });
      voiceSelect.value = (typeof settings.preferredVoice === 'string' ? settings.preferredVoice : '') || '';
    });

    saveBtn?.addEventListener('click', () => {
      chrome.storage.local.set({
        nativeLang: nativeSelect.value,
        learningLang: learningSelect.value,
        preferredVoice: voiceSelect.value,
        historyLimit: parseInt(historyInput.value) || 20
      }, () => {
        if (status) {
          status.textContent = 'Settings saved!';
          setTimeout(() => { status.textContent = ''; }, 2000);
        }
      });
    });
  }
}

init();

