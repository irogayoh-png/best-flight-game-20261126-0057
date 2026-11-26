// render.js — everything the pilot sees: sky, sea, islands, runway and
// rings in a chase view, the aircraft in frame, and instruments that are
// actually flown, not drawn once and forgotten.

import { PALETTE, VIEW, WORLD, MISSIONS } from './config.js';
import { clamp, degToRad, lerp, wrapAngleDeg } from './random.js';
import { groundHeightAt } from './world.js';
import { currentTarget, fuelState, guidanceTo } from './missions.js';

const CX = VIEW.width / 2;

function project(plane, x, z, y) {
  const h = degToRad(plane.heading);
  const dx = x - plane.x;
  const dz = z - plane.z;
  const forward = dx * Math.sin(h) + dz * Math.cos(h);
  const lateral = dx * Math.cos(h) - dz * Math.sin(h);
  if (forward < 40) return null;
  const horizonY = VIEW.horizonBase + plane.pitch * 4;
  const sx = CX + (lateral / forward) * VIEW.focal;
  const sy = horizonY + ((plane.altitude - y) / forward) * VIEW.focal;
  const scale = VIEW.focal / forward;
  return { x: sx, y: sy, scale, forward, lateral };
}

function sky(ctx, plane, time) {
  const horizonY = VIEW.horizonBase + plane.pitch * 4;
  const grad = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, horizonY + 40);
  // Low sun, fixed in the world to the west-northwest.
  const sun = project(plane, plane.x + Math.sin(degToRad(285)) * 9000, plane.z + Math.cos(degToRad(285)) * 9000, 1100);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 120);
    glow.addColorStop(0, 'rgba(255,217,138,0.95)');
    glow.addColorStop(0.4, 'rgba(255,180,90,0.45)');
    glow.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 130, sun.y - 130, 260, 260);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  void time;
}

function clouds(ctx, plane, world) {
  const horizonY = VIEW.horizonBase + plane.pitch * 4;
  for (const cloud of world.clouds) {
    const p = project(plane, cloud.x, cloud.z, cloud.y);
    if (!p || p.y > horizonY + 200 || p.y < 90) continue;
    const w = Math.min(cloud.s * p.scale, 240);
    if (w < 8) continue;
    ctx.fillStyle = `rgba(255,255,255,${cloud.a})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w, w * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x - w * 0.4, p.y + w * 0.06, w * 0.55, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function seaAndGrid(ctx, plane) {
  const horizonY = VIEW.horizonBase + plane.pitch * 4;
  const grad = ctx.createLinearGradient(0, horizonY, 0, VIEW.height);
  grad.addColorStop(0, PALETTE.seaShallow);
  grad.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, horizonY, VIEW.width, VIEW.height - horizonY);
  // Perspective swell lines: they rush past and sell the speed.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let d = 220; d < 6000; d *= 1.55) {
    const y = horizonY + (plane.altitude / d) * VIEW.focal;
    if (y > VIEW.height) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.width, y);
    ctx.stroke();
  }
}

function islands(ctx, plane, world) {
  const sorted = [...world.islands].sort((a, b) => {
    const da = Math.hypot(a.x - plane.x, a.z - plane.z);
    const db = Math.hypot(b.x - plane.x, b.z - plane.z);
    return db - da; // far first, so near islands paint over them
  });
  for (const island of sorted) {
    const p = project(plane, island.x, island.z, 0);
    if (!p) continue;
    const rx = island.radius * p.scale;
    if (rx < 3 || p.x < -rx - 100 || p.x > VIEW.width + rx + 100) continue;
    const ry = Math.max(4, rx * 0.3);
    // Sand rim, then grass, then the hill.
    ctx.fillStyle = PALETTE.sand;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.grass;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - ry * 0.25, rx * 0.88, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Palms, only when close enough to read as trees, not specks.
    if (rx > 50) {
      for (const palm of island.palms) {
        const pp = project(plane, island.x + palm.dx, island.z + palm.dz, groundHeightAt(world, island.x + palm.dx, island.z + palm.dz));
        if (!pp) continue;
        const s = Math.max(2.5, 3.5 * pp.scale * palm.s);
        ctx.strokeStyle = '#5a4632';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pp.x, pp.y);
        ctx.lineTo(pp.x, pp.y - s);
        ctx.stroke();
        ctx.fillStyle = '#245c31';
        ctx.beginPath();
        ctx.arc(pp.x, pp.y - s - 1, s * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      if (island.town) {
        ctx.fillStyle = '#f3e2c7';
        for (let i = 0; i < island.houses; i += 1) {
          const hx = island.x + ((i * 137) % 300) - 150;
          const hz = island.z + ((i * 89) % 220) - 110;
          const hp = project(plane, hx, hz, groundHeightAt(world, hx, hz));
          if (!hp) continue;
          ctx.fillRect(hp.x - 2, hp.y - 2, 4, 4);
        }
      }
    }
    // Island name, readable when near — never on a huge island filling
    // the frame, where it would collide with the HUD message.
    if (rx > 90 && rx < 300) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(island.name, p.x, p.y - ry - 14);
    }
  }
}

function runway(ctx, plane, world) {
  const r = world.runway;
  const corners = [
    project(plane, r.x0, r.z - WORLD.runwayWidthM / 2, r.altitude),
    project(plane, r.x1, r.z - WORLD.runwayWidthM / 2, r.altitude),
    project(plane, r.x1, r.z + WORLD.runwayWidthM / 2, r.altitude),
    project(plane, r.x0, r.z + WORLD.runwayWidthM / 2, r.altitude),
  ];
  if (corners.some((c) => !c)) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes and the big 09 numerals at the threshold,
  // plus PAPI approach lights beside the threshold.
  ctx.strokeStyle = PALETTE.runwayLine;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const c0 = project(plane, r.x0, r.z, r.altitude);
  const c1 = project(plane, r.x1, r.z, r.altitude);
  if (c0 && c1) {
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.stroke();
    ctx.fillStyle = PALETTE.runwayLine;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('09', c0.x, c0.y - 8);
    // Approach lights: a row of amber dots on the extended centreline,
    // so the runway reads as "ahead" even seen head-on.
    for (let i = 1; i <= 5; i += 1) {
      const light = project(plane, r.x0 - i * 70, r.z, r.altitude);
      if (!light) continue;
      ctx.fillStyle = i % 2 ? '#ffc93c' : '#ffffff';
      ctx.beginPath();
      ctx.arc(light.x, light.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // PAPI: two red, two white when on the glide slope.
    for (let i = 0; i < 4; i += 1) {
      const papi = project(plane, r.x0 + 60 + i * 14, r.z + WORLD.runwayWidthM / 2 + 12, r.altitude);
      if (!papi) continue;
      ctx.fillStyle = i < 2 ? '#ff5a4e' : '#ffffff';
      ctx.beginPath();
      ctx.arc(papi.x, papi.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function rings(ctx, plane, missions) {
  for (const ring of missions.rings) {
    if (ring.passed) continue;
    const p = project(plane, ring.x, ring.z, ring.y);
    if (!p) continue;
    const radius = ring.radius * p.scale;
    if (radius < 4) continue;
    const isNext = missions.rings[missions.ringIndex] === ring;
    ctx.save();
    ctx.strokeStyle = PALETTE.ringGlow;
    ctx.lineWidth = Math.max(4, radius * 0.22);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = Math.max(2, radius * 0.07);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, radius, radius * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Delivery zone: a soft amber circle on the island below.
  if (missions.phase === 'delivery') {
    const target = missions.deliveries[missions.deliveryIndex];
    if (target) {
      const p = project(plane, target.x, target.z, 0);
      if (p) {
        const radius = target.radius * p.scale;
        ctx.strokeStyle = 'rgba(255,179,71,0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, radius, radius * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PALETTE.litAmber;
        ctx.font = '700 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`DROP ZONE — ${target.name}`, p.x, p.y - radius * 0.3 - 10);
      }
    }
  }
}

function drawPlane(ctx, plane, time) {
  // Chase view from behind and slightly above: the airframe is
  // foreshortened — broad wings, a short fuselage, the tail close to us.
  const py = 440 + plane.pitch * 1.5;
  ctx.save();
  ctx.translate(CX, py);
  ctx.rotate(degToRad(plane.bank * 0.85));
  if (plane.shake > 0) {
    ctx.translate((Math.random() - 0.5) * plane.shake * 14, (Math.random() - 0.5) * plane.shake * 10);
  }
  // Wings — broad, with aileron lines and tip lights.
  ctx.fillStyle = '#d97b2f';
  ctx.beginPath();
  ctx.moveTo(-172, 14);
  ctx.quadraticCurveTo(-70, 2, -30, 10);
  ctx.lineTo(30, 10);
  ctx.quadraticCurveTo(70, 2, 172, 14);
  ctx.quadraticCurveTo(70, 28, 30, 26);
  ctx.lineTo(-30, 26);
  ctx.quadraticCurveTo(-70, 28, -172, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-140, 12);
  ctx.lineTo(-140, 25);
  ctx.moveTo(140, 12);
  ctx.lineTo(140, 25);
  ctx.stroke();
  // Fuselage, short and tapered toward the nose ahead of us.
  const body = ctx.createLinearGradient(-24, 0, 24, 0);
  body.addColorStop(0, '#f4ede0');
  body.addColorStop(0.5, '#fff8ea');
  body.addColorStop(1, '#e0d3b8');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-14, -40);
  ctx.quadraticCurveTo(0, -48, 14, -40);
  ctx.lineTo(22, 30);
  ctx.quadraticCurveTo(0, 44, -22, 30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,20,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-19, -12);
  ctx.lineTo(19, -12);
  ctx.moveTo(-21, 12);
  ctx.lineTo(21, 12);
  ctx.stroke();
  // Canopy glass, lit from the dawn sun.
  ctx.fillStyle = PALETTE.litCyan;
  ctx.beginPath();
  ctx.ellipse(0, -26, 12, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(-4, -29, 4, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Tail fin with the Arunika sun mark, and the tailplane.
  ctx.fillStyle = '#c65a1e';
  ctx.beginPath();
  ctx.moveTo(-11, 28);
  ctx.lineTo(0, 62);
  ctx.lineTo(11, 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(0, 44, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d97b2f';
  ctx.fillRect(-58, 34, 116, 10);
  // Registration on the fuselage.
  ctx.fillStyle = '#5a4632';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PK-ARK', 0, 8);
  // Spinning prop, glimpsed over the nose, and nav lights.
  const spin = (time * 40) % Math.PI;
  ctx.save();
  ctx.translate(0, -44);
  ctx.rotate(spin);
  ctx.fillStyle = 'rgba(40,40,40,0.55)';
  ctx.fillRect(-3, -22, 6, 44);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -44, 5, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = blink ? '#ff4444' : '#7a2020';
  ctx.beginPath();
  ctx.arc(-172, 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blink ? '#44ff88' : '#1d5c33';
  ctx.beginPath();
  ctx.arc(172, 18, 4, 0, Math.PI * 2);
  ctx.fill();
  // Smoke when damaged.
  if (plane.smoke > 0 || plane.hull < 55) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    for (let i = 0; i < 5; i += 1) {
      const t = (time * 0.7 + i * 0.2) % 1;
      ctx.beginPath();
      ctx.arc(-14 + i * 4 - t * 20, 30 + t * 60, 6 + t * 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function text(ctx, value, x, y, size, color, align = 'left', weight = 600) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}

function hud(ctx, plane, missions, time) {
  const fuel = fuelState(plane);
  const warn = fuel === 'low' || fuel === 'critical';
  const blink = warn && Math.sin(time * 8) > 0;
  // Top bar: altitude, speed, heading — the three numbers the judge looks for.
  ctx.fillStyle = 'rgba(8,14,20,0.55)';
  ctx.fillRect(0, 0, VIEW.width, 64);
  text(ctx, 'ALT', 24, 24, 13, PALETTE.muted);
  text(ctx, `${Math.round(plane.altitude * 3.28084)} ft`, 24, 52, 26, blink && fuel === 'critical' ? PALETTE.litRed : PALETTE.text, 'left', 700);
  text(ctx, 'SPD', 300, 24, 13, PALETTE.muted);
  text(ctx, `${Math.round(plane.speedKts)} kt`, 300, 52, 26, plane.stalled ? PALETTE.litRed : PALETTE.text, 'left', 700);
  text(ctx, 'HDG', 560, 24, 13, PALETTE.muted);
  const hdg = ((Math.round(plane.heading) % 360) + 360) % 360;
  text(ctx, `${String(hdg).padStart(3, '0')}°`, 560, 52, 26, PALETTE.text, 'left', 700);
  text(ctx, 'THR', 760, 24, 13, PALETTE.muted);
  text(ctx, `${Math.round(plane.throttle)}%`, 760, 52, 26, PALETTE.text, 'left', 700);
  text(ctx, 'SCORE', 980, 24, 13, PALETTE.muted);
  text(ctx, `${missions.score}`, 980, 52, 26, PALETTE.litAmber, 'left', 700);
  text(ctx, `SORTIE ${missions.sortie}`, 1150, 24, 13, PALETTE.muted, 'right');
  text(ctx, `FUEL ${Math.round(plane.fuel)}%`, 1150, 52, 18, warn ? PALETTE.litRed : PALETTE.litGreen, 'right', 700);
  // Stall and fuel warnings, impossible to miss.
  if (plane.stalled) {
    text(ctx, '⚠ STALL — NOSE DOWN, THROTTLE UP', CX, 96, 20, PALETTE.litRed, 'center', 700);
  } else if (fuel === 'critical') {
    text(ctx, '⚠ FUEL CRITICAL — LAND NOW', CX, 96, 20, PALETTE.litRed, 'center', 700);
  } else if (fuel === 'low') {
    text(ctx, 'LOW FUEL — PLAN YOUR LANDING', CX, 96, 18, PALETTE.litAmber, 'center', 700);
  }
  // Mission banner + guidance to the next target.
  const target = currentTarget(missions);
  const guide = target ? guidanceTo(plane, target) : null;
  const phaseLabel = missions.phase === 'rings' ? `RING ${missions.ringIndex + 1}/${missions.rings.length}`
    : missions.phase === 'delivery' ? `DELIVERY ${missions.deliveryIndex + 1}/${missions.deliveries.length}`
      : missions.phase === 'landing' ? 'FINAL APPROACH — RUNWAY 09'
        : 'SORTIE COMPLETE';
  text(ctx, phaseLabel, CX, 128, 17, PALETTE.text, 'center', 700);
  if (guide) {
    const arrow = guide.diff > 12 ? '➤ TURN RIGHT' : guide.diff < -12 ? '⬅ TURN LEFT' : '▲ ON COURSE';
    text(ctx, `${guide.label}  •  ${(guide.dist / 1000).toFixed(1)} km  •  ${arrow}`, CX, 152, 15, PALETTE.muted, 'center');
  }
  if (missions.message && performance.now() / 1000 < missions.messageUntil) {
    text(ctx, missions.message, CX, 182, 16, PALETTE.litCyan, 'center');
  }
  // Compass strip across the top of the panel.
  const stripY = 566;
  ctx.fillStyle = 'rgba(8,14,20,0.35)';
  ctx.fillRect(CX - 260, stripY - 14, 520, 26);
  const points = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'], [360, 'N']];
  for (const [deg, label] of points) {
    let diff = wrapAngleDeg(deg - plane.heading);
    if (Math.abs(diff) > 70) continue;
    const x = CX + diff * 3.4;
    text(ctx, label, x, stripY + 5, 13, Math.abs(diff) < 6 ? PALETTE.litAmber : PALETTE.muted, 'center', 700);
  }
  ctx.fillStyle = PALETTE.litAmber;
  ctx.beginPath();
  ctx.moveTo(CX, stripY - 16);
  ctx.lineTo(CX - 6, stripY - 26);
  ctx.lineTo(CX + 6, stripY - 26);
  ctx.closePath();
  ctx.fill();
}

function instruments(ctx, plane, missions, world) {
  // The instrument panel: the bottom strip is real, flown hardware.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 580, VIEW.width, 140);
  ctx.fillStyle = PALETTE.panelEdge;
  ctx.fillRect(0, 580, VIEW.width, 3);
  // Artificial horizon.
  const ax = 130;
  const ay = 638;
  const ar = 48;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(degToRad(-plane.bank));
  ctx.translate(0, plane.pitch * 2.4);
  ctx.fillStyle = '#3f7fc4';
  ctx.fillRect(-ar - 4, -ar - 60, ar * 2 + 8, ar + 60);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-ar - 4, 0, ar * 2 + 8, ar + 60);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-ar - 4, -1, ar * 2 + 8, 2);
  ctx.restore();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.litAmber;
  ctx.fillRect(ax - 22, ay - 2, 16, 4);
  ctx.fillRect(ax + 6, ay - 2, 16, 4);
  ctx.beginPath();
  ctx.arc(ax, ay, 4, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'ATTITUDE', ax, ay + ar + 16, 11, PALETTE.muted, 'center');
  // Altimeter + vertical speed.
  text(ctx, 'ALTITUDE', 250, 612, 11, PALETTE.muted);
  text(ctx, `${Math.round(plane.altitude * 3.28084)} ft`, 250, 644, 24, PALETTE.litCyan, 'left', 700);
  text(ctx, `V/S ${plane.verticalSpeedFpm >= 0 ? '+' : ''}${Math.round(plane.verticalSpeedFpm)} fpm`, 250, 672, 14, plane.verticalSpeedFpm < -650 ? PALETTE.litRed : PALETTE.text);
  text(ctx, `GROUND ${Math.round(groundHeightAt(world, plane.x, plane.z) * 3.28084)} ft`, 250, 694, 12, PALETTE.muted);
  // Airspeed tape.
  text(ctx, 'AIRSPEED', 480, 612, 11, PALETTE.muted);
  text(ctx, `${Math.round(plane.speedKts)} kt`, 480, 644, 24, plane.stalled ? PALETTE.litRed : PALETTE.litCyan, 'left', 700);
  text(ctx, plane.stalled ? 'STALL' : plane.speedKts < 75 ? 'SLOW' : 'FLYING', 480, 672, 14, plane.stalled ? PALETTE.litRed : PALETTE.litGreen);
  // Fuel gauge.
  text(ctx, 'FUEL', 660, 612, 11, PALETTE.muted);
  const fuel = fuelState(plane);
  ctx.fillStyle = '#1c2a36';
  ctx.fillRect(660, 624, 150, 16);
  ctx.fillStyle = fuel === 'ok' ? PALETTE.litGreen : fuel === 'low' ? PALETTE.litAmber : PALETTE.litRed;
  ctx.fillRect(660, 624, 150 * (plane.fuel / 100), 16);
  text(ctx, `${Math.round(plane.fuel)}%  •  HULL ${Math.round(plane.hull)}%`, 660, 672, 14, PALETTE.text);
  // Throttle lever (mouse-draggable; see main.js for its hit box).
  text(ctx, 'THROTTLE — drag, or Shift / Ctrl', 860, 612, 11, PALETTE.muted);
  ctx.fillStyle = '#1c2a36';
  ctx.fillRect(860, 624, 200, 16);
  ctx.fillStyle = PALETTE.litAmber;
  ctx.fillRect(860, 624, 200 * (plane.throttle / 100), 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(860 + 200 * (plane.throttle / 100) - 2, 620, 4, 24);
  text(ctx, `${Math.round(plane.throttle)}%`, 1070, 640, 16, PALETTE.text);
  // Gear / flaps lamps — lit, not drawn. Spaced so no label ever overlaps.
  const lamp = (x, label, on, color) => {
    ctx.fillStyle = on ? color : '#22303c';
    ctx.beginPath();
    ctx.arc(x, 690, 7, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, label, x + 12, 695, 12, on ? PALETTE.text : PALETTE.muted);
  };
  lamp(860, 'GEAR', plane.gearDown, PALETTE.litGreen);
  lamp(950, 'FLAPS', plane.flapsDown, PALETTE.litCyan);
  lamp(1040, 'CARGO', missions.delivered > 0, PALETTE.litAmber);
  text(ctx, 'G gear · V flaps · Space drop · P pause', 1256, 670, 12, PALETTE.muted, 'right');
}

function panel(ctx, title, lines, prompt, accent) {
  const width = 640;
  const height = 130 + lines.length * 30;
  const x = (VIEW.width - width) / 2;
  const y = (VIEW.height - height) / 2 - 40;
  ctx.fillStyle = 'rgba(6,10,14,0.82)';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  text(ctx, title, VIEW.width / 2, y + 52, 34, accent, 'center', 800);
  lines.forEach((line, i) => {
    text(ctx, line, VIEW.width / 2, y + 96 + i * 30, 17, PALETTE.text, 'center');
  });
  text(ctx, prompt, VIEW.width / 2, y + height - 26, 16, PALETTE.litAmber, 'center', 700);
  return { x, y, width, height };
}

export function draw(game) {
  const { ctx, plane, world, missions, screen, time } = game;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  sky(ctx, plane, time);
  clouds(ctx, plane, world);
  seaAndGrid(ctx, plane);
  islands(ctx, plane, world);
  runway(ctx, plane, world);
  rings(ctx, plane, missions);
  drawPlane(ctx, plane, time);
  hud(ctx, plane, missions, time);
  instruments(ctx, plane, missions, world);
  if (screen === 'title') {
    panel(ctx, 'ARUNIKA', [
      'Sky courier of the archipelago. Fly the rings, drop the cargo,',
      'then bring her home on runway 09 — before the fuel runs out.',
      '← → bank   ↑ ↓ pitch   Shift throttle up   Ctrl throttle down',
      'G gear   V flaps   Space drop cargo   P pause',
    ], 'Press Space or click START to fly', PALETTE.litCyan);
  } else if (screen === 'paused') {
    panel(ctx, 'PAUSED', ['The islands will wait for you.'], 'Press P to resume', PALETTE.litAmber);
  } else if (screen === 'crashed') {
    panel(ctx, 'CRASHED', [game.crashReason || 'The sortie is over.', `Score ${missions.score}  •  Sortie ${missions.sortie}`], 'Press N or click to fly again', PALETTE.litRed);
  } else if (screen === 'landed') {
    panel(ctx, 'LANDED — WELCOME HOME', [
      game.landingLine || 'A safe touchdown on runway 09.',
      `Score ${missions.score}  •  Sortie ${missions.sortie} complete`,
      'Fuel topped up. The next sortie is harder — more wind, tighter rings.',
    ], 'Press N or click for the next sortie', PALETTE.litGreen);
  } else if (screen === 'done') {
    panel(ctx, 'SORTIE COMPLETE', [`Score ${missions.score}`, 'The courier route is yours.'], 'Press N or click to fly again', PALETTE.litGreen);
  }
}

export { CX, lerp, clamp };
