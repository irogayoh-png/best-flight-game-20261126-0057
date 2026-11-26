// input.js — keyboard and mouse. The keyboard flies the plane; the mouse
// works the menus, the throttle slider and the start/restart buttons.

import { CONTROLS } from './config.js';

export function newInput() {
  return {
    keys: new Set(),
    pitchUp: false, pitchDown: false,
    bankLeft: false, bankRight: false,
    throttleUp: false, throttleDown: false,
    pressed: new Set(), // edge-triggered keys, consumed once per frame
    mouseX: 0, mouseY: 0, mouseDown: false,
    draggingThrottle: false,
  };
}

function has(input, codes) {
  return codes.some((c) => input.keys.has(c));
}

export function attachInput(input, canvas, callbacks) {
  const update = () => {
    input.pitchUp = has(input, CONTROLS.pitchUp);
    input.pitchDown = has(input, CONTROLS.pitchDown);
    input.bankLeft = has(input, CONTROLS.bankLeft);
    input.bankRight = has(input, CONTROLS.bankRight);
    input.throttleUp = has(input, CONTROLS.throttleUp);
    input.throttleDown = has(input, CONTROLS.throttleDown);
  };
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.keys.add(event.code);
      input.pressed.add(event.code);
      if (CONTROLS.dropCargo.includes(event.code)) callbacks.onDrop?.();
      if (CONTROLS.gear.includes(event.code)) callbacks.onGear?.();
      if (CONTROLS.flaps.includes(event.code)) callbacks.onFlaps?.();
      if (CONTROLS.pause.includes(event.code)) callbacks.onPause?.();
      if (CONTROLS.restart.includes(event.code)) callbacks.onRestart?.();
      if (CONTROLS.mute.includes(event.code)) callbacks.onMute?.();
    }
    update();
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
    update();
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    update();
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 720;
    if (input.draggingThrottle) callbacks.onThrottleDrag?.(input.mouseX, input.mouseY);
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 1280;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 720;
    input.mouseDown = true;
    if (!callbacks.onThrottleGrab?.(input.mouseX, input.mouseY)) {
      callbacks.onClick?.(input.mouseX, input.mouseY);
    } else {
      input.draggingThrottle = true;
    }
  });
  window.addEventListener('pointerup', () => {
    input.mouseDown = false;
    input.draggingThrottle = false;
  });
  update();
  return input;
}

export function consumePressed(input) {
  const pressed = new Set(input.pressed);
  input.pressed.clear();
  return pressed;
}
