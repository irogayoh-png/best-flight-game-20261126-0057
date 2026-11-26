// Arunika — Sky Courier of the Archipelago.
// config.js — every tunable number of the game in one place.
// Units: metres, knots, degrees, seconds. Nothing here loads a network file.

export const GAME_NAME = 'ARUNIKA';
export const GAME_TITLE = 'Arunika — Sky Courier of the Archipelago';

export const VIEW = {
  width: 1280,
  height: 720,
  focal: 720, // projection scale for the chase camera
  horizonBase: 300, // horizon line (px) when the nose is level
};

export const PLANE = {
  cruiseThrottle: 62, // percent — the disciplined cruise setting
  maxSpeedKts: 185,
  stallSpeedKts: 58, // flaps down: 48
  stallFlapsKts: 48,
  climbPitchMax: 16,
  divePitchMax: -12,
  bankMax: 48,
  turnRatePerBank: 0.55, // deg/s of heading per degree of bank
  accelKtsPerSec: 14,
  dragFlaps: 0.35,
  dragGear: 0.22,
  fuelCapacity: 100,
  fuelBurnPerSec: 0.16, // at 100% throttle; scaled by throttle
  fuelBurnIdle: 0.02,
};

export const WORLD = {
  seed: 20261126,
  runwayAltitudeM: 12,
  runwayLengthM: 640,
  runwayWidthM: 26,
  runwayHeadingDeg: 90, // east, along +x
  ringRadiusM: 55,
  islandHillMaxM: 85,
  crashAltitudeMarginM: 4,
};

export const MISSIONS = {
  ringsPerSortie: 5,
  deliveriesPerSortie: 2,
  ringScore: 250,
  deliveryScore: 400,
  landingBaseScore: 600,
  perfectLandingBonus: 400,
  fuelWarningAt: 25,
  fuelCriticalAt: 12,
};

export const CONTROLS = {
  pitchUp: ['ArrowUp', 'KeyW'],
  pitchDown: ['ArrowDown', 'KeyS'],
  bankLeft: ['ArrowLeft', 'KeyA'],
  bankRight: ['ArrowRight', 'KeyD'],
  throttleUp: ['ShiftLeft', 'ShiftRight', 'KeyR'],
  throttleDown: ['ControlLeft', 'ControlRight', 'KeyF'],
  dropCargo: ['Space'],
  gear: ['KeyG'],
  flaps: ['KeyV'],
  pause: ['KeyP'],
  restart: ['KeyN'],
  mute: ['KeyM'],
};

export const PALETTE = {
  skyTop: '#1b3a6b',
  skyMid: '#4d7fb8',
  skyHorizon: '#f2a65e',
  sun: '#ffd98a',
  seaDeep: '#0e4d6b',
  seaShallow: '#1f8fa8',
  sand: '#e8d29a',
  grass: '#3f8f4f',
  hill: '#2c6b3a',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ring: '#ffc93c',
  ringGlow: 'rgba(255,201,60,0.35)',
  panel: '#101820',
  panelEdge: '#2a3a48',
  litCyan: '#7fe7ff',
  litAmber: '#ffb347',
  litGreen: '#7dff9a',
  litRed: '#ff6b5e',
  text: '#eef6ff',
  muted: '#9fb4c6',
};
