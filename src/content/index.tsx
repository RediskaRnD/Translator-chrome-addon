import { createRoot, Root } from 'react-dom/client';
import { PopupApp } from './PopupApp';

console.log('Quick Translator: Content script initialized');

let container: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;

/**
 * Checks if the extension context is still valid.
 * When the extension is updated or reloaded, the content script context becomes invalidated.
 */
function isContextValid() {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

const version = isContextValid() ? chrome.runtime.getManifest().version : 'unknown';

function initContainer() {
  if (!isContextValid()) return;
  // Only the top-level window should manage the container
  if (window !== window.top) return;

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
    target.appendChild(container);
  }
}

async function showPopup(text: string, rect: any) {
  if (!isContextValid()) return;

  // If we are in an iframe, send the request to the top frame
  if (window !== window.top) {
    window.parent.postMessage({
      type: 'QT_SELECTION',
      text,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      }
    }, '*');
    return;
  }

  initContainer();
  if (!shadowRoot) return;

  const isPinned = container ? (container as any).isPinned : false;

  const settings = await chrome.storage.local.get(['uiScale', 'theme']);
  const scale = (settings.uiScale as number) || 1.0;
  const theme = (settings.theme as 'light' | 'dark' | 'system') || 'system';

  let x = 0;
  let y = 0;

  if (!isPinned) {
    const popupWidth = 350 * scale;
    const popupHeight = 200 * scale; 
    const margin = 10;

    x = rect.left;
    y = rect.bottom + margin;

    if (x + popupWidth > window.innerWidth) x = window.innerWidth - popupWidth - margin;
    if (x < 0) x = margin;
    if (y + popupHeight > window.innerHeight) {
      const spaceAbove = rect.top - popupHeight - margin;
      if (spaceAbove > 0) y = spaceAbove;
    }
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
    window.addEventListener('blur', handleBlur);
  }, 100);
}

// Global listener for cross-frame communication
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'QT_SELECTION') {
    const { text, rect } = event.data;
    
    // Find the iframe that sent the message
    const iframes = document.querySelectorAll('iframe');
    const senderIframe = Array.from(iframes).find(f => f.contentWindow === event.source);
    
    if (senderIframe) {
      const offset = senderIframe.getBoundingClientRect();
      const absoluteRect = {
        left: rect.left + offset.left,
        top: rect.top + offset.top,
        right: rect.right + offset.left,
        bottom: rect.bottom + offset.top,
        width: rect.width,
        height: rect.height
      };

      if (window === window.top) {
        showPopup(text, absoluteRect);
      } else {
        // Continue bubbling up
        window.parent.postMessage({
          type: 'QT_SELECTION',
          text,
          rect: absoluteRect
        }, '*');
      }
    }
  }

  if (event.data && event.data.type === 'QT_HIDE') {
    if (window === window.top) {
      hidePopup();
    } else {
      window.parent.postMessage({ type: 'QT_HIDE' }, '*');
    }
  }
});

function handleBlur() {
  if (container && (container as any).isPinned) return;
  hidePopup();
}

function hidePopup() {
  if (window !== window.top) {
    window.parent.postMessage({ type: 'QT_HIDE' }, '*');
    return;
  }

  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (shadowRoot) {
    shadowRoot.innerHTML = '';
  }
  document.removeEventListener('mousedown', handleOutsideClick, { capture: true });
  window.removeEventListener('blur', handleBlur);
}

const handleOutsideClick = (event: MouseEvent) => {
  if (window !== window.top) return; // Only top frame handles outside clicks for its popup

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

document.addEventListener('mousedown', (event) => {
  if (!isContextValid()) return;

  const path = event.composedPath();
  const isInsidePopup = path.some(el => 
    el instanceof HTMLElement && el.classList.contains('translator-popup-container')
  );
  
  if (isInsidePopup) return;

  if (window !== window.top) {
    window.parent.postMessage({ type: 'QT_HIDE' }, '*');
  } else {
    // Top frame handles its own outside clicks via handleOutsideClick
  }
}, { capture: true });

document.addEventListener('mouseup', (event) => {
  if (!isContextValid()) return;

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
