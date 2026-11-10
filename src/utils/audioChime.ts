/**
 * Web Audio API synthesizer for macOS native Ping chime sound.
 * Faithfully reproduces the high-resonance crystalline chime of /System/Library/Sounds/Ping.aiff
 * without requiring external sound files or network requests.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play the macOS Ping chime.
 * Synthesizes a resonant bell chime with a fundamental frequency at ~1240 Hz
 * accompanied by subtle harmonic overtones at ~2480 Hz and ~3720 Hz,
 * with an initial crisp strike and smooth exponential decay over 1.25 seconds.
 */
export function playMacPingChime(volume: number = 0.85): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.45, now);
    masterGain.connect(ctx.destination);

    // Fundamental tone: ~1240 Hz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1244.5, now); // D#6 note typical of Apple Ping
    // Slight initial pitch bend down simulating bell strike
    osc1.frequency.exponentialRampToValueAtTime(1238, now + 0.15);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.9, now + 0.006); // 6ms attack
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    // First Harmonic: ~2480 Hz (adds crystalline clarity)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2489, now);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.35, now + 0.004);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    // Subtle strike transient (white noise burst filtered at 3kHz)
    const strikeDuration = 0.035;
    const bufferSize = Math.floor(ctx.sampleRate * strikeDuration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2400, now);
    noiseFilter.Q.setValueAtTime(4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + strikeDuration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    // Start oscillators
    osc1.start(now);
    osc2.start(now);
    noiseSource.start(now);

    osc1.stop(now + 1.3);
    osc2.stop(now + 0.9);
    noiseSource.stop(now + strikeDuration);
  } catch {
    // Gracefully handle browser autoplay blocks
  }
}
