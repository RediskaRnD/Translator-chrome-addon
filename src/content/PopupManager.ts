import { HistoryItem } from "../shared/types";
import { LANGUAGES } from "../shared/languages";
import { getAccentsForLanguage } from "../shared/accents";
import { CacheManager } from "../shared/CacheManager";

export class PopupManager {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private popup: HTMLElement | null = null;
  private originalText: string = "";

  private nativeLang: string = "ru";
  private learningLang: string = "en";
  private currentFrom: string = "auto";
  private currentTo: string = "ru";

  private historyIndex: number = 0;
  private version: string = "1.0.0";

  constructor() {
    this.version = chrome.runtime.getManifest().version;
    this.initContainer();
    this.loadSettings();
  }

  private async loadSettings() {
    const settings = await chrome.storage.local.get(["nativeLang", "learningLang"]);
    if (typeof settings.nativeLang === "string") this.nativeLang = settings.nativeLang;
    if (typeof settings.learningLang === "string") this.learningLang = settings.learningLang;
  }

  private initContainer() {
    this.container = document.createElement("div");
    this.container.className = "translator-popup-container";
    this.shadowRoot = this.container.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host {
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .popup {
        position: fixed;
        background: #ffffff;
        border-radius: 8px;
        box-shadow: 0 4px 30px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        color: #2c3e50;
        width: 350px;
        z-index: 2147483647;
        overflow: hidden;
        border: 1px solid #d0d0d0;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .popup * {
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .header {
        background: #f1f3f5;
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
      }
      .nav-btn {
        background: #fff; border: 1px solid #ccc; border-radius: 3px;
        padding: 1px 6px; cursor: pointer; font-size: 14px; color: #7f8c8d;
      }
      .lang-selects { display: flex; align-items: center; gap: 6px; }
      .section { padding: 10px 12px; }
      .line { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
      .word-text { line-height: 1.4; word-break: break-word; flex: 1; }
      .accent-buttons { display: flex; gap: 3px; }
      .accent-btn {
        width: 28px; height: 18px; display: flex; align-items: center; justify-content: center;
        background: #fff; border: 1px solid #ddd; border-radius: 3px;
        font-size: 9px; font-weight: bold; cursor: pointer; color: #7f8c8d;
      }
      .accent-btn:hover { background: #3498db; color: white; }
      .footer { padding: 4px 12px; background: #f8f9fa; border-top: 1px solid #eee; display: flex; justify-content: space-between; }
      .forvo-link { color: #3498db; text-decoration: none; font-size: 11px; cursor: pointer; }
      .close-btn { background: none; border: none; color: #95a5a6; font-size: 20px; cursor: pointer; }
    `;
    this.shadowRoot.appendChild(style);
    document.body.appendChild(this.container);
  }

  public async show(x: number, y: number, text: string) {
    if (!this.shadowRoot) return;
    this.hide();
    await this.loadSettings();
    this.originalText = text;
    this.historyIndex = 0;

    this.popup = document.createElement("div");
    this.popup.className = "popup";
    this.popup.style.left = `${x}px`;
    this.popup.style.top = `${y}px`;

    const langOptions = Object.entries(LANGUAGES)
      .map(([code, name]) => `<option value="${code}">${name}</option>`)
      .join("");

    this.popup.innerHTML = `
      <div class="header">
        <div class="lang-selects">
          <select id="src-lang">${langOptions}</select>
          <span>→</span>
          <select id="target-lang">${langOptions}</select>
        </div>
        <div class="header-controls">
          <button id="prev-btn" class="nav-btn">←</button>
          <button id="next-btn" class="nav-btn">→</button>
          <button id="close-btn" class="close-btn">&times;</button>
        </div>
      </div>
      <div id="original-section" class="section"></div>
      <div id="translation-section" class="section"></div>
      <div class="footer">
        <a href="#" id="forvo-link" class="forvo-link" target="_blank">Forvo</a>
        <span style="font-size: 9px; color: #bdc3c7">v${this.version}</span>
      </div>
    `;

    this.shadowRoot.appendChild(this.popup);

    const srcSelect = this.popup.querySelector("#src-lang") as HTMLSelectElement;
    const targetSelect = this.popup.querySelector("#target-lang") as HTMLSelectElement;
    this.currentFrom = "auto";
    this.currentTo = this.nativeLang;
    srcSelect.value = this.currentFrom;
    targetSelect.value = this.currentTo;

    srcSelect.onchange = () => {
      this.currentFrom = srcSelect.value;
      this.requestTranslation();
    };
    targetSelect.onchange = () => {
      this.currentTo = targetSelect.value;
      this.requestTranslation();
    };

    this.popup.querySelector("#close-btn")?.addEventListener("click", () => this.hide());
    this.popup.querySelector("#prev-btn")?.addEventListener("click", () => this.navigateHistory(1));
    this.popup.querySelector("#next-btn")?.addEventListener("click", () => this.navigateHistory(-1));

    this.requestTranslation();
    setTimeout(() => document.addEventListener("mousedown", this.handleOutsideClick), 100);
  }

  private async navigateHistory(direction: number) {
    const history = await CacheManager.getHistory();
    const newIndex = this.historyIndex + direction;
    if (newIndex >= 0 && newIndex < history.length) {
      this.historyIndex = newIndex;
      console.log("Current history index:", this.historyIndex);
      this.applyHistoryItem(history[this.historyIndex]);
    }
    this.updateNavButtons();
  }

  private applyHistoryItem(item: HistoryItem) {
    this.originalText = item.text;
    this.currentFrom = item.from;
    this.currentTo = item.to;
    this.updateResult(item.translation);
  }

  private async updateNavButtons() {
    if (!this.popup) return;
    const history = await CacheManager.getHistory();
    const prevBtn = this.popup.querySelector("#prev-btn") as HTMLButtonElement;
    const nextBtn = this.popup.querySelector("#next-btn") as HTMLButtonElement;
    prevBtn.disabled = this.historyIndex >= history.length - 1;
    nextBtn.disabled = this.historyIndex <= 0;
  }

  private handleOutsideClick = (e: MouseEvent) => {
    if (this.popup && !e.composedPath().includes(this.popup)) this.hide();
  };

  private requestTranslation() {
    chrome.runtime.sendMessage(
      {
        type: "TRANSLATE",
        payload: {
          text: this.originalText,
          from: this.currentFrom,
          to: this.currentTo,
        },
      },
      (res) => {
        if (res) {
          const detected = res.detectedLanguage || "en";
          if (this.currentFrom === "auto" && detected === this.nativeLang) {
            this.currentTo = this.learningLang;
            this.currentFrom = detected;
            this.requestTranslation();
            return;
          }
          this.updateResult(res);
          this.historyIndex = 0;
          console.log("Current history index:", this.historyIndex);
          this.updateNavButtons();
        }
      },
    );
  }

  private updateResult(res: any) {
    if (!this.popup) return;
    const data = typeof res === "string" ? JSON.parse(res) : res;
    const originalSection = this.popup.querySelector("#original-section");
    const translationSection = this.popup.querySelector("#translation-section");

    if (originalSection) {
      originalSection.innerHTML = "";
      originalSection.appendChild(
        this.createLine(this.originalText, this.currentFrom === "auto" ? "en" : this.currentFrom),
      );
    }

    if (translationSection) {
      translationSection.innerHTML = "";
      translationSection.appendChild(this.createLine(data.translatedText, this.currentTo));
      (data.alternatives || []).forEach((alt: string) => {
        translationSection.appendChild(this.createLine(alt, this.currentTo));
      });
    }
    this.updateForvoLink();
  }

  private createLine(text: string, lang: string): HTMLElement {
    const line = document.createElement("div");
    line.className = "line";
    const wordText = document.createElement("div");
    wordText.className = "word-text";
    wordText.textContent = text;

    const accentButtons = document.createElement("div");
    accentButtons.className = "accent-buttons";
    const accents = getAccentsForLanguage(lang);
    const list = accents.length > 0 ? accents : [{ code: lang, label: "🔊" }];

    list.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "accent-btn";
      btn.textContent = a.label;
      btn.onclick = () => this.speak(text, a.code);
      accentButtons.appendChild(btn);
    });

    line.appendChild(wordText);
    line.appendChild(accentButtons);
    return line;
  }

  private speak(text: string, langCode: string) {
    console.log("%c--- SPEAK REQUEST ---", "color: orange; font-weight: bold;");
    console.log("Text:", text, "Lang:", langCode);
    console.log("Runtime ID:", chrome.runtime.id);
    chrome.runtime.sendMessage({ type: "SPEAK", payload: { text, langCode } }, (response) => {
      console.log("Background response:", response);
      if (chrome.runtime.lastError) {
        // Если вы видите это в консоли страницы — значит Background не слушает
        console.error("SEND ERROR:", chrome.runtime.lastError.message);
      } else {
        console.log("SUCCESS:", response);
      }
    });
  }

  private updateForvoLink() {
    const link = this.popup?.querySelector("#forvo-link") as HTMLAnchorElement;
    if (link) {
      const word = this.originalText
        .split(/\s+/)[0]
        .toLowerCase()
        .replace(/[^\wа-яё]/gi, "");
      link.href = `https://forvo.com/word/${encodeURIComponent(word)}/#${this.currentFrom === "auto" ? "en" : this.currentFrom}`;
      link.textContent = `Forvo: "${word}"`;
    }
  }

  public hide() {
    if (this.popup && this.shadowRoot) {
      document.removeEventListener("mousedown", this.handleOutsideClick);
      this.shadowRoot.removeChild(this.popup);
      this.popup = null;
    }
  }
}
