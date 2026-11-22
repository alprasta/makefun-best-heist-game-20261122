// All drawing for Gilded Midnight: the gallery floor, walls and cases, the
// loot, the exit and the console, vision cones raycast against the walls,
// the guards, the cameras, the thief, the HUD with its alarm meter, and the
// title / level-clear / win / caught panels.

import {
  TILE, COLS, ROWS, VIEW_W, VIEW_H, HUD_H, PLAYER_RADIUS, GUARD_RADIUS,
  GUARD_CONE_RANGE, GUARD_CONE_HALF, CAMERA_CONE_HALF, ALARM_MAX,
  CHASE_ALARM, COLORS,
} from './config.js';
import { SCREEN_TITLE, SCREEN_LEVEL, SCREEN_WIN, SCREEN_CAUGHT } from './world.js';

function conePolygon(world, ox, oy, facing, half, range) {
  const points = [[ox, oy]];
  const steps = 16;
  for (let i = 0; i <= steps; i += 1) {
    const a = facing - half + (2 * half * i) / steps;
    let r = range;
    // Start 20px out so a camera mounted inside a wall tile draws its cone
    // from the wall face, not from inside the wall.
    for (let d = 20; d < range; d += 8) {
      const x = ox + Math.cos(a) * d;
      const y = oy + Math.sin(a) * d;
      if (world.solidAt(x, y)) { r = d; break; }
    }
    points.push([ox + Math.cos(a) * r, oy + Math.sin(a) * r]);
  }
  return points;
}

function drawCone(ctx, world, ox, oy, facing, half, range, fill, edge) {
  const poly = conePolygon(world, ox, oy, facing, half, range);
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function alarmColor(v) {
  if (v < 40) return COLORS.alarmLow;
  if (v < 70) return COLORS.alarmMid;
  return COLORS.alarmHigh;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 11, 19, 0.92)';
  ctx.strokeStyle = COLORS.goldDim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function centerText(ctx, text, cx, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, cx, y);
}

export function draw(ctx, world, now) {
  const t = now / 1000;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);

  // --- Floor ---
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = world.grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (ch === '#') continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(px, py, TILE, TILE);
      if (y === 7 && ch !== 'd') {
        // The red carpet runner down the middle corridor.
        ctx.fillStyle = COLORS.carpet;
        ctx.fillRect(px, py + 4, TILE, TILE - 8);
        ctx.fillStyle = COLORS.carpetEdge;
        ctx.fillRect(px, py + 4, TILE, 2);
        ctx.fillRect(px, py + TILE - 6, TILE, 2);
      }
    }
  }

  // --- Exit door, console, loot ---
  const ex = world.exit;
  ctx.save();
  ctx.shadowColor = world.mainLoot.taken ? COLORS.exitGreen : '#1d5c33';
  ctx.shadowBlur = world.mainLoot.taken ? 18 : 6;
  ctx.fillStyle = world.mainLoot.taken ? COLORS.exitGreen : '#2a7a45';
  ctx.fillRect(ex.x - 14, ex.y - 14, 28, 28);
  ctx.restore();
  ctx.fillStyle = '#0d1f14';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex.x, ex.y - 18);
  ctx.fillStyle = '#d8ffe4';
  ctx.fillText('EXIT', ex.x, ex.y + 3);

  const cs = world.console;
  ctx.fillStyle = '#0c1420';
  ctx.fillRect(cs.x - 13, cs.y - 13, 26, 26);
  ctx.strokeStyle = world.console.used ? '#4a5568' : '#3ecf6e';
  ctx.lineWidth = 2;
  ctx.strokeRect(cs.x - 13, cs.y - 13, 26, 26);
  ctx.fillStyle = world.console.used ? '#4a5568' : '#3ecf6e';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.fillText('CAM', cs.x, cs.y + 3);
  if (world.hackProgress > 0 && !world.console.used) {
    ctx.fillStyle = '#0c1420';
    ctx.fillRect(cs.x - 18, cs.y - 26, 36, 7);
    ctx.fillStyle = '#3ecf6e';
    ctx.fillRect(cs.x - 17, cs.y - 25, 34 * world.hackProgress, 5);
  }

  for (const b of world.bonus) {
    if (b.taken) continue;
    const pulse = 1 + 0.08 * Math.sin(t * 4 + b.x);
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(b.x - 4, b.y + 3, 5 * pulse, 0, Math.PI * 2);
    ctx.arc(b.x + 4, b.y + 3, 5 * pulse, 0, Math.PI * 2);
    ctx.arc(b.x, b.y - 3, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.goldDim;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  if (!world.mainLoot.taken) {
    const ml = world.mainLoot;
    const glow = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.save();
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 22 * glow;
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.moveTo(ml.x, ml.y - 13);
    ctx.lineTo(ml.x + 10, ml.y);
    ctx.lineTo(ml.x, ml.y + 13);
    ctx.lineTo(ml.x - 10, ml.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ml.x - 10, ml.y);
    ctx.lineTo(ml.x + 10, ml.y);
    ctx.moveTo(ml.x, ml.y - 13);
    ctx.lineTo(ml.x, ml.y + 13);
    ctx.stroke();
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText('THE STAR OF AURUM', ml.x, ml.y - 20);
  }

  // --- Vision cones (under the characters, over the floor) ---
  for (const g of world.guards) {
    if (g.mode === 'investigate') continue;
    drawCone(ctx, world, g.x, g.y, g.face, GUARD_CONE_HALF, GUARD_CONE_RANGE,
      g.mode === 'chase' ? 'rgba(232, 72, 72, 0.26)' : COLORS.guardCone,
      g.mode === 'chase' ? 'rgba(232, 72, 72, 0.55)' : COLORS.guardConeEdge);
  }
  for (const cam of world.cameras) {
    if (cam.disabled) {
      drawCone(ctx, world, cam.x, cam.y, cam.angle, CAMERA_CONE_HALF, cam.range,
        'rgba(120, 130, 150, 0.08)', 'rgba(120, 130, 150, 0.25)');
    } else {
      drawCone(ctx, world, cam.x, cam.y, cam.angle, CAMERA_CONE_HALF, cam.range,
        COLORS.cameraCone, COLORS.cameraConeEdge);
    }
  }

  // --- Walls and display cases ---
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = world.grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(px, py, TILE, 3);
        if (y + 1 < ROWS && world.grid[y + 1][x] !== '#') {
          ctx.fillStyle = COLORS.wallTrim;
          ctx.fillRect(px, py + TILE - 3, TILE, 3);
        }
      } else if (ch === 'd') {
        ctx.fillStyle = COLORS.caseBase;
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = COLORS.caseGlass;
        ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        ctx.strokeStyle = COLORS.goldDim;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
      }
    }
  }

  // --- Cameras (mounted on their wall tile) ---
  for (const cam of world.cameras) {
    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(cam.x - 7, cam.y - 7, 14, 14);
    ctx.strokeStyle = cam.disabled ? '#5a6478' : '#e84848';
    ctx.lineWidth = 2;
    ctx.strokeRect(cam.x - 7, cam.y - 7, 14, 14);
    ctx.fillStyle = cam.disabled ? '#5a6478' : '#ff5a5a';
    ctx.beginPath();
    ctx.arc(cam.x + Math.cos(cam.angle) * 4, cam.y + Math.sin(cam.angle) * 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (!cam.disabled && Math.sin(t * 5) > 0) {
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath();
      ctx.arc(cam.x - 8, cam.y - 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (cam.disabled) {
      ctx.fillStyle = '#8b96ab';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFF', cam.x, cam.y + 18);
    }
  }

  // --- Guards ---
  for (const g of world.guards) {
    ctx.fillStyle = COLORS.guardBody;
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d7deeb';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Cap brim points where the guard is looking.
    ctx.fillStyle = COLORS.guardCap;
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.face) * 5, g.y + Math.sin(g.face) * 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath();
    ctx.arc(g.x + Math.cos(g.face) * 8, g.y + Math.sin(g.face) * 8, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (g.mode === 'chase') {
      ctx.fillStyle = '#ff5a5a';
      ctx.fillText('!', g.x, g.y - 18);
    } else if (g.mode === 'investigate') {
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('?', g.x, g.y - 18);
    }
  }

  // --- Decoy coin ---
  const drawCoinAt = (x, y) => {
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.goldDim;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  if (world.coinFlight) drawCoinAt(world.coinFlight.x, world.coinFlight.y - 6);
  if (world.coinLanded) drawCoinAt(world.coinLanded.x, world.coinLanded.y);

  // --- The thief ---
  const p = world.player;
  const crouch = p.sneak ? 0.85 : 1;
  ctx.fillStyle = 'rgba(242, 193, 78, 0.14)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS * crouch + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.thiefCloak;
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER_RADIUS * crouch, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.thiefTrim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Hood point and gold clasp show which way Rook is facing.
  ctx.fillStyle = COLORS.thiefCloak;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.face) * 4, p.y + Math.sin(p.face) * 4);
  ctx.lineTo(p.x + Math.cos(p.face + 2.4) * 9, p.y + Math.sin(p.face + 2.4) * 9);
  ctx.lineTo(p.x + Math.cos(p.face - 2.4) * 9, p.y + Math.sin(p.face - 2.4) * 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.face) * 8, p.y + Math.sin(p.face) * 8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (world.spotted && world.screen === 'play') {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 19);
  }

  // --- Alarm vignette when things are hot ---
  if (world.alarm > CHASE_ALARM && world.screen === 'play') {
    const a = ((world.alarm - CHASE_ALARM) / (ALARM_MAX - CHASE_ALARM)) * (0.22 + 0.12 * Math.sin(t * 6));
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(232, 72, 72, 0)');
    grad.addColorStop(1, `rgba(232, 72, 72, ${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawHud(ctx, world);

  if (world.screen === SCREEN_TITLE) drawTitle(ctx, world);
  if (world.screen === SCREEN_LEVEL) drawLevelClear(ctx, world);
  if (world.screen === SCREEN_WIN) drawWin(ctx, world);
  if (world.screen === SCREEN_CAUGHT) drawCaught(ctx, world);
}

function drawHud(ctx, world) {
  // Bottom bar: it overlays only the bottom wall row, so no room is hidden.
  const barTop = VIEW_H - HUD_H;
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, barTop, VIEW_W, HUD_H);
  ctx.fillStyle = COLORS.wallTrim;
  ctx.fillRect(0, barTop, VIEW_W, 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(world.level.name, 12, barTop + 17);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(world.mainLoot.taken ? 'Loot secured — reach the EXIT!' : world.level.objective, 12, barTop + 33);

  // Alarm meter, dead centre.
  const barW = 300;
  const barX = VIEW_W / 2 - barW / 2;
  const barY = barTop + 10;
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = world.alarm > 70 ? '#ff8a8a' : COLORS.text;
  ctx.textAlign = 'right';
  ctx.fillText('ALARM', barX - 8, barY + 12);
  ctx.fillStyle = '#0c0f16';
  ctx.fillRect(barX, barY, barW, 15);
  ctx.fillStyle = alarmColor(world.alarm);
  ctx.fillRect(barX, barY, barW * (world.alarm / ALARM_MAX), 15);
  ctx.strokeStyle = '#4a5568';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, 15);
  // Chase threshold tick.
  ctx.fillStyle = '#e8e2d0';
  ctx.fillRect(barX + barW * (CHASE_ALARM / ALARM_MAX) - 1, barY - 2, 2, 19);
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = alarmColor(world.alarm);
  ctx.fillText(`${Math.floor(world.alarm)}%`, barX + barW + 8, barY + 13);

  // Right side: loot, coins, time.
  ctx.textAlign = 'right';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`LOOT $${world.levelLoot.toLocaleString('en-US')}`, VIEW_W - 12, barTop + 17);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  const coinText = `coins ${world.coins}   ${fmtTime(world.time)}   night ${world.levelIndex + 1}/3`;
  ctx.fillText(coinText, VIEW_W - 12, barTop + 33);
  ctx.textAlign = 'left';
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 330, 62, 660, 356);
  centerText(ctx, 'GILDED MIDNIGHT', VIEW_W / 2, 122, 'bold 44px Georgia, serif', COLORS.gold);
  centerText(ctx, '— a three-night heist —', VIEW_W / 2, 150, 'italic 16px Georgia, serif', COLORS.textDim);
  centerText(ctx, 'You are Rook, a thief with champagne taste and a quiet pair of shoes.', VIEW_W / 2, 188, '15px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'Cross each gallery, lift the great jewel, and leave before the alarm does.', VIEW_W / 2, 210, '15px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'Read the cones. Mind the cameras. Spend your coins wisely.', VIEW_W / 2, 232, '15px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'WASD / arrows — move      SHIFT — sneak (harder to spot)', VIEW_W / 2, 272, '13px system-ui, sans-serif', COLORS.textDim);
  centerText(ctx, 'CLICK — toss a decoy coin      Hold E at a CAM panel — kill the cameras', VIEW_W / 2, 294, '13px system-ui, sans-serif', COLORS.textDim);
  centerText(ctx, 'Grab the jewel, then reach the green EXIT. Alarm at 100% and it is over.', VIEW_W / 2, 316, '13px system-ui, sans-serif', COLORS.textDim);
  const blink = Math.sin(Date.now() / 350) > -0.2;
  if (blink) centerText(ctx, 'PRESS ENTER OR CLICK TO BEGIN', VIEW_W / 2, 366, 'bold 17px system-ui, sans-serif', COLORS.gold);
  centerText(ctx, 'An original game. No network, no accounts, just you and the night.', VIEW_W / 2, 398, '11px system-ui, sans-serif', COLORS.textDim);
}

function drawLevelClear(ctx, world) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 280, 120, 560, 220);
  centerText(ctx, 'NIGHT CLEAR', VIEW_W / 2, 178, 'bold 36px Georgia, serif', COLORS.gold);
  centerText(ctx, `Loot this night: $${world.levelLoot.toLocaleString('en-US')}    Time bonus: $${world.timeBonus.toLocaleString('en-US')}`, VIEW_W / 2, 218, '15px system-ui, sans-serif', COLORS.text);
  centerText(ctx, `Total score: ${world.totalScore.toLocaleString('en-US')}`, VIEW_W / 2, 248, 'bold 16px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'PRESS ENTER FOR THE NEXT NIGHT', VIEW_W / 2, 298, 'bold 15px system-ui, sans-serif', COLORS.gold);
}

function drawWin(ctx, world) {
  ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 300, 100, 600, 260);
  centerText(ctx, 'CLEAN GETAWAY', VIEW_W / 2, 162, 'bold 40px Georgia, serif', COLORS.gold);
  centerText(ctx, 'Three galleries. Three jewels. Not a single siren that mattered.', VIEW_W / 2, 202, '15px system-ui, sans-serif', COLORS.text);
  centerText(ctx, `Final score: ${world.totalScore.toLocaleString('en-US')}`, VIEW_W / 2, 242, 'bold 18px system-ui, sans-serif', COLORS.text);
  centerText(ctx, 'Rook retires to a small island with excellent locks.', VIEW_W / 2, 272, '14px system-ui, sans-serif', COLORS.textDim);
  centerText(ctx, 'PRESS R TO PLAY AGAIN', VIEW_W / 2, 318, 'bold 15px system-ui, sans-serif', COLORS.gold);
}

function drawCaught(ctx, world) {
  ctx.fillStyle = 'rgba(40, 6, 8, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, VIEW_W / 2 - 280, 120, 560, 220);
  centerText(ctx, 'BUSTED!', VIEW_W / 2, 178, 'bold 40px Georgia, serif', '#ff5a5a');
  centerText(ctx, world.caughtReason, VIEW_W / 2, 218, '15px system-ui, sans-serif', COLORS.text);
  centerText(ctx, `Loot kept: $${world.levelLoot.toLocaleString('en-US')}    Score: ${world.totalScore.toLocaleString('en-US')}`, VIEW_W / 2, 248, '14px system-ui, sans-serif', COLORS.textDim);
  centerText(ctx, 'PRESS R TO RETRY THE NIGHT', VIEW_W / 2, 298, 'bold 15px system-ui, sans-serif', COLORS.gold);
}
