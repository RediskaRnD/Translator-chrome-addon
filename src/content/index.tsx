import { createRoot, Root } from 'react-dom/client';
import { PopupApp } from './PopupApp';

console.log('Quick Translator: Content script initialized');

let container: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

const version = chrome.runtime.getManifest().version;

function initContainer() {
  if (container) return;
  container = document.createElement('div');
  container.className = 'translator-popup-container';
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '2147483647',
    pointerEvents: 'none'
  });
  shadowRoot = container.attachShadow({ mode: 'open' });
  document.body.appendChild(container);
}

async function showPopup(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  initContainer();
  if (!shadowRoot) return;

  const isPinned = (container as any).isPinned;

  // Get current scale and theme to calculate boundaries and prevent flash
  const settings = await chrome.storage.local.get(['uiScale', 'theme']);
  const scale = (settings.uiScale as number) || 1.0;
  const theme = (settings.theme as 'light' | 'dark' | 'system') || 'system';

  // Calculate smart position relative to viewport
  let x = 0;
  let y = 0;

  if (!isPinned) {
    const popupWidth = 350 * scale;
    const popupHeight = 200 * scale; 
    const margin = 10;

    x = rect.left;
    y = rect.bottom + margin;

    // Check right boundary
    if (x + popupWidth > window.innerWidth) {
      x = window.innerWidth - popupWidth - margin;
    }
    // Check left boundary
    if (x < 0) {
      x = margin;
    }

    // Check bottom boundary
    if (y + popupHeight > window.innerHeight) {
      const spaceAbove = rect.top - popupHeight - margin;
      if (spaceAbove > 0) {
        y = spaceAbove;
      }
    }
    
    // Safety check for top
    if (y < 0) y = margin;
  }

  if (!reactRoot) {
    const rootDiv = document.createElement('div');
    shadowRoot.innerHTML = '';
    shadowRoot.appendChild(rootDiv);
    reactRoot = createRoot(rootDiv);
  }

  reactRoot.render(
    <PopupApp 
      x={isPinned ? undefined : x} 
      y={isPinned ? undefined : y} 
      initialText={text} 
      onClose={hidePopup} 
      version={version}
      theme={theme}
    />
  );

  setTimeout(() => {
    document.addEventListener('mousedown', handleOutsideClick);
  }, 100);
}

function hidePopup() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (shadowRoot) {
    shadowRoot.innerHTML = '';
  }
  document.removeEventListener('mousedown', handleOutsideClick);
}

const handleOutsideClick = (event: MouseEvent) => {
  if (container && (container as any).isPinned) return;
  if (container && !event.composedPath().includes(container)) {
    hidePopup();
  }
};

document.addEventListener('mouseup', (event) => {
  const path = event.composedPath();
  const isInsidePopup = path.some(el => 
    el instanceof HTMLElement && el.classList.contains('translator-popup-container')
  );
  
  if (isInsidePopup) return;

  const selection = window.getSelection()?.toString().trim();
  if (selection) {
    showPopup(selection);
  }
});
