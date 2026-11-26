// audio.js — all sound is synthesised with WebAudio. No audio files,
// no network: an engine hum, wind, a ring chime, a landing thud and
// a low-fuel warning beep, all built from oscillators and noise.

export function newAudio() {
  return {
    ctx: null, muted: false,
    engineOsc: null, engineGain: null, windGain: null, windSrc: null,
    started: false,
  };
}

export function ensureAudio(audio) {
  if (audio.started || audio.ctx) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.ctx = ctx;
    // Engine: two detuned saws through a low-pass filter.
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc2.detune.value = 8;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    // Wind: looped filtered noise.
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    src.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    src.start();
    audio.engineOsc = osc1;
    audio.engineOsc2 = osc2;
    audio.engineGain = gain;
    audio.windGain = windGain;
    audio.started = true;
  } catch {
    audio.ctx = null;
  }
}

export function updateAudio(audio, plane, dt) {
  if (!audio.ctx || audio.muted) {
    if (audio.engineGain) audio.engineGain.gain.value = 0;
    if (audio.windGain) audio.windGain.gain.value = 0;
    return;
  }
  const ctx = audio.ctx;
  if (ctx.state === 'suspended') void ctx.resume();
  const throttle = plane.throttle / 100;
  const freq = 52 + throttle * 68 + (plane.airborne ? 12 : 0);
  audio.engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
  audio.engineOsc2.frequency.setTargetAtTime(freq * 1.5, ctx.currentTime, 0.08);
  audio.engineGain.gain.setTargetAtTime(0.05 + throttle * 0.05, ctx.currentTime, 0.1);
  const wind = plane.airborne ? Math.min(0.12, (plane.speedKts / 185) * 0.12) : 0;
  audio.windGain.gain.setTargetAtTime(wind, ctx.currentTime, 0.15);
  void dt;
}

export function playTone(audio, kind) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  if (kind === 'ring') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1318, now + 0.09);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.55);
  } else if (kind === 'landed') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (kind === 'crash') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.7);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.start(now);
    osc.stop(now + 0.85);
  } else if (kind === 'warn') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(1046, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.14);
  }
}
