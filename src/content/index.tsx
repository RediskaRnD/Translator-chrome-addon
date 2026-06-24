import { createRoot, Root } from 'react-dom/client';
import { PopupApp } from './PopupApp';

console.log('Quick Translator: Content script initialized');
let container: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: Root | null = null;
let lastSelectionAtMouseDown: { text: string, rect: any } | null = null;

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
    console.log('QT Subframe: Sending selection to parent', { text, rect });
    window.parent.postMessage({
      type: 'QT_SELECTION',
      text,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right || (rect.left + (rect.width || 0)),
        bottom: rect.bottom || (rect.top + (rect.height || 0)),
        width: rect.width || 0,
        height: rect.height || 0
      }
    }, '*');
    return;
  }

  console.log('QT Topframe: showPopup called', { text, rect });
  initContainer();
  if (!shadowRoot) {
    console.warn('QT Topframe: No shadowRoot found');
    return;
  }

  const isPinned = container ? (container as any).isPinned : false;

  const settings = await chrome.storage.local.get(['uiScale', 'theme']);
  const scale = (settings.uiScale as number) || 1.0;
  const theme = (settings.theme as 'light' | 'dark' | 'system') || 'system';

  let x = 0;
  let y = 0;

  if (!isPinned) {
    const popupWidth = 350; // Base width from CSS
    const popupHeight = 400; // Base height estimate
    const margin = 10;

    // We calculate position in absolute pixels first, 
    // but the boundary checks must account for the scale.
    const scaledWidth = popupWidth * scale;
    const scaledHeight = popupHeight * scale;

    x = rect.left;
    y = rect.bottom + margin;

    // Keep within viewport boundaries, accounting for scale
    if (x + scaledWidth > window.innerWidth) x = window.innerWidth - scaledWidth - margin;
    if (x < 0) x = margin;

    if (y + scaledHeight > window.innerHeight) {
      const spaceAbove = rect.top - scaledHeight - margin;
      if (spaceAbove > 0) {
        y = spaceAbove;
      } else {
        // If it doesn't fit anywhere, just keep it at the bottom but push up
        y = window.innerHeight - scaledHeight - margin;
      }
    }
    if (y < 0) y = margin;

    // The PopupApp component uses `zoom: scale` or CSS transform.
    // If we use `zoom`, the 'left' and 'top' values usually need to be 
    // divided by scale if the parent is scaled, OR kept as is if the parent is not.
    // Since our container is 100% width/height and not scaled, but the .popup 
    // element inside has `zoom: scale`, we need to pass coordinates that 
    // will result in the correct visual position AFTER the zoom is applied.
    x = x / scale;
    y = y / scale;
  }
  console.log('QT Topframe: Rendering popup at', { x, y, isPinned });

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
    console.log(`QT Frame [${window === window.top ? 'TOP' : 'SUB'}]: Received QT_SELECTION`, { text, rect });

    // Find the iframe that sent the message
    const iframes = document.querySelectorAll('iframe, frame');
    const senderIframe = Array.from(iframes).find(f => (f as any).contentWindow === event.source);

    let absoluteRect = rect;
    if (senderIframe) {
      const offset = senderIframe.getBoundingClientRect();
      absoluteRect = {
        left: rect.left + offset.left,
        top: rect.top + offset.top,
        right: (rect.right || (rect.left + rect.width)) + offset.left,
        bottom: (rect.bottom || (rect.top + rect.height)) + offset.top,
        width: rect.width,
        height: rect.height
      };
      console.log('QT Frame: Found sender iframe, calculated absolute rect', absoluteRect);
    } else {
      console.warn('QT Frame: Could not find sender iframe, using relative rect');
    }

    if (window === window.top) {
      showPopup(text, absoluteRect);
    } else {
      console.log('QT Frame: Bubbling selection up to parent');
      window.parent.postMessage({
        type: 'QT_SELECTION',
        text,
        rect: absoluteRect
      }, '*');
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

function trimNonAlphanumeric(text: string): string {
  // Trim standard whitespace
  let trimmed = text.trim();
  // Remove non-alphanumeric characters from start and end
  // We include Unicode characters to support other languages
  // The regex [^\p{L}\p{N}]+ matches any character that is NOT a letter or a number
  trimmed = trimmed.replace(/^[^\p{L}\p{N}]+/u, '');
  trimmed = trimmed.replace(/[^\p{L}\p{N}]+$/u, '');
  return trimmed;
}

function getSelectionData(target?: EventTarget | null) {
  console.log('QT: getSelectionData start', { target });

  // 1. Standard selection (regular text)
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const rawText = selection.toString();
    const text = trimNonAlphanumeric(rawText);

    if (text) {
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          console.log('QT: Detected standard selection', { text, rect });
          return {
            text,
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height
            }
          };
        }
      } catch (e) { }
    }
  }

  // 2. Input/Textarea selection
  // Try to find the input element: check target, then activeElement, then Shadow DOM
  let input: HTMLInputElement | HTMLTextAreaElement | null = null;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    input = target;
  } else {
    let active = document.activeElement;
    // Drill into shadow roots
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      input = active;
    }
  }

  if (input) {
    try {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      console.log('QT: Checking input selection', {
        tagName: input.tagName,
        start,
        end,
        valueLength: input.value.length
      });

      if (start !== null && end !== null && start !== end) {
        const rawText = input.value.substring(start, end);
        const text = trimNonAlphanumeric(rawText);

        if (text) {
          const rect = input.getBoundingClientRect();
          console.log('QT: Detected input selection', { text, rect });
          return {
            text,
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height
            }
          };
        }
      }
    } catch (e) {
      console.warn('QT: Error reading input selection', e);
    }
  }

  console.log('QT: No selection detected');
  return null;
}

document.addEventListener('mousedown', (event) => {
  if (!isContextValid()) return;

  const path = event.composedPath();
  const isInsidePopup = path.some(el =>
    el instanceof HTMLElement && (el.classList.contains('translator-popup-container') || el.classList.contains('popup'))
  );

  if (isInsidePopup) return;

  // Capture selection state at the moment of click
  lastSelectionAtMouseDown = getSelectionData(event.target);

  if (window !== window.top) {
    window.parent.postMessage({ type: 'QT_HIDE' }, '*');
  }
}, { capture: true });

document.addEventListener('mouseup', (event) => {
  if (!isContextValid()) return;

  const path = event.composedPath();
  const isInsidePopup = path.some(el =>
    el instanceof HTMLElement && (el.classList.contains('translator-popup-container') || el.classList.contains('popup'))
  );

  if (isInsidePopup) return;

  // Store target immediately
  const target = event.target;

  // Delay to ensure selection is updated
  setTimeout(() => {
    const currentData = getSelectionData(target);

    // Check if selection actually changed or is new
    const isNewSelection = currentData && (!lastSelectionAtMouseDown ||
      currentData.text !== lastSelectionAtMouseDown.text ||
      Math.abs(currentData.rect.left - lastSelectionAtMouseDown.rect.left) > 5 ||
      Math.abs(currentData.rect.top - lastSelectionAtMouseDown.rect.top) > 5);

    if (isNewSelection && currentData) {
      showPopup(currentData.text, currentData.rect);
    }
  }, 10);
}, { capture: true });
