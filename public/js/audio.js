/**
 * Holiday Music Chime Synthesizer (Web Audio API)
 * Plays charming, gentle Christmas carols with bell/music-box acoustics
 */
(function () {
  let audioCtx = null;
  let isPlaying = false;
  let noteTimeout = null;
  let currentNoteIndex = 0;

  // Notes frequencies in Hz
  const NOTES = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    REST: 0
  };

  // Melody: "We Wish You a Merry Christmas"
  const MELODY_WE_WISH_YOU = [
    { note: NOTES.D4, duration: 400 },
    { note: NOTES.G4, duration: 400 },
    { note: NOTES.G4, duration: 200 },
    { note: NOTES.A4, duration: 200 },
    { note: NOTES.G4, duration: 200 },
    { note: NOTES.F4, duration: 200 },
    { note: NOTES.E4, duration: 400 },
    { note: NOTES.E4, duration: 400 },
    { note: NOTES.E4, duration: 400 },
    { note: NOTES.A4, duration: 400 },
    { note: NOTES.A4, duration: 200 },
    { note: NOTES.B4, duration: 200 },
    { note: NOTES.A4, duration: 200 },
    { note: NOTES.G4, duration: 200 },
    { note: NOTES.F4, duration: 400 },
    { note: NOTES.D4, duration: 400 },
    { note: NOTES.D4, duration: 400 },
    { note: NOTES.B4, duration: 400 },
    { note: NOTES.B4, duration: 200 },
    { note: NOTES.C5, duration: 200 },
    { note: NOTES.B4, duration: 200 },
    { note: NOTES.A4, duration: 200 },
    { note: NOTES.G4, duration: 400 },
    { note: NOTES.E4, duration: 400 },
    { note: NOTES.D4, duration: 200 },
    { note: NOTES.D4, duration: 200 },
    { note: NOTES.E4, duration: 400 },
    { note: NOTES.A4, duration: 400 },
    { note: NOTES.F4, duration: 400 },
    { note: NOTES.G4, duration: 800 },
    { note: NOTES.REST, duration: 600 }
  ];

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Play a chime/celesta harmonic note
  function playChime(freq, durationMs) {
    if (!freq || freq === 0) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    // Master gain for this note
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    // Fast attack (metallic strike of chime)
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    // Smooth natural decay
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration * 1.5, 0.4));

    // Primary fundamental oscillator (sine/triangle chime)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);

    // Harmonic overtone (crystal sparkle)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.003, now); // slightly detuned harmonic

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.08, now);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(duration * 0.8, 0.2));

    osc1.connect(gainNode);
    osc2.connect(harmGain);
    harmGain.connect(gainNode);

    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration * 1.8);
    osc2.stop(now + duration * 1.8);
  }

  function playNextNote() {
    if (!isPlaying) return;

    const noteObj = MELODY_WE_WISH_YOU[currentNoteIndex];
    if (noteObj) {
      playChime(noteObj.note, noteObj.duration);
      currentNoteIndex = (currentNoteIndex + 1) % MELODY_WE_WISH_YOU.length;
      noteTimeout = setTimeout(playNextNote, noteObj.duration);
    }
  }

  function toggle() {
    if (isPlaying) {
      stop();
      return false;
    } else {
      start();
      return true;
    }
  }

  function start() {
    if (isPlaying) return;
    getAudioContext();
    isPlaying = true;
    currentNoteIndex = 0;
    playNextNote();
    updateUIButtons(true);
  }

  function stop() {
    isPlaying = false;
    if (noteTimeout) clearTimeout(noteTimeout);
    updateUIButtons(false);
  }

  function updateUIButtons(playing) {
    const btns = document.querySelectorAll('.music-toggle-btn');
    btns.forEach(btn => {
      if (playing) {
        btn.innerHTML = '🔔 <span class="hidden sm:inline">Música:</span> ON 🎶';
        btn.classList.add('animate-pulse');
        btn.classList.remove('opacity-75');
      } else {
        btn.innerHTML = '🔕 <span class="hidden sm:inline">Música:</span> OFF';
        btn.classList.remove('animate-pulse');
        btn.classList.add('opacity-75');
      }
    });
  }

  window.HolidayAudio = {
    start,
    stop,
    toggle,
    isPlaying: () => isPlaying
  };
})();
