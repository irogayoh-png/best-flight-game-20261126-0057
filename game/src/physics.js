// physics.js — the flight model. Arcade, but honest: throttle sets speed,
// pitch sets climb, bank sets turn, and flying sloppy costs fuel, speed
// and eventually the airframe.

import { PLANE, WORLD } from './config.js';
import { clamp, degToRad, wrapAngleDeg } from './random.js';
import { groundHeightAt, overRunway } from './world.js';

export function newFlightState() {
  return {
    // Start on the home runway, lined up east, engines warm.
    x: -260, z: 0, altitude: WORLD.runwayAltitudeM,
    heading: 90, pitch: 0, bank: 0,
    speedKts: 0, throttle: 0,
    fuel: PLANE.fuelCapacity, hull: 100,
    verticalSpeedFpm: 0,
    gearDown: true, flapsDown: false,
    airborne: false, stalled: false,
    windDeg: 40, windKts: 6,
    shake: 0, smoke: 0,
  };
}

export function stepFlight(plane, input, world, dt) {
  const p = plane;
  // Throttle: Shift/R to spool up, Ctrl/F to pull back. Discipline pays:
  // cruise at ~62% burns little; firewalling it all sortie burns the tank.
  if (input.throttleUp) p.throttle = clamp(p.throttle + 34 * dt, 0, 100);
  if (input.throttleDown) p.throttle = clamp(p.throttle - 34 * dt, 0, 100);

  // Pitch and bank ease toward the pilot's input, never snap.
  const pitchTarget = input.pitchUp ? PLANE.climbPitchMax
    : input.pitchDown ? PLANE.divePitchMax : 0;
  const bankTarget = input.bankLeft ? -PLANE.bankMax
    : input.bankRight ? PLANE.bankMax : 0;
  p.pitch += (pitchTarget - p.pitch) * Math.min(1, dt * 2.2);
  p.bank += (bankTarget - p.bank) * Math.min(1, dt * 2.6);

  // Speed chases the throttle setting; flaps and gear add drag.
  let targetSpeed = 42 + (p.throttle / 100) * (PLANE.maxSpeedKts - 42);
  if (p.flapsDown) targetSpeed *= 1 - PLANE.dragFlaps * 0.4;
  if (p.gearDown && p.airborne) targetSpeed *= 1 - PLANE.dragGear * 0.3;
  p.speedKts += clamp(targetSpeed - p.speedKts, -PLANE.accelKtsPerSec * dt, PLANE.accelKtsPerSec * dt);

  const stallSpeed = p.flapsDown ? PLANE.stallFlapsKts : PLANE.stallSpeedKts;
  p.stalled = p.airborne && p.speedKts < stallSpeed;

  // Turn: bank turns the nose; crosswind pushes the track a little.
  const turnRate = p.bank * PLANE.turnRatePerBank * (p.airborne ? 1 : 0.25);
  p.heading = wrapAngleDeg(p.heading + turnRate * dt);
  const headingRad = degToRad(p.heading);
  const windRad = degToRad(p.windDeg);
  const forwardMs = p.speedKts * 0.514444;
  let vx = Math.sin(headingRad) * forwardMs;
  let vz = Math.cos(headingRad) * forwardMs;
  vx += Math.sin(windRad) * p.windKts * 0.514444 * 0.35;
  vz += Math.cos(windRad) * p.windKts * 0.514444 * 0.35;
  p.x += vx * dt;
  p.z += vz * dt;

  // Climb and sink: pitch trades speed for altitude; a stall sinks hard.
  const prevAlt = p.altitude;
  let climbMs = forwardMs * Math.sin(degToRad(p.pitch));
  if (p.stalled) climbMs -= 9;
  if (!p.airborne && p.speedKts < 70) climbMs = 0;
  p.altitude += climbMs * dt;
  p.verticalSpeedFpm = ((p.altitude - prevAlt) / Math.max(dt, 0.001)) * 196.85;

  // Fuel: the sortie's real clock. Empty tanks mean a glide, not a miracle.
  const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurnPerSec * p.throttle) / 100;
  p.fuel = Math.max(0, p.fuel - burn * dt);

  // Ground contact. A plane on its wheels is taxiing, never crashing:
  // it only leaves the ground by rotating at speed with the nose up,
  // and only an airborne plane can land or crash.
  const ground = groundHeightAt(world, p.x, p.z);
  if (!p.airborne) {
    if (p.altitude <= ground + 1) {
      p.altitude = ground;
      p.verticalSpeedFpm = 0;
      if (p.speedKts >= 70 && p.pitch > 2) {
        p.altitude = ground + 3;
        p.airborne = true;
      } else {
        if (!overRunway(world, p.x, p.z) && p.speedKts > 25) {
          p.hull = 0;
          p.shake = 1;
          p.smoke = 1;
          return {
            kind: 'crashed', vs: p.verticalSpeedFpm, speed: p.speedKts,
            reason: 'Ran off the runway into the island',
            hard: true,
          };
        }
        p.shake = Math.max(0, p.shake - dt * 2);
        return null;
      }
    } else {
      p.airborne = true;
    }
  }
  if (p.airborne && p.altitude <= ground + 1) {
    return groundContact(p, world, ground);
  }
  p.shake = Math.max(0, p.shake - dt * 2);
  return null; // still flying
}

// Returns 'landed' | 'crashed' | null. Called once, at first ground contact.
function groundContact(p, world, ground) {
  const onRunway = overRunway(world, p.x, p.z);
  const vs = p.verticalSpeedFpm;
  const speed = p.speedKts;
  p.altitude = ground + WORLD.crashAltitudeMarginM;
  if (!p.airborne) {
    // Still rolling on the runway at the start: not a landing, not a crash.
    if (onRunway && speed < 40) return null;
  }
  if (onRunway && p.gearDown && vs > -650 && speed >= 45 && speed <= 135) {
    p.airborne = false;
    p.speedKts = Math.max(0, speed - 30);
    p.pitch = 0;
    return { kind: 'landed', vs, speed, perfect: vs > -350 && speed >= 65 && speed <= 105 };
  }
  // Anything else at ground level is a crash — and it reads as one.
  const hard = vs < -650 || speed > 135 || !p.gearDown;
  p.hull = 0;
  p.shake = 1;
  p.smoke = 1;
  return {
    kind: 'crashed',
    vs, speed,
    reason: !onRunway
      ? 'Terrain strike — you flew into the island'
      : !p.gearDown
        ? 'Belly landing — the gear was up'
        : vs <= -650
          ? 'Too hard — the airframe broke on touchdown'
          : 'Too fast — you ran off the end of the runway',
    hard,
  };
}
