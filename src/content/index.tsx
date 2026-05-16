import { createRoot, Root } from 'react-dom/client';
import { PopupApp } from './PopupApp';

console.log('Quick Translator: Content script initialized');

let container: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

const version = chrome.runtime.getManifest().version;

function initContainer() {
  if (!container) {
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
  }

  const target = document.body || document.documentElement;
  if (target && container.parentElement !== target) {
    target.appendChild(container);
  } else if (target) {
    // Move to end of body to ensure highest z-order among elements with same z-index
    target.appendChild(container);
  }
}

async function showPopup(text: string, rect: DOMRect) {
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
    document.addEventListener('mousedown', handleOutsideClick, { capture: true });
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
  document.removeEventListener('mousedown', handleOutsideClick, { capture: true });
}

const handleOutsideClick = (event: MouseEvent) => {
  if (container && (container as any).isPinned) return;
  const path = event.composedPath();
  if (container && !path.includes(container)) {
    hidePopup();
  }
};

function getSelectionData() {
  // 1. Standard selection
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const text = selection.toString().trim();
    if (text) {
      try {
        const range = selection.getRangeAt(0);
        return {
          text,
          rect: range.getBoundingClientRect()
        };
      } catch (e) {
        // Range might be invalid in some edge cases
      }
    }
  }

  // 2. Input/Textarea selection
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    try {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      if (start !== null && end !== null && start !== end) {
        const text = activeElement.value.substring(start, end).trim();
        if (text) {
          return {
            text,
            rect: activeElement.getBoundingClientRect()
          };
        }
      }
    } catch (e) {
      // Some input types don't support selection properties
    }
  }

  return null;
}

document.addEventListener('mouseup', (event) => {
  const path = event.composedPath();
  const isInsidePopup = path.some(el => 
    el instanceof HTMLElement && el.classList.contains('translator-popup-container')
  );
  
  if (isInsidePopup) return;

  // Delay to ensure selection is updated
  setTimeout(() => {
    const data = getSelectionData();
    if (data) {
      showPopup(data.text, data.rect);
    }
  }, 10);
}, { capture: true });
