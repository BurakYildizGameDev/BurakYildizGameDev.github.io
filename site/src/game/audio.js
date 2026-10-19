// Synthesized sound effects (no audio files to download). Off by default; the AudioContext is
// only created once the visitor turns sound on, which also satisfies autoplay rules.

let ctx = null;
let master = null;
let noise = null;
let enabled = false;
let lastShot = 0;

function init() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return true;
}

function tone({ type = 'sine', from, to = from, dur, gain = 0.3, at = 0 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hiss({ dur, gain = 0.4, from = 3000, to = 200 }) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const SOUNDS = {
  // A gunshot: a sharp noise crack, a pitched-down body and a low punch.
  shoot() {
    const now = performance.now();
    if (now - lastShot < 50) return;
    lastShot = now;
    hiss({ dur: 0.09, gain: 0.32, from: 7000, to: 900 });
    tone({ type: 'square', from: 240, to: 60, dur: 0.1, gain: 0.08 });
    tone({ type: 'sine', from: 130, to: 42, dur: 0.16, gain: 0.32 });
  },
  impact() {
    hiss({ dur: 0.08, gain: 0.3, from: 9000, to: 2200 });
    tone({ type: 'triangle', from: 1500, to: 520, dur: 0.07, gain: 0.12 });
    tone({ type: 'sine', from: 220, to: 90, dur: 0.12, gain: 0.2 });
  },
  explode() {
    hiss({ dur: 1.2, gain: 0.75, from: 3200, to: 50 });
    tone({ type: 'sine', from: 95, to: 26, dur: 1, gain: 0.75 });
    tone({ type: 'sawtooth', from: 170, to: 40, dur: 0.35, gain: 0.12 });
  },
  discover() {
    tone({ from: 660, dur: 0.18, gain: 0.18 });
    tone({ from: 990, dur: 0.3, gain: 0.16, at: 0.09 });
  },
  celebrate() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.35, gain: 0.18, at: i * 0.11 }));
  },
};

export const sound = {
  get enabled() {
    return enabled;
  },
  setEnabled(on) {
    enabled = on;
    if (on && !ctx && !init()) enabled = false;
    if (ctx) (on ? ctx.resume() : ctx.suspend()).catch(() => {});
  },
  play(name) {
    if (!enabled || !ctx) return;
    SOUNDS[name]?.();
  },
};
