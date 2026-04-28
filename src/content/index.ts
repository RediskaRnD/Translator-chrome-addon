import { PopupManager } from './PopupManager';

console.log('Quick Translator: Content script initialized');

const popupManager = new PopupManager();

document.addEventListener('mouseup', (event) => {
  const selection = window.getSelection()?.toString().trim();
  console.log('Quick Translator: Mouseup detected, selection:', selection);
  if (selection) {
    const x = event.clientX + 10;
    const y = event.clientY + 10;
    console.log('Quick Translator: Showing popup at', x, y);
    popupManager.show(x, y, selection);
  }
});
