console.log('Offscreen: Script loaded and listener registered.');

let currentAudio: HTMLAudioElement | null = null;

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'PLAY_AUDIO') {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    console.log('Offscreen: Received request to play:', message.url.substring(0, 50) + '...');
    const audio = new Audio(message.url);
    currentAudio = audio;
    
    audio.play()
      .then(() => {
        console.log('Offscreen: Successfully playing');
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

  if (message.type === 'STOP_AUDIO_INTERNAL') {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = ''; // Force cleanup
      currentAudio = null;
      console.log('Offscreen: Audio stopped and cleared');
    }
  }
});
