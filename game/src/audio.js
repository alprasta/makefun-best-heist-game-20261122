// Tiny WebAudio synth for Gilded Midnight. No sound files: every cue is a
// short oscillator blip, built the first time the player interacts.

let ctx = null;

function audio() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const ac = audio();
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
}

function tone(freq, seconds, type, gain, when = 0) {
  const ac = audio();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ac.currentTime + when;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(amp).connect(ac.destination);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  } catch {
    // Sound is garnish; a blocked context must never break the game.
  }
}

export const sfx = {
  pickup() {
    tone(880, 0.12, 'sine', 0.12);
    tone(1318, 0.16, 'sine', 0.1, 0.07);
  },
  mainLoot() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.09));
  },
  coin() {
    tone(1567, 0.09, 'square', 0.05);
    tone(2093, 0.12, 'square', 0.04, 0.05);
  },
  hack() {
    tone(440, 0.1, 'sawtooth', 0.05);
    tone(660, 0.14, 'sawtooth', 0.05, 0.08);
  },
  spotted() {
    tone(220, 0.25, 'sawtooth', 0.09);
  },
  caught() {
    [392, 311, 233, 175].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.1, i * 0.14));
  },
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.11, i * 0.1));
  },
  alarmTick() {
    tone(980, 0.07, 'square', 0.035);
  },
};
