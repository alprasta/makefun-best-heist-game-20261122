// Entry point for Gilded Midnight. Owns the game loop, the screen flow
// (title -> play -> level clear / win / caught), the keyboard shortcuts and
// the ?shot= staging used for screenshots. The rules live in world.js, the
// drawing in render.js.

import { VIEW_W, VIEW_H } from './config.js';
import { createWorld, SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL, SCREEN_WIN, SCREEN_CAUGHT } from './world.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import { sfx, unlockAudio } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const world = createWorld();
const input = createInput(canvas);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const frozen = shot !== null;

if (frozen) {
  stageShot(shot, world);
} else {
  world.resetRun();
}

function playEventSounds(events) {
  for (const e of events) {
    if (e === 'pickup') sfx.pickup();
    else if (e === 'mainLoot') sfx.mainLoot();
    else if (e === 'coin') sfx.coin();
    else if (e === 'hack') sfx.hack();
    else if (e === 'spotted') sfx.spotted();
    else if (e === 'caught') sfx.caught();
    else if (e === 'win') sfx.win();
    else if (e === 'alarmTick') sfx.alarmTick();
  }
}

function onKey(e) {
  unlockAudio();
  if (e.key === 'Enter' || e.key === ' ') {
    if (world.screen === SCREEN_TITLE) {
      world.startPlay();
    } else if (world.screen === SCREEN_LEVEL) {
      world.loadLevel(world.levelIndex + 1);
      world.startPlay();
    }
  }
  if (e.key === 'r' || e.key === 'R') {
    if (world.screen === SCREEN_CAUGHT) {
      world.loadLevel(world.levelIndex);
      world.startPlay();
    } else if (world.screen === SCREEN_WIN) {
      world.resetRun();
      world.startPlay();
    }
  }
}
window.addEventListener('keydown', onKey);
canvas.addEventListener('click', () => {
  unlockAudio();
  if (world.screen === SCREEN_TITLE) world.startPlay();
});

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (!frozen && world.screen === SCREEN_PLAY) {
    const move = input.move();
    const events = world.step(dt, {
      dx: move.dx,
      dy: move.dy,
      sneak: input.sneak(),
      hackHeld: input.hackHeld(),
      click: input.takeClick(),
    });
    playEventSounds(events);
  } else if (!frozen && world.screen === SCREEN_TITLE) {
    // Attract mode: the gallery keeps patrolling behind the title panel.
    world.step(dt, { dx: 0, dy: 0, sneak: false, hackHeld: false, click: null });
  } else if (!frozen) {
    input.takeClick();
  }
  draw(ctx, world, now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test and screenshot hook: lets the playtest driver read live state and
// place the thief without touching the rules themselves.
window.__heist = {
  world,
  state: () => world.snapshot(),
  place: (x, y) => world.debugPlace(x, y),
  setAlarm: (v) => world.debugSetAlarm(v),
  start: () => world.startPlay(),
};
