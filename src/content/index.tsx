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
  shadowRoot = container.attachShadow({ mode: 'open' });
  document.body.appendChild(container);
}

function showPopup(text: string) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  initContainer();
  if (!shadowRoot) return;

  if (reactRoot) {
    reactRoot.unmount();
  }

  const rootDiv = document.createElement('div');
  shadowRoot.innerHTML = '';
  shadowRoot.appendChild(rootDiv);
  
  // Calculate smart position
  const popupWidth = 350;
  const popupHeight = 200; // Estimated initial height
  const margin = 10;

  let x = rect.left + window.scrollX;
  let y = rect.bottom + window.scrollY + margin;

  // Check right boundary
  if (x + popupWidth > window.innerWidth + window.scrollX) {
    x = window.innerWidth + window.scrollX - popupWidth - margin;
  }

  // Check left boundary
  if (x < window.scrollX) {
    x = window.scrollX + margin;
  }

  // Check bottom boundary (if no space below, show above)
  if (y + popupHeight > window.innerHeight + window.scrollY) {
    const spaceAbove = rect.top + window.scrollY - popupHeight - margin;
    if (spaceAbove > window.scrollY) {
      y = spaceAbove;
    }
  }

  reactRoot = createRoot(rootDiv);
  reactRoot.render(
    <PopupApp 
      x={x} 
      y={y} 
      initialText={text} 
      onClose={hidePopup} 
      version={version}
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
