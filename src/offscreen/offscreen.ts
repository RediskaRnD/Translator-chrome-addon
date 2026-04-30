console.log('Offscreen: Script loaded and listener registered.');

let currentAudio: HTMLAudioElement | null = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAY_AUDIO') {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }

    console.log('Offscreen: Received request to play:', message.url);
    const audio = new Audio(message.url);
    currentAudio = audio;
    
    audio.play()
      .then(() => {
        console.log('Offscreen: Successfully playing:', message.url);
      })
      .catch(err => {
        console.error('Offscreen: Play error:', err);
      });
      
    audio.onerror = (e) => {
      console.error('Offscreen: Audio element error:', e);
    };

    audio.onended = () => {
      currentAudio = null;
    };
  }

  if (message.type === 'STOP_AUDIO') {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      console.log('Offscreen: Audio stopped');
    }
  }
});
