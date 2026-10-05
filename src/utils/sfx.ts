let globalAudioCtx: AudioContext | null = null;
let hasPlayedStartupSound = false;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    try {
      globalAudioCtx = new AudioContextClass({ sampleRate: 24000 });
    } catch {
      globalAudioCtx = new AudioContextClass();
    }
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

export async function unlockAudioContext(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // Ignore resume error if not in user gesture
    }
  }
  return ctx;
}

/**
 * Plays an original, rich, futuristic multi-layered startup and activation sound.
 * Guarded so that startup activation audio executes strictly once per intentional startup.
 */
export function playStartupActivationSound(customAudioUrl?: string): Promise<void> {
  if (hasPlayedStartupSound) {
    return Promise.resolve();
  }
  hasPlayedStartupSound = true;

  return new Promise((resolve) => {
    if (customAudioUrl) {
      try {
        const audio = new Audio(customAudioUrl);
        audio.onended = () => resolve();
        audio.onerror = () => {
          console.warn("Custom startup audio failed, falling back to synthesizer.");
          playSynthesizedStartupSound().then(resolve);
        };
        audio.play().catch(() => playSynthesizedStartupSound().then(resolve));
        return;
      } catch (err) {
        console.warn("Audio element error, falling back to synth:", err);
      }
    }

    playSynthesizedStartupSound().then(resolve);
  });
}

/**
 * Pure Web Audio API synthesized futuristic AI boot sequence.
 * 100% original, copyright-free, multi-layered energy activation.
 */
function playSynthesizedStartupSound(): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }

    const now = ctx.currentTime;

    // 1. SUB-BASS POWER SWELL (Warm rising energy)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(38, now);
    subOsc.frequency.exponentialRampToValueAtTime(80, now + 0.8);
    subOsc.frequency.linearRampToValueAtTime(55, now + 1.6);

    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.35, now + 0.3);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.9);

    // 2. CRYSTALLINE HOLOGRAPHIC CHIME (Harmonic shimmer)
    const chimeFreqs = [1200, 1800, 2400, 3200];
    chimeFreqs.forEach((freq, idx) => {
      const delay = idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + delay + 0.4);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.9);
    });

    // 3. ENERGY FIELD SWEEP (Resonant bandpass sweep)
    const sweepOsc = ctx.createOscillator();
    const sweepFilter = ctx.createBiquadFilter();
    const sweepGain = ctx.createGain();

    sweepOsc.type = 'sawtooth';
    sweepOsc.frequency.setValueAtTime(140, now + 0.1);
    sweepOsc.frequency.exponentialRampToValueAtTime(880, now + 0.9);

    sweepFilter.type = 'bandpass';
    sweepFilter.Q.value = 6;
    sweepFilter.frequency.setValueAtTime(200, now + 0.1);
    sweepFilter.frequency.exponentialRampToValueAtTime(2200, now + 0.9);

    sweepGain.gain.setValueAtTime(0, now + 0.1);
    sweepGain.gain.linearRampToValueAtTime(0.12, now + 0.4);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    sweepOsc.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(now + 0.1);
    sweepOsc.stop(now + 1.2);

    // 4. DIGITAL DATA SCAN BURSTS (High-tech micro clicks)
    for (let i = 0; i < 8; i++) {
      const clickTime = now + 0.2 + i * 0.05;
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(3200 + Math.random() * 1200, clickTime);

      clickGain.gain.setValueAtTime(0, clickTime);
      clickGain.gain.linearRampToValueAtTime(0.04, clickTime + 0.003);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, clickTime + 0.025);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(clickTime);
      clickOsc.stop(clickTime + 0.03);
    }

    // 5. FINAL CONFIRMATION HARMONIC TONE
    const confirmTime = now + 0.85;
    const confOsc = ctx.createOscillator();
    const confGain = ctx.createGain();
    confOsc.type = 'sine';
    confOsc.frequency.setValueAtTime(587.33, confirmTime); // D5
    confOsc.frequency.setValueAtTime(880, confirmTime + 0.12); // A5

    confGain.gain.setValueAtTime(0, confirmTime);
    confGain.gain.linearRampToValueAtTime(0.18, confirmTime + 0.03);
    confGain.gain.exponentialRampToValueAtTime(0.001, confirmTime + 0.9);

    confOsc.connect(confGain);
    confGain.connect(ctx.destination);
    confOsc.start(confirmTime);
    confOsc.stop(confirmTime + 1.0);

    setTimeout(() => {
      resolve();
    }, 1400);
  });
}

export function playStateChangeSound(_state: string) {
  // Intentionally silent: prevents repetitive mic open/close chirps on state transitions
}

export function playPanelMaterializeSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1000, now);
  filter.Q.value = 4;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.03, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

export function playDeactivationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const cut = ctx.createOscillator();
  const cutGain = ctx.createGain();
  cut.type = 'sine';
  cut.frequency.setValueAtTime(1600, now);
  cut.frequency.exponentialRampToValueAtTime(80, now + 0.35);

  cutGain.gain.setValueAtTime(0.15, now);
  cutGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  cut.connect(cutGain);
  cutGain.connect(ctx.destination);
  cut.start(now);
  cut.stop(now + 0.36);
}

// Backward compatibility alias
export const playActivationSound = playStartupActivationSound;
