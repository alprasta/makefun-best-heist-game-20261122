// The rules of Gilded Midnight: movement and collision, guard patrols and
// chases, sweeping cameras, vision cones, the alarm meter, decoy coins, the
// camera console, loot and the exit. No drawing here — render.js does that.

import {
  TILE, COLS, ROWS, WALK_SPEED, SNEAK_SPEED, GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED, PLAYER_RADIUS, GUARD_RADIUS, GUARD_CONE_RANGE,
  GUARD_CONE_HALF, CAMERA_CONE_RANGE, CAMERA_CONE_HALF, CATCH_RADIUS,
  BUMP_RADIUS, ALARM_MAX, ALARM_DECAY, CHASE_ALARM, HACK_ALARM_COST,
  HACK_SECONDS, CAMERA_OFF_SECONDS, COINS_PER_LEVEL, COIN_THROW_RANGE,
  COIN_LURE_RADIUS, COIN_FLIGHT_SECONDS, MAIN_LOOT_VALUE, BONUS_LOOT_VALUE,
} from './config.js';
import { LEVELS } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL = 'level';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

const TAU = Math.PI * 2;

function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function turnToward(current, target, maxStep) {
  const d = angleDiff(target, current);
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

export function createWorld() {
  const world = {
    levelIndex: 0,
    level: LEVELS[0],
    grid: [],
    screen: SCREEN_TITLE,
    player: { x: 0, y: 0, face: 0, sneak: false, moving: false },
    guards: [],
    cameras: [],
    start: { x: 0, y: 0 },
    exit: { x: 0, y: 0 },
    mainLoot: { x: 0, y: 0, taken: false },
    bonus: [],
    console: { x: 0, y: 0, used: false },
    alarm: 0,
    spotted: false,
    coins: COINS_PER_LEVEL,
    coinFlight: null,
    coinLanded: null,
    hackProgress: 0,
    cameraOff: 0,
    time: 0,
    levelLoot: 0,
    totalScore: 0,
    levelScore: 0,
    timeBonus: 0,
    caughtReason: '',
    tickT: 0,
    events: [],

    loadLevel(index) {
      this.levelIndex = index;
      this.level = LEVELS[index];
      this.grid = this.level.map.slice();
      this.bonus = [];
      this.levelLoot = 0;
      this.time = 0;
      this.alarm = 0;
      this.spotted = false;
      this.coins = COINS_PER_LEVEL;
      this.coinFlight = null;
      this.coinLanded = null;
      this.hackProgress = 0;
      this.cameraOff = 0;
      this.caughtReason = '';
      this.grid.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          const c = tileCenter(x, y);
          if (ch === 'T') { this.start = c; this.player.x = c.x; this.player.y = c.y; }
          if (ch === 'E') this.exit = c;
          if (ch === '*') this.mainLoot = { x: c.x, y: c.y, taken: false };
          if (ch === 'o') this.bonus.push({ x: c.x, y: c.y, taken: false });
          if (ch === 'H') this.console = { x: c.x, y: c.y, used: false };
        });
      });
      this.player.face = -Math.PI / 2;
      this.guards = this.level.guards.map((g) => {
        const c = tileCenter(g.waypoints[0][0], g.waypoints[0][1]);
        return {
          name: g.name, x: c.x, y: c.y, waypoints: g.waypoints, speed: g.speed,
          wp: 1, mode: 'patrol', face: 0, waitT: 0, loseT: 0,
          invest: null, stuckT: 0, lastX: c.x, lastY: c.y,
        };
      });
      this.cameras = this.level.cameras.map((c) => {
        const p = tileCenter(c.tx, c.ty);
        return {
          x: p.x, y: p.y, base: (c.baseDeg * Math.PI) / 180,
          sweep: (c.sweepDeg * Math.PI) / 180, speed: c.speed,
          range: c.range, phase: Math.random() * TAU, angle: (c.baseDeg * Math.PI) / 180,
          disabled: false,
        };
      });
    },

    resetRun() {
      this.totalScore = 0;
      this.loadLevel(0);
      this.screen = SCREEN_TITLE;
    },

    startPlay() {
      this.screen = SCREEN_PLAY;
    },

    tileAt(px, py) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor(py / TILE);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
      return this.grid[ty][tx];
    },

    solidAt(px, py) {
      const t = this.tileAt(px, py);
      return t === '#' || t === 'd';
    },

    blocksVision(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
      const t = this.grid[ty][tx];
      return t === '#' || t === 'd';
    },

    // Line of sight: sample along the segment; walls and cases block it.
    // Sampling starts 20px out so an emitter mounted inside a wall tile
    // (a camera) is not blinded by its own tile.
    los(x0, y0, x1, y1) {
      const dist = Math.hypot(x1 - x0, y1 - y0);
      for (let s = 20; s < dist; s += 6) {
        const t = s / dist;
        if (this.blocksVision(Math.floor((x0 + (x1 - x0) * t) / TILE), Math.floor((y0 + (y1 - y0) * t) / TILE))) return false;
      }
      return true;
    },

    inCone(ox, oy, facing, half, range, px, py) {
      const dx = px - ox;
      const dy = py - oy;
      const dist = Math.hypot(dx, dy);
      if (dist > range) return { seen: false, dist };
      if (dist < 4) return { seen: true, dist };
      const ang = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(ang, facing)) > half) return { seen: false, dist };
      if (!this.los(ox, oy, px, py)) return { seen: false, dist };
      return { seen: true, dist };
    },

    // Circle vs solid tiles, axis by axis so the thief slides along walls.
    moveCircle(body, dx, dy, radius) {
      const nx = body.x + dx;
      if (!this.solidAt(nx + Math.sign(dx) * radius, body.y - radius + 2)
        && !this.solidAt(nx + Math.sign(dx) * radius, body.y + radius - 2)
        && !this.solidAt(nx + Math.sign(dx) * radius, body.y)) body.x = nx;
      const ny = body.y + dy;
      if (!this.solidAt(body.x - radius + 2, ny + Math.sign(dy) * radius)
        && !this.solidAt(body.x + radius - 2, ny + Math.sign(dy) * radius)
        && !this.solidAt(body.x, ny + Math.sign(dy) * radius)) body.y = ny;
    },

    throwCoin(tx, ty) {
      if (this.coins <= 0 || this.coinFlight) return false;
      const dx = tx - this.player.x;
      const dy = ty - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > COIN_THROW_RANGE) return false;
      this.coins -= 1;
      this.coinFlight = { x: this.player.x, y: this.player.y, ox: this.player.x, oy: this.player.y, tx, ty, t: 0 };
      this.events.push('coin');
      return true;
    },

    step(dt, input) {
      this.events = [];
      const d = Math.min(dt, 0.05);

      // Cameras always sweep, even on the title screen behind the panel.
      for (const cam of this.cameras) {
        cam.phase += d * cam.speed;
        cam.angle = cam.base + Math.sin(cam.phase) * cam.sweep;
        cam.disabled = this.cameraOff > 0;
      }
      if (this.screen === SCREEN_TITLE) {
        this.patrolGuards(d);
        return this.events;
      }
      if (this.screen !== SCREEN_PLAY) return this.events;

      this.time += d;
      if (this.cameraOff > 0) this.cameraOff -= d;

      // --- Thief movement ---
      const p = this.player;
      let { dx, dy } = input;
      const len = Math.hypot(dx, dy);
      if (len > 0) { dx /= len; dy /= len; }
      p.sneak = !!input.sneak;
      p.moving = len > 0;
      const speed = p.sneak ? SNEAK_SPEED : WALK_SPEED;
      if (len > 0) {
        p.face = Math.atan2(dy, dx);
        this.moveCircle(p, dx * speed * d, dy * speed * d, PLAYER_RADIUS);
      }

      // --- Decoy coin ---
      if (input.click) this.throwCoin(input.click.x, input.click.y);
      if (this.coinFlight) {
        const f = this.coinFlight;
        f.t += d / COIN_FLIGHT_SECONDS;
        if (f.t >= 1) {
          this.coinLanded = { x: f.tx, y: f.ty, t: 0 };
          for (const g of this.guards) {
            if (Math.hypot(g.x - f.tx, g.y - f.ty) < COIN_LURE_RADIUS) {
              g.mode = 'investigate';
              g.invest = { x: f.tx, y: f.ty };
              g.waitT = 0;
            }
          }
          this.coinFlight = null;
        } else {
          f.x = f.ox + (f.tx - f.ox) * f.t;
          f.y = f.oy + (f.ty - f.oy) * f.t;
        }
      }
      if (this.coinLanded) {
        this.coinLanded.t += d;
        if (this.coinLanded.t > 4) this.coinLanded = null;
      }

      // --- Camera console hack ---
      const consoleDist = Math.hypot(p.x - this.console.x, p.y - this.console.y);
      if (!this.console.used && consoleDist < 48 && input.hackHeld) {
        this.hackProgress += d / HACK_SECONDS;
        if (this.hackProgress >= 1) {
          this.console.used = true;
          this.cameraOff = CAMERA_OFF_SECONDS;
          this.alarm = Math.min(ALARM_MAX, this.alarm + HACK_ALARM_COST);
          this.events.push('hack');
        }
      } else {
        this.hackProgress = Math.max(0, this.hackProgress - d * 0.8);
      }

      // --- Guards ---
      this.updateGuards(d);

      // --- Detection: cones, then the alarm ---
      let seen = false;
      let rate = 0;
      const sneakFactor = p.sneak ? 0.45 : 1;
      for (const g of this.guards) {
        if (g.mode === 'investigate') continue;
        const near = Math.hypot(p.x - g.x, p.y - g.y);
        if (near < BUMP_RADIUS && this.los(g.x, g.y, p.x, p.y)) {
          seen = true;
          rate = Math.max(rate, 55);
          g.mode = 'chase';
          g.loseT = 0;
          g.face = Math.atan2(p.y - g.y, p.x - g.x);
          continue;
        }
        const hit = this.inCone(g.x, g.y, g.face, GUARD_CONE_HALF, GUARD_CONE_RANGE, p.x, p.y);
        if (hit.seen) {
          seen = true;
          rate = Math.max(rate, (14 + 34 * (1 - hit.dist / GUARD_CONE_RANGE)) * sneakFactor);
          if (hit.dist < 130 || this.alarm > CHASE_ALARM) {
            g.mode = 'chase';
            g.loseT = 0;
          }
        }
      }
      for (const cam of this.cameras) {
        if (cam.disabled) continue;
        const hit = this.inCone(cam.x, cam.y, cam.angle, CAMERA_CONE_HALF, cam.range, p.x, p.y);
        if (hit.seen) {
          seen = true;
          rate = Math.max(rate, (18 + 36 * (1 - hit.dist / cam.range)) * sneakFactor);
        }
      }
      const wasSpotted = this.spotted;
      this.spotted = seen;
      if (seen) {
        const before = this.alarm;
        this.alarm = Math.min(ALARM_MAX, this.alarm + rate * d);
        if (before < CHASE_ALARM && this.alarm >= CHASE_ALARM) this.events.push('spotted');
      } else {
        this.alarm = Math.max(0, this.alarm - ALARM_DECAY * d);
      }
      if (this.alarm > 70) {
        this.tickT += d;
        if (this.tickT > 0.5) { this.tickT = 0; this.events.push('alarmTick'); }
      }

      // --- Caught? ---
      for (const g of this.guards) {
        if (Math.hypot(p.x - g.x, p.y - g.y) < CATCH_RADIUS) {
          this.caught('A guard grabbed you.');
          return this.events;
        }
      }
      if (this.alarm >= ALARM_MAX) {
        this.caught('The alarm hit maximum — the gallery locked down.');
        return this.events;
      }

      // --- Loot ---
      if (!this.mainLoot.taken && Math.hypot(p.x - this.mainLoot.x, p.y - this.mainLoot.y) < 24) {
        this.mainLoot.taken = true;
        this.levelLoot += MAIN_LOOT_VALUE;
        this.events.push('mainLoot');
      }
      for (const b of this.bonus) {
        if (!b.taken && Math.hypot(p.x - b.x, p.y - b.y) < 22) {
          b.taken = true;
          this.levelLoot += BONUS_LOOT_VALUE;
          this.events.push('pickup');
        }
      }

      // --- Exit ---
      if (this.mainLoot.taken && Math.hypot(p.x - this.exit.x, p.y - this.exit.y) < 24) {
        this.timeBonus = Math.max(0, Math.round((this.level.par - this.time) * 10));
        this.levelScore = this.levelLoot + this.timeBonus;
        this.totalScore += this.levelScore;
        if (this.levelIndex >= LEVELS.length - 1) {
          this.screen = SCREEN_WIN;
          this.events.push('win');
        } else {
          this.screen = SCREEN_LEVEL;
          this.events.push('win');
        }
      }
      return this.events;
    },

    patrolGuards(d) {
      for (const g of this.guards) {
        if (g.mode !== 'patrol') continue;
        const target = tileCenter(g.waypoints[g.wp][0], g.waypoints[g.wp][1]);
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          g.wp = (g.wp + 1) % g.waypoints.length;
          g.waitT = 0.4;
          continue;
        }
        if (g.waitT > 0) { g.waitT -= d; continue; }
        const stepLen = Math.min(dist, g.speed * d);
        g.x += (dx / dist) * stepLen;
        g.y += (dy / dist) * stepLen;
        g.face = turnToward(g.face, Math.atan2(dy, dx), d * 7);
      }
    },

    updateGuards(d) {
      const p = this.player;
      for (const g of this.guards) {
        if (g.mode === 'investigate') {
          const t = g.invest;
          const dx = t.x - g.x;
          const dy = t.y - g.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 8) {
            const stepLen = Math.min(dist, g.speed * 1.15 * d);
            this.moveCircle(g, (dx / dist) * stepLen, (dy / dist) * stepLen, GUARD_RADIUS);
            g.face = turnToward(g.face, Math.atan2(dy, dx), d * 7);
          } else {
            g.waitT += d;
            g.face += d * 1.5;
            if (g.waitT > 2.5) {
              g.mode = 'patrol';
              g.invest = null;
              g.waitT = 0;
            }
          }
          continue;
        }
        if (g.mode === 'chase') {
          const dx = p.x - g.x;
          const dy = p.y - g.y;
          const dist = Math.hypot(dx, dy);
          const canSee = dist < GUARD_CONE_RANGE && this.los(g.x, g.y, p.x, p.y)
            && (Math.abs(angleDiff(Math.atan2(dy, dx), g.face)) < 1.2 || dist < 60);
          if (canSee) {
            g.loseT = 0;
            const stepLen = Math.min(dist, GUARD_CHASE_SPEED * d);
            this.moveCircle(g, (dx / dist) * stepLen, (dy / dist) * stepLen, GUARD_RADIUS);
            g.face = turnToward(g.face, Math.atan2(dy, dx), d * 9);
          } else {
            g.loseT += d;
            if (g.loseT > 2.5 || this.alarm < 20) {
              g.mode = 'patrol';
              g.loseT = 0;
            }
          }
          // A chasing guard that stops moving is stuck on a wall: give up.
          if (Math.hypot(g.x - g.lastX, g.y - g.lastY) < 1 && dist > 30) {
            g.stuckT += d;
            if (g.stuckT > 1.4) { g.mode = 'patrol'; g.stuckT = 0; }
          } else {
            g.stuckT = 0;
          }
          g.lastX = g.x;
          g.lastY = g.y;
          continue;
        }
        // Patrol.
        const target = tileCenter(g.waypoints[g.wp][0], g.waypoints[g.wp][1]);
        const dx = target.x - g.x;
        const dy = target.y - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          g.wp = (g.wp + 1) % g.waypoints.length;
          g.waitT = 0.4;
          continue;
        }
        if (g.waitT > 0) { g.waitT -= d; continue; }
        const stepLen = Math.min(dist, g.speed * d);
        g.x += (dx / dist) * stepLen;
        g.y += (dy / dist) * stepLen;
        g.face = turnToward(g.face, Math.atan2(dy, dx), d * 7);
      }
    },

    caught(reason) {
      this.caughtReason = reason;
      this.screen = SCREEN_CAUGHT;
      this.events.push('caught');
    },

    // Debug hooks for the screenshot stager and the playtest driver. They only
    // set positions and meters; every rule still runs through step().
    debugPlace(x, y) {
      this.player.x = x;
      this.player.y = y;
    },
    debugSetAlarm(v) {
      this.alarm = v;
    },

    snapshot() {
      return {
        screen: this.screen,
        level: this.levelIndex + 1,
        alarm: Math.round(this.alarm * 10) / 10,
        player: { x: Math.round(this.player.x), y: Math.round(this.player.y) },
        loot: this.levelLoot,
        mainTaken: this.mainLoot.taken,
        bonusTaken: this.bonus.filter((b) => b.taken).length,
        coins: this.coins,
        time: Math.round(this.time * 10) / 10,
        score: this.totalScore,
        guards: this.guards.map((g) => ({ mode: g.mode, x: Math.round(g.x), y: Math.round(g.y) })),
        camerasOff: this.cameraOff > 0,
      };
    },
  };

  world.resetRun();
  return world;
}
