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

  private historyIndex: number = -1;

  private isDragging = false;
  private offsetX = 0;
  private offsetY = 0;
  private version: string = "1.0.0";

  constructor() {
    this.version = chrome.runtime.getManifest().version;
    this.initContainer();
    this.loadSettings();
  }

  private async loadSettings() {
    const settings = await chrome.storage.local.get([
      "nativeLang",
      "learningLang",
    ]);
    if (typeof settings.nativeLang === "string")
      this.nativeLang = settings.nativeLang;
    if (typeof settings.learningLang === "string")
      this.learningLang = settings.learningLang;
  }

  private initContainer() {
    this.container = document.createElement("div");
    this.container.className = "translator-popup-container";
    this.shadowRoot = this.container.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
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
        cursor: grab;
      }
      .popup:active { cursor: grabbing; }
      .header {
        background: #f1f3f5;
        padding: 8px 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #e0e0e0;
      }
      .header-controls { display: flex; align-items: center; gap: 10px; }
      .nav-arrows { display: flex; gap: 4px; pointer-events: auto; }
      .nav-btn {
        background: #fff; border: 1px solid #ccc; border-radius: 3px;
        padding: 1px 6px; cursor: pointer; font-size: 14px; color: #7f8c8d;
      }
      .nav-btn:disabled { opacity: 0.3; cursor: default; }
      .nav-btn:hover:not(:disabled) { background: #eee; }
      .lang-selects { display: flex; align-items: center; gap: 6px; pointer-events: auto; }
      select, button, a { cursor: auto; pointer-events: auto; }
      .section { padding: 10px 12px; user-select: text; pointer-events: none; }
      .original-section { border-bottom: 1px solid #f0f0f0; background: #fff; }
      .translation-section { background: #fafafa; }
      .line {
        display: flex; justify-content: space-between; align-items: flex-start;
        gap: 10px; margin-bottom: 8px; pointer-events: auto;
      }
      .line:last-child { margin-bottom: 0; }
      .word-text { line-height: 1.4; word-break: break-word; flex: 1; }
      .accent-buttons { display: flex; gap: 3px; flex-shrink: 0; margin-top: 2px; }
      .accent-btn {
        width: 28px; height: 18px; display: flex; align-items: center; justify-content: center;
        background: #fff; border: 1px solid #ddd; border-radius: 3px;
        font-size: 9px; font-weight: bold; cursor: pointer; color: #7f8c8d;
      }
      .accent-btn:hover { background: #3498db; color: white; border-color: #3498db; }
      .footer {
        padding: 4px 12px; background: #f8f9fa; border-top: 1px solid #eee;
        display: flex; justify-content: space-between; align-items: center;
      }
      .forvo-link { color: #3498db; text-decoration: none; font-size: 11px; cursor: pointer; pointer-events: auto; }
      .forvo-link:hover { text-decoration: underline; }
      .version { font-size: 9px; color: #bdc3c7; }
      .close-btn { background: none; border: none; color: #95a5a6; font-size: 20px; cursor: pointer; padding: 0 4px; }
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
    console.log("Current history index:", this.historyIndex);

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
          <span style="color: #bdc3c7">→</span>
          <select id="target-lang">${langOptions}</select>
        </div>
        <div class="header-controls">
          <div class="nav-arrows">
            <button class="nav-btn" id="prev-btn" title="Older searches">←</button>
            <button class="nav-btn" id="next-btn" title="Newer searches">→</button>
          </div>
          <button class="close-btn" id="close-btn">&times;</button>
        </div>
      </div>
      <div class="section original-section" id="original-section"></div>
      <div class="section translation-section" id="translation-section">
        <div class="line"><div class="word-text">Translating...</div></div>
      </div>
      <div class="footer">
        <a href="#" target="_blank" class="forvo-link" id="forvo-link">Forvo Pronunciation</a>
        <span class="version">v${this.version}</span>
      </div>
    `;

    this.shadowRoot.appendChild(this.popup);

    const srcSelect = this.popup.querySelector("#src-lang") as HTMLSelectElement;
    const targetSelect = this.popup.querySelector("#target-lang") as HTMLSelectElement;

    this.currentFrom = "auto";
    this.currentTo = this.nativeLang;
    srcSelect.value = this.currentFrom;
    targetSelect.value = this.currentTo;

    const stopDrag = (e: MouseEvent) => {
      console.log("Drag stopped: clicked on select element:", e.target);
      e.stopPropagation();
    };

    srcSelect.onmousedown = stopDrag;
    targetSelect.onmousedown = stopDrag;

    const closeBtn = this.popup.querySelector("#close-btn") as HTMLElement;
    const prevBtn = this.popup.querySelector("#prev-btn") as HTMLElement;
    const nextBtn = this.popup.querySelector("#next-btn") as HTMLElement;
    const forvoLink = this.popup.querySelector("#forvo-link") as HTMLElement;

    if (closeBtn) closeBtn.onmousedown = stopDrag;
    if (prevBtn) prevBtn.onmousedown = stopDrag;
    if (nextBtn) nextBtn.onmousedown = stopDrag;
    if (forvoLink) forvoLink.onmousedown = stopDrag;

    closeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
    });
    prevBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateHistory(1);
    });
    nextBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.navigateHistory(-1);
    });

    this.initDragAndDrop();
    this.requestTranslation();

    setTimeout(
      () => document.addEventListener("mousedown", this.handleOutsideClick),
      100,
    );
  }

  private async navigateHistory(direction: number) {
    const history = await CacheManager.getHistory();
    if (history.length === 0) return;

    let newIndex = this.historyIndex + direction;

    if (newIndex >= 0 && newIndex < history.length) {
      this.historyIndex = newIndex;
      console.log("Current history index:", this.historyIndex);
      this.applyHistoryItem(history[this.historyIndex]);
    }
    this.updateNavButtons();
  }

  private applyHistoryItem(item: HistoryItem) {
    if (!this.popup) return;
    this.originalText = item.text;
    this.currentFrom = item.from;
    this.currentTo = item.to;

    const srcSelect = this.popup.querySelector(
      "#src-lang",
    ) as HTMLSelectElement;
    const targetSelect = this.popup.querySelector(
      "#target-lang",
    ) as HTMLSelectElement;
    srcSelect.value = this.currentFrom;
    targetSelect.value = this.currentTo;

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
    if (!this.popup) return;
    if (!e.composedPath().includes(this.popup)) this.hide();
  };

  private initDragAndDrop() {
    if (!this.popup) return;

    const onMouseDown = (e: MouseEvent) => {
      // Игнорируем любые клики не левой кнопкой мыши
      if (e.button !== 0) return;

      const path = e.composedPath();
      console.log("Mouse down path:", path);
      console.log("Clicked element:", e.target);
      // Список элементов, которые НЕ должны инициализировать драг
      const isInteractive = path.some((el) => {
        if (!(el instanceof HTMLElement)) return false;
        const tagName = el.tagName.toUpperCase();
        return (
          ["BUTTON", "SELECT", "A", "OPTION", "INPUT", "LABEL"].includes(
            tagName,
          ) ||
          el.classList.contains("lang-selects") ||
          el.classList.contains("accent-buttons") ||
          el.classList.contains("nav-arrows") ||
          el.classList.contains("header-controls")
        );
      });

      if (isInteractive) {
        console.log("Drag blocked: clicked on interactive element");
        return;
      }

      this.isDragging = true;
      const rect = this.popup!.getBoundingClientRect();
      this.offsetX = e.clientX - rect.left;
      this.offsetY = e.clientY - rect.top;

      // Визуальный фидбек
      this.popup!.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!this.isDragging || !this.popup) return;
        this.popup.style.left = `${moveEvent.clientX - this.offsetX}px`;
        this.popup.style.top = `${moveEvent.clientY - this.offsetY}px`;
      };

      const onMouseUp = () => {
        this.isDragging = false;
        if (this.popup) this.popup.style.cursor = "grab";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    // Очищаем старый обработчик если был
    this.popup.onmousedown = null;
    this.popup.addEventListener("mousedown", onMouseDown);
  }

  private requestTranslation() {
    const translationSection = this.popup?.querySelector(
      "#translation-section",
    );
    if (translationSection)
      translationSection.innerHTML =
        '<div class="line"><div class="word-text">Translating...</div></div>';

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
    let data = typeof res === "string" ? JSON.parse(res) : res;
    const mainText = data.translatedText || "";
    const alternatives = data.alternatives || [];

    const originalSection = this.popup.querySelector("#original-section");
    const translationSection = this.popup.querySelector("#translation-section");

    if (originalSection) {
      originalSection.innerHTML = "";
      originalSection.appendChild(
        this.createLine(
          this.originalText,
          this.currentFrom === "auto" ? "en" : this.currentFrom,
        ),
      );
    }

    if (translationSection) {
      translationSection.innerHTML = "";
      translationSection.appendChild(this.createLine(mainText, this.currentTo));
      alternatives.forEach((alt: string) => {
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
    const list =
      accents.length > 0
        ? accents.map((a) => ({ code: a.code, label: a.label, name: a.name }))
        : [{ code: lang, label: "🔊", name: "Speak" }];

    list.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "accent-btn";
      btn.textContent = a.label;
      btn.title = a.name;
      btn.onmousedown = (e) => e.stopPropagation();
      btn.onclick = (e) => {
        e.stopPropagation();
        this.speak(text, a.code);
      };
      accentButtons.appendChild(btn);
    });
    line.appendChild(wordText);
    line.appendChild(accentButtons);
    return line;
  }

  private speak(text: string, langCode: string) {
    chrome.runtime.sendMessage({ type: "SPEAK", payload: { text, langCode } });
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
