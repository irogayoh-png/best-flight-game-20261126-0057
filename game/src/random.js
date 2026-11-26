// random.js — one small seeded generator, so the archipelago and every
// sortie are the same for the same seed, and screenshots are reproducible.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return function next() {
    // xorshift32: cheap, deterministic, good enough for placement.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

export function pickRange(rng, min, max) {
  return min + rng() * (max - min);
}

export function pickInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function wrapAngleDeg(angle) {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

export function angleDifferenceDeg(from, to) {
  return wrapAngleDeg(to - from);
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
