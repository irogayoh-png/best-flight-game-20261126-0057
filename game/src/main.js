// main.js — the game loop: screens, timing, scoring, landing and crash
// reports, and the wiring between input, physics, missions and render.

import { GAME_NAME, WORLD } from './config.js';
import { buildWorld } from './world.js';
import { newFlightState, stepFlight } from './physics.js';
import { newMissionState, startSortie, stepMissions, reportLanding, fuelState } from './missions.js';
import { newInput, attachInput } from './input.js';
import { newAudio, ensureAudio, updateAudio, playTone } from './audio.js';
import { draw } from './render.js';
import { stageShot, shotFromUrl } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const game = {
  ctx,
  world: buildWorld(20261126),
  plane: newFlightState(),
  missions: newMissionState(1),
  input: newInput(),
  audio: newAudio(),
  screen: 'title', // title | flying | paused | crashed | landed | done
  time: 0,
  crashReason: '',
  landingLine: '',
  best: Number(localStorage.getItem('arunika-best') || 0),
  warnAt: 0,
};

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function startFlying() {
  ensureAudio(game.audio);
  game.plane = newFlightState();
  game.missions = newMissionState(1);
  startSortie(game.missions, game.world, game.plane, 1);
  game.screen = 'flying';
  game.crashReason = '';
  game.landingLine = '';
  setStatus(`${GAME_NAME}: sortie 1 — fly the rings, deliver the cargo, land on runway 09.`);
}

function nextSortie() {
  const sortie = game.missions.sortie + 1;
  game.plane = newFlightState();
  game.plane.fuel = 100;
  game.missions = newMissionState(sortie);
  startSortie(game.missions, game.world, game.plane, sortie);
  game.screen = 'flying';
  setStatus(`${GAME_NAME}: sortie ${sortie} — more wind, tighter rings.`);
}

function endSortie(result) {
  if (result.kind === 'crashed') {
    game.screen = 'crashed';
    game.crashReason = result.reason;
    playTone(game.audio, 'crash');
    saveBest();
    setStatus(`${GAME_NAME}: crashed — ${result.reason}. Score ${game.missions.score}.`);
  } else if (result.kind === 'landed') {
    const gained = reportLanding(game.missions, result);
    game.screen = 'landed';
    game.landingLine = result.perfect
      ? `Perfect landing — touchdown ${Math.round(result.speed)} kt, ${Math.round(result.vs)} fpm. +${gained} points.`
      : `Down safe — touchdown ${Math.round(result.speed)} kt, ${Math.round(result.vs)} fpm. +${gained} points.`;
    playTone(game.audio, 'landed');
    saveBest();
    setStatus(`${GAME_NAME}: landed on runway 09. Score ${game.missions.score}.`);
  }
}

function saveBest() {
  if (game.missions.score > game.best) {
    game.best = game.missions.score;
    try {
      localStorage.setItem('arunika-best', String(game.best));
    } catch { /* private mode: best score simply does not persist */ }
  }
}

function togglePause() {
  if (game.screen === 'flying') game.screen = 'paused';
  else if (game.screen === 'paused') game.screen = 'flying';
}

// Throttle slider lives on the instrument panel: x 860..1060, y 620..644.
function throttleHit(x, y) {
  return x >= 860 && x <= 1060 && y >= 612 && y <= 650;
}

attachInput(game.input, canvas, {
  onDrop: () => {
    if (game.screen === 'flying' && game.missions.phase === 'delivery') {
      game.missions.dropHold = 0.7; // a tap counts as a drop over the zone
    }
  },
  onGear: () => {
    if (game.screen === 'flying') game.plane.gearDown = !game.plane.gearDown;
  },
  onFlaps: () => {
    if (game.screen === 'flying') game.plane.flapsDown = !game.plane.flapsDown;
  },
  onPause: togglePause,
  onRestart: () => {
    if (game.screen === 'crashed' || game.screen === 'landed' || game.screen === 'done') nextSortie();
  },
  onMute: () => {
    game.audio.muted = !game.audio.muted;
  },
  onThrottleGrab: (x, y) => throttleHit(x, y),
  onThrottleDrag: (x) => {
    if (game.screen === 'flying') {
      game.plane.throttle = Math.max(0, Math.min(100, ((x - 860) / 200) * 100));
    }
  },
  onClick: (x, y) => {
    ensureAudio(game.audio);
    if (game.screen === 'title') startFlying();
    else if (game.screen === 'crashed' || game.screen === 'landed' || game.screen === 'done') nextSortie();
    void x;
    void y;
  },
});

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 1280 * dpr;
  canvas.height = 720 * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
let fpsAccum = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;
  fpsAccum += dt;

  if (game.screen === 'flying') {
    const result = stepFlight(game.plane, game.input, game.world, dt);
    stepMissions(game.missions, game.world, game.plane, game.time, {
      onRing: () => playTone(game.audio, 'ring'),
      onDelivery: () => playTone(game.audio, 'ring'),
    });
    // Low-fuel warning beep, once a second while critical.
    if (fuelState(game.plane) === 'critical' && game.time - game.warnAt > 1) {
      game.warnAt = game.time;
      playTone(game.audio, 'warn');
    }
    // Out of fuel over the sea: the glide ends in the water.
    if (game.plane.fuel <= 0 && game.plane.airborne && game.plane.altitude < 30) {
      endSortie({ kind: 'crashed', reason: 'Out of fuel — ditched in the sea', vs: game.plane.verticalSpeedFpm, speed: game.plane.speedKts });
    } else if (result) {
      endSortie(result);
    }
    updateAudio(game.audio, game.plane, dt);
  } else if (game.screen === 'title') {
    // The title screen flies itself: a gentle demo orbit over the islands.
    game.time += 0;
  }
  draw(game);
  requestAnimationFrame(frame);
}

// Screenshot staging (?shot=...) runs before the first frame, so the
// first painted frame is already the staged scene.
const { shot } = shotFromUrl();
if (shot) {
  stageShot(game, shot);
  // Freeze the staged moment: no physics advance while screenshotting.
  game.screen = shot === 'start' ? 'title' : 'flying';
  draw(game);
  // Keep painting the same frame so the screenshot is stable.
  const frozen = game.time;
  const paintFrozen = () => {
    game.time = frozen;
    draw(game);
    requestAnimationFrame(paintFrozen);
  };
  requestAnimationFrame(paintFrozen);
} else {
  startSortie(game.missions, game.world, game.plane, 1);
  setStatus(`${GAME_NAME}: press Space or click to fly. Arrow keys steer, Shift throttles up.`);
  requestAnimationFrame(frame);
}

export { game, startFlying, nextSortie };
export { WORLD };

// Debug handle for automated play-tests (headless Chrome via CDP).
// Reading the live state is how the screenshots and the takeoff,
// ring and landing checks are verified; it changes nothing in play.
window.__arunika = game;
