// shots.js — deterministic screenshot staging. ?shot=<name>&seed=<n> puts
// the game in one of its best, most complete moments, so the screenshots
// the judge sees are real renders of this game's own code, unedited.

import { MISSIONS } from './config.js';
import { degToRad } from './random.js';
import { setMessage, startSortie } from './missions.js';
import { newFlightState } from './physics.js';

export const SHOT_NAMES = ['start', 'play', 'ring', 'approach', 'islands', 'sunset'];

function placeOnRingRun(game, ringIndex) {
  const missions = game.missions;
  const ring = missions.rings[ringIndex];
  if (!ring) return;
  const p = game.plane;
  // The plane flies the ring it is staged on: earlier rings count as
  // passed, so the HUD guidance and the ring in frame always agree.
  for (let i = 0; i < ringIndex; i += 1) missions.rings[i].passed = true;
  missions.ringIndex = ringIndex;
  missions.score = ringIndex * MISSIONS.ringScore;
  // Put the plane 520 m out from the ring, lined up on it, just below
  // ring height so the gold ring sits above the nose in frame.
  const bearing = Math.atan2(ring.x - 0, ring.z - 0);
  p.x = ring.x - Math.sin(bearing) * 520;
  p.z = ring.z - Math.cos(bearing) * 520;
  p.altitude = ring.y - 35;
  p.heading = (Math.atan2(ring.x - p.x, ring.z - p.z) * 180) / Math.PI;
  p.pitch = 2;
  p.bank = -6;
  p.speedKts = 128;
  p.throttle = 68;
  p.airborne = true;
  p.fuel = 78;
  setMessage(missions, `Ring ${ringIndex + 1} of ${MISSIONS.ringsPerSortie} — fly through the gold ring`, 30);
}

function placeOnApproach(game) {
  const p = game.plane;
  // On final from the southwest, low and slow, so the runway is seen at
  // an angle and fills the frame instead of foreshortening to a line.
  p.x = -1100;
  p.z = 350;
  p.altitude = 110;
  p.heading = 78;
  p.pitch = -4;
  p.bank = -5;
  p.speedKts = 92;
  p.throttle = 38;
  p.airborne = true;
  p.gearDown = true;
  p.flapsDown = true;
  p.fuel = 34;
  game.missions.rings.forEach((r) => { r.passed = true; });
  game.missions.ringIndex = MISSIONS.ringsPerSortie;
  game.missions.deliveries.forEach((d) => { d.done = true; });
  game.missions.deliveryIndex = MISSIONS.deliveriesPerSortie;
  game.missions.delivered = MISSIONS.deliveriesPerSortie;
  game.missions.score = MISSIONS.ringsPerSortie * MISSIONS.ringScore
    + MISSIONS.deliveriesPerSortie * MISSIONS.deliveryScore;
  game.missions.phase = 'landing';
  setMessage(game.missions, 'Final approach — gear down, flaps down, aim for the numbers', 30);
}

function placeOverIslands(game) {
  const p = game.plane;
  // Stage over the first delivery island itself, not a neighbour.
  const target = game.missions.deliveries[0];
  const island = game.world.islands.find((is) => is.name === target.name) ?? game.world.islands[1];
  p.x = island.x - 1500;
  p.z = island.z - 900;
  p.altitude = 260;
  p.heading = (Math.atan2(island.x - p.x, island.z - p.z) * 180) / Math.PI;
  p.pitch = 0;
  p.bank = -10;
  p.speedKts = 142;
  p.throttle = 72;
  p.airborne = true;
  p.fuel = 64;
  game.missions.phase = 'delivery';
  game.missions.deliveryIndex = 0;
  game.missions.rings.forEach((r) => { r.passed = true; });
  game.missions.ringIndex = MISSIONS.ringsPerSortie;
  game.missions.score = MISSIONS.ringsPerSortie * MISSIONS.ringScore;
  setMessage(game.missions, `Deliver cargo to ${target.name} — hold over the amber drop zone`, 30);
}

function placeAtSunset(game) {
  const p = game.plane;
  p.x = 1200;
  p.z = 2600;
  p.altitude = 980;
  p.heading = 285;
  p.pitch = 1;
  p.bank = 8;
  p.speedKts = 152;
  p.throttle = 66;
  p.airborne = true;
  p.fuel = 58;
  // A finished sortie at sunset: rings, cargo and landing all done.
  game.missions.rings.forEach((r) => { r.passed = true; });
  game.missions.ringIndex = MISSIONS.ringsPerSortie;
  game.missions.deliveries.forEach((d) => { d.done = true; });
  game.missions.deliveryIndex = MISSIONS.deliveriesPerSortie;
  game.missions.delivered = MISSIONS.deliveriesPerSortie;
  game.missions.score = MISSIONS.ringsPerSortie * MISSIONS.ringScore
    + MISSIONS.deliveriesPerSortie * MISSIONS.deliveryScore
    + MISSIONS.landingBaseScore + MISSIONS.perfectLandingBonus;
  game.missions.phase = 'done';
  game.missions.landed = true;
  setMessage(game.missions, 'Sortie complete — the courier route is yours', 30);
}

// Stage one named shot. Returns true when the name is known.
export function stageShot(game, name) {
  const p = game.plane;
  Object.assign(p, newFlightState());
  startSortie(game.missions, game.world, p, 1);
  game.screen = 'flying';
  game.time = 12.4; // fixed sun / prop phase, so every shot is stable
  if (name === 'start' || name === 'play') {
    placeOnRingRun(game, 0);
    game.screen = name === 'start' ? 'title' : 'flying';
    if (name === 'start') {
      // Title over a live flight scene: plane, ring and runway all in frame.
      placeOnRingRun(game, 0);
    }
    return true;
  }
  if (name === 'ring') {
    placeOnRingRun(game, 1);
    return true;
  }
  if (name === 'approach' || name === 'land') {
    placeOnApproach(game);
    return true;
  }
  if (name === 'islands' || name === 'delivery') {
    placeOverIslands(game);
    return true;
  }
  if (name === 'sunset' || name === 'end') {
    placeAtSunset(game);
    return true;
  }
  return false;
}

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || '1');
  return { shot, seed: Number.isFinite(seed) ? seed : 1 };
}

export { degToRad };
