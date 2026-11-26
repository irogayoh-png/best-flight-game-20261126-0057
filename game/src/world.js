// world.js — the archipelago: islands, the home runway, rings and drop
// zones. All placement is seeded, so the same seed builds the same world.

import { WORLD } from './config.js';
import { makeRng, pickRange } from './random.js';

export function buildWorld(seed) {
  const rng = makeRng(seed);
  // Home island first: the runway island, centred on the origin.
  const islands = [
    {
      name: 'Pulau Arunika',
      x: 0, z: 0, radius: 980, hill: 46,
      town: true, runway: true,
    },
    { name: 'Pulau Cendana', x: 2600, z: 1900, radius: 620, hill: 72, town: true },
    { name: 'Pulau Ombak', x: -2100, z: 2700, radius: 540, hill: 58, town: false },
    { name: 'Pulau Karang', x: 3400, z: -1600, radius: 480, hill: 85, town: false },
    { name: 'Pulau Senja', x: -3400, z: -900, radius: 700, hill: 64, town: true },
    { name: 'Pulau Bayu', x: 900, z: 4400, radius: 430, hill: 38, town: false },
    { name: 'Pulau Nusa', x: -1000, z: -3900, radius: 560, hill: 52, town: true },
    { name: 'Pulau Pelita', x: 5400, z: 1100, radius: 380, hill: 30, town: false },
  ];
  // Palm clusters and rooftops, placed per island from the same seed.
  for (const island of islands) {
    island.palms = [];
    const count = Math.floor(pickRange(rng, 8, 14));
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const r = island.radius * (0.35 + rng() * 0.55);
      island.palms.push({ dx: Math.cos(a) * r, dz: Math.sin(a) * r, s: 0.7 + rng() * 0.7 });
    }
    island.houses = island.town ? Math.floor(pickRange(rng, 8, 16)) : 0;
  }
  const runway = {
    // Runway centreline runs east (heading 90) through the home island.
    x0: -WORLD.runwayLengthM / 2, x1: WORLD.runwayLengthM / 2,
    z: 0, altitude: WORLD.runwayAltitudeM,
    heading: WORLD.runwayHeadingDeg,
  };
  return { seed, islands, runway, clouds: buildClouds(rng) };
}

export function buildClouds(rng) {
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: pickRange(rng, -9000, 9000),
      z: pickRange(rng, -9000, 9000),
      y: pickRange(rng, 900, 1600),
      s: pickRange(rng, 180, 520),
      a: pickRange(rng, 0.35, 0.75),
    });
  }
  return clouds;
}

// Ground height under a point: island hills, else sea level (0), except
// the flattened runway strip on the home island.
export function groundHeightAt(world, x, z) {
  const { runway } = world;
  if (Math.abs(z - runway.z) < 40 && x > runway.x0 - 20 && x < runway.x1 + 20) {
    return WORLD.runwayAltitudeM;
  }
  let height = 0;
  for (const island of world.islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < island.radius) {
      const falloff = 1 - (d / island.radius) * (d / island.radius);
      let hill = island.hill * falloff;
      // Climb-out corridor east of the home runway: keep the hill low
      // along the departure path, so a normal takeoff is never a trap.
      if (island.x === 0 && island.z === 0 && x > 300 && Math.abs(z) < 160) {
        hill *= 0.25;
      }
      height = Math.max(height, hill);
    }
  }
  return height;
}

export function islandAt(world, x, z) {
  for (const island of world.islands) {
    const dx = x - island.x;
    const dz = z - island.z;
    if (Math.sqrt(dx * dx + dz * dz) < island.radius) return island;
  }
  return null;
}

// Is the point over the runway rectangle (for a touchdown check)?
export function overRunway(world, x, z) {
  const { runway } = world;
  return (
    Math.abs(z - runway.z) < WORLD.runwayWidthM / 2 + 6 &&
    x > runway.x0 && x < runway.x1
  );
}
