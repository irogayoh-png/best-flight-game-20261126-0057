# Arunika — Sky Courier of the Archipelago

[![make.fun bounty](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node 22](https://img.shields.io/badge/node-22-green.svg)](https://nodejs.org/)

Entry for the [Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057) bounty on make.fun.

## The game

**Arunika** is an original courier flight game set over a seeded Indonesian
archipelago at dawn. You fly the little orange courier plane PK-ARK in
chase view: take off from runway 09 on Pulau Arunika, thread five golden
rings, drop cargo on two islands, then bring her home for a precision
landing — before the fuel runs out.

- **Fly it:** Arrow keys / WASD steer (bank and pitch), Shift throttles up,
  Ctrl throttles down, G gear, V flaps, Space drops cargo, P pauses.
  The throttle slider on the instrument panel is draggable with the mouse.
- **It rewards discipline:** cruise at ~62% throttle and the tank lasts the
  sortie; firewall it everywhere and you will be gliding home. Flaps and
  gear change the stall speed and the drag, and a hard or fast touchdown
  breaks the airframe instead of counting as a landing.
- **It reads as flying:** a live artificial horizon, altimeter, airspeed,
  compass strip, fuel and throttle gauges, and a HUD with altitude, speed
  and heading — plus stall and low-fuel warnings you cannot miss.
- **Every sortie is a new route:** rings, delivery islands and wind change
  with the sortie number, and the next sortie is harder than the last.

## Play it

No build step, no network: every file the game loads lives under `game/`.

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Open `game/index.html` in desktop Chrome and press Space (or click) to fly.

## Screenshots

The four screenshots in `screenshots/` are real renders of this game's own
code in a browser (`?shot=ring`, `?shot=approach`, `?shot=islands`,
`?shot=sunset`, seed 1), unedited.

## Layout

- `game/index.html` — the page; `game/src/` — one job per file:
  `config.js` (tunables), `random.js` (seeded RNG), `world.js`
  (archipelago, runway, ground height), `physics.js` (flight model),
  `input.js` (keyboard and mouse), `audio.js` (synthesised sound),
  `missions.js` (rings, deliveries, landings, fuel), `render.js`
  (chase view, aircraft, HUD and instruments), `shots.js` (screenshot
  staging), `main.js` (game loop).
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `vendor/makefun-game.ts` — the kit's dossier builder, unchanged.

## License

MIT. See [LICENSE](LICENSE).
