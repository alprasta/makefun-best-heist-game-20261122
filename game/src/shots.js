// Deterministic screenshot scenes behind ?shot=start|play|tense|win. Each one
// sets the real game state — the same world the player plays in — then the
// renderer draws it. No scene invents pixels: the thief, the guards, the
// cameras, the loot and the alarm meter are all live game objects.

import { TILE } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './world.js';

function tileXY(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function stageShot(name, world) {
  world.loadLevel(0);
  world.totalScore = 0;
  if (name === 'play') {
    // Mid-heist: Rook is crossing the middle gallery, one guard patrols
    // ahead with his cone sweeping, another works the vault corridor, both
    // cameras are live, the Star of Aurum still glints in its vault, and
    // the alarm sits part-way up from a brush with a camera.
    world.startPlay();
    const mid = tileXY(17, 7);
    world.debugPlace(mid.x, mid.y);
    world.player.face = 0.35;
    const g0 = world.guards[0];
    const g0pos = tileXY(21, 5);
    g0.x = g0pos.x;
    g0.y = g0pos.y;
    g0.face = Math.PI / 2 + 0.3;
    g0.mode = 'patrol';
    const g1 = world.guards[1];
    const g1pos = tileXY(33, 9);
    g1.x = g1pos.x;
    g1.y = g1pos.y;
    g1.face = -Math.PI / 2;
    g1.mode = 'patrol';
    world.cameras[0].angle = (90 * Math.PI) / 180 + 0.4;
    world.cameras[1].angle = 0.35;
    world.debugSetAlarm(34);
    world.time = 47;
    world.levelLoot = 500;
    world.bonus[0].taken = true;
    world.screen = SCREEN_PLAY;
    return;
  }
  if (name === 'tense') {
    // The alarm is nearly maxed and Marlow has Rook in his sights.
    world.startPlay();
    const spot = tileXY(23, 6);
    world.debugPlace(spot.x, spot.y);
    world.player.face = Math.PI;
    const g0 = world.guards[0];
    const g0pos = tileXY(21, 6);
    g0.x = g0pos.x;
    g0.y = g0pos.y;
    g0.face = 0;
    g0.mode = 'chase';
    const g1 = world.guards[1];
    const g1pos = tileXY(30, 10);
    g1.x = g1pos.x;
    g1.y = g1pos.y;
    g1.face = Math.PI;
    g1.mode = 'patrol';
    world.cameras[0].angle = (90 * Math.PI) / 180;
    world.cameras[1].angle = 0.5;
    world.debugSetAlarm(86);
    world.spotted = true;
    world.time = 96;
    world.levelLoot = 1000;
    world.bonus[0].taken = true;
    world.bonus[1].taken = true;
    world.screen = SCREEN_PLAY;
    return;
  }
  if (name === 'win') {
    // The getaway: all three nights cleared.
    world.loadLevel(2);
    world.mainLoot.taken = true;
    world.bonus.forEach((b) => { b.taken = true; });
    world.levelLoot = 6500;
    world.totalScore = 18400;
    world.time = 142;
    world.screen = SCREEN_WIN;
    return;
  }
  // Default: the title screen over the live gallery.
  world.screen = SCREEN_TITLE;
}
