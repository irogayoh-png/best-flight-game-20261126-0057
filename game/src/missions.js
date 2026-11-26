// missions.js — one sortie, three kinds of work: fly the rings, drop
// the cargo on the islands, then bring her home on the runway. Fuel and
// damage turn each sortie into decisions, not a sightseeing tour.

import { MISSIONS, WORLD } from './config.js';
import { angleDifferenceDeg, clamp, degToRad, makeRng, pickRange } from './random.js';
import { groundHeightAt } from './world.js';

export function newMissionState(sortie) {
  return {
    sortie,
    phase: 'rings', // rings -> delivery -> landing -> done
    rings: [],
    ringIndex: 0,
    deliveries: [],
    deliveryIndex: 0,
    delivered: 0,
    score: 0,
    message: '',
    messageUntil: 0,
    dropArmed: false,
    dropHold: 0,
    landed: false,
    windKts: 5 + sortie * 2,
  };
}

function ringPositions(world, rng, sortie) {
  const rings = [];
  const headings = [70, 110, 45, 135, 90];
  const dists = [900, 1500, 2100, 2700, 3200];
  for (let i = 0; i < MISSIONS.ringsPerSortie; i += 1) {
    const h = headings[i] + pickRange(rng, -12, 12) + sortie * 3;
    const d = dists[i] + sortie * 120;
    const alt = 180 + i * 55 + pickRange(rng, -30, 60);
    rings.push({
      x: Math.sin(degToRad(h)) * d,
      z: Math.cos(degToRad(h)) * d,
      y: alt,
      radius: WORLD.ringRadiusM - Math.min(15, sortie * 3),
      passed: false,
    });
  }
  return rings;
}

export function startSortie(missions, world, plane, sortie) {
  const rng = makeRng(world.seed + sortie * 977);
  missions.sortie = sortie;
  missions.phase = 'rings';
  missions.rings = ringPositions(world, rng, sortie);
  missions.ringIndex = 0;
  // Delivery islands: two seeded islands away from home.
  const far = world.islands.filter((is) => is.x !== 0 || is.z !== 0);
  missions.deliveries = [far[1 % far.length], far[3 % far.length]].map((is) => ({
    name: is.name, x: is.x, z: is.z, radius: is.radius * 0.55, done: false,
  }));
  missions.deliveryIndex = 0;
  missions.delivered = 0;
  missions.landed = false;
  missions.windKts = 5 + sortie * 2;
  plane.windKts = missions.windKts;
  setMessage(missions, `Sortie ${sortie} — fly the ${MISSIONS.ringsPerSortie} golden rings`, 4);
}

export function setMessage(missions, text, seconds) {
  missions.message = text;
  missions.messageUntil = performance.now() / 1000 + seconds;
}

function distance3(x1, y1, z1, x2, y2, z2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function stepMissions(missions, world, plane, nowSec, events) {
  // events: { onRing, onDelivery, onLanding } — main.js plays sounds/scores.
  if (missions.phase === 'rings') {
    const ring = missions.rings[missions.ringIndex];
    if (ring) {
      const d = distance3(plane.x, plane.altitude, plane.z, ring.x, ring.y, ring.z);
      if (d < ring.radius) {
        ring.passed = true;
        missions.ringIndex += 1;
        missions.score += MISSIONS.ringScore;
        events.onRing?.(ring, missions.ringIndex);
        if (missions.ringIndex >= missions.rings.length) {
          missions.phase = 'delivery';
          setMessage(missions, `Rings clear! Deliver cargo to ${missions.deliveries[0].name}`, 4);
        } else {
          setMessage(missions, `Ring ${missions.ringIndex} of ${missions.rings.length} — next ring ahead`, 2.5);
        }
      }
    }
  } else if (missions.phase === 'delivery') {
    const target = missions.deliveries[missions.deliveryIndex];
    if (target) {
      const dx = plane.x - target.x;
      const dz = plane.z - target.z;
      const horizontal = Math.sqrt(dx * dx + dz * dz);
      const overZone = horizontal < target.radius && plane.altitude < 320 && plane.altitude > groundHeightAt(world, plane.x, plane.z) + 20;
      if (overZone) {
        missions.dropHold += 1 / 60;
        if (missions.dropHold > 0.6) {
          target.done = true;
          missions.delivered += 1;
          missions.deliveryIndex += 1;
          missions.score += MISSIONS.deliveryScore;
          missions.dropHold = 0;
          events.onDelivery?.(target, missions.delivered);
          if (missions.deliveryIndex >= missions.deliveries.length) {
            missions.phase = 'landing';
            setMessage(missions, 'Cargo delivered! Bring her home — land on runway 09', 4);
          } else {
            setMessage(missions, `Delivered! Next: ${missions.deliveries[missions.deliveryIndex].name}`, 3);
          }
        }
      } else {
        missions.dropHold = 0;
      }
    }
  }
  // Landing is judged by physics ground contact; main.js reports it here.
  void nowSec;
}

export function reportLanding(missions, result) {
  if (result.kind !== 'landed') return 0;
  missions.landed = true;
  missions.phase = 'done';
  const gained = MISSIONS.landingBaseScore + (result.perfect ? MISSIONS.perfectLandingBonus : 0);
  missions.score += gained;
  return gained;
}

export function currentTarget(missions) {
  if (missions.phase === 'rings') return missions.rings[missions.ringIndex] ?? null;
  if (missions.phase === 'delivery') return missions.deliveries[missions.deliveryIndex] ?? null;
  if (missions.phase === 'landing') return { landing: true };
  return null;
}

// Guidance shown on the HUD: bearing and distance to the current target.
export function guidanceTo(plane, target) {
  if (!target) return null;
  if (target.landing) {
    const dx = 0 - plane.x;
    const dz = 0 - plane.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
    return { label: 'RUNWAY 09', dist, bearing: (bearing + 360) % 360, diff: angleDifferenceDeg(plane.heading, (bearing + 360) % 360) };
  }
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const bearing = (Math.atan2(dx, dz) * 180) / Math.PI;
  return {
    label: target.name ?? 'RING',
    dist,
    bearing: (bearing + 360) % 360,
    diff: angleDifferenceDeg(plane.heading, (bearing + 360) % 360),
    altDiff: target.y !== undefined ? target.y - plane.altitude : 0,
  };
}

export function fuelState(plane) {
  if (plane.fuel <= 0) return 'empty';
  if (plane.fuel <= 12) return 'critical';
  if (plane.fuel <= 25) return 'low';
  return 'ok';
}

export function clampScore(score) {
  return Math.max(0, Math.round(score));
}

export { clamp };
