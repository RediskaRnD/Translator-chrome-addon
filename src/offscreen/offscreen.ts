console.log('Offscreen: Script loaded and listener registered.');

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAY_AUDIO') {
    console.log('Offscreen: Received request to play:', message.url);
    const audio = new Audio(message.url);
    
    audio.play()
      .then(() => {
        console.log('Offscreen: Successfully playing:', message.url);
      })
      .catch(err => {
        console.error('Offscreen: Play error:', err);
        // Сообщаем обратно об ошибке, если нужно
      });
      
    audio.onerror = (e) => {
      console.error('Offscreen: Audio element error:', e);
    };
  }
});
