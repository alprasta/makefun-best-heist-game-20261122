// Screenshot + playtest driver for Gilded Midnight.
//
//   node shots.mjs            take the 4 screenshots in shots.json
//   node shots.mjs --playtest  drive the real game: move, get spotted,
//                             grab the loot, win, and get caught
//
// Serves game/ on a scratch port, drives the cached Chromium
// (~/.cache/ms-playwright/chromium-1255) through playwright-core, which
// lives in /tmp/heist-tools so nothing extra lands in the repo.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/tmp/heist-tools/package.json');
const { chromium } = require('playwright-core');

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8901;
const BASE = `http://localhost:${PORT}`;
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`;
const SHOTS = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startServer() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) return server;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  server.kill();
  throw new Error('serve.ts did not come up');
}

async function launch() {
  return chromium.launch({
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
}

async function takeShots() {
  const server = await startServer();
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 480 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const shot of SHOTS) {
      await page.goto(`${BASE}/${shot.query}`, { waitUntil: 'networkidle' });
      await sleep(600);
      const out = join(here, 'screenshots', shot.name);
      await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
      const bytes = statSync(out).size;
      console.log(`${shot.name}: ${bytes} bytes${bytes > 262144 ? '  *** OVER 256 KiB ***' : ''}`);
    }
    console.log(errors.length ? `CONSOLE ERRORS: ${errors.join(' | ')}` : 'no console errors');
  } finally {
    await browser.close();
    server.kill();
  }
}

async function playtest() {
  const server = await startServer();
  const browser = await launch();
  const failures = [];
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 480 } });
    const errors = [];
    const outside = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => { if (!r.url().startsWith(BASE)) outside.push(r.url()); });

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(500);
    const hasHook = await page.evaluate(() => !!window.__heist);
    check('game boots, __heist hook present', hasHook);
    let s = await page.evaluate(() => window.__heist.state());
    check('title screen at load', s.screen === 'title', `screen=${s.screen}`);

    await page.keyboard.press('Enter');
    await sleep(300);
    s = await page.evaluate(() => window.__heist.state());
    check('Enter starts play', s.screen === 'play', `screen=${s.screen}`);

    // Movement: hold D and watch the thief move right.
    const x0 = s.player.x;
    await page.keyboard.down('d');
    await sleep(600);
    await page.keyboard.up('d');
    s = await page.evaluate(() => window.__heist.state());
    check('D key moves the thief', s.player.x > x0 + 30, `x ${x0} -> ${s.player.x}`);

    // Sneak is slower than walking.
    await page.keyboard.down('Shift');
    await page.keyboard.down('d');
    await sleep(600);
    await page.keyboard.up('d');
    await page.keyboard.up('Shift');
    const sSneak = await page.evaluate(() => window.__heist.state());
    check('sneak moves (slower)', sSneak.player.x > s.player.x && sSneak.player.x < s.player.x + 90,
      `x ${s.player.x} -> ${sSneak.player.x}`);

    // Decoy coin: click near the thief, coins drop by one.
    const coins0 = sSneak.coins;
    await page.mouse.click(sSneak.player.x + 100, sSneak.player.y);
    await sleep(600);
    s = await page.evaluate(() => window.__heist.state());
    check('click tosses a decoy coin', s.coins === coins0 - 1, `coins ${coins0} -> ${s.coins}`);

    // Getting spotted: freeze the vault camera on its base angle (straight
    // down) so its cone is deterministic, stand in it, watch the alarm climb.
    await page.evaluate(() => {
      const c = window.__heist.world.cameras[0];
      c.speed = 0;
      c.phase = 0;
      window.__heist.place(1072, 280);
      window.__heist.setAlarm(10);
    });
    await sleep(1200);
    s = await page.evaluate(() => window.__heist.state());
    check('standing in a camera cone raises the alarm', s.alarm > 20, `alarm=${s.alarm}`);

    // Alarm decays once hidden again.
    await page.evaluate(() => window.__heist.place(80, 430));
    await sleep(1500);
    const sHidden = await page.evaluate(() => window.__heist.state());
    check('alarm decays while hidden', sHidden.alarm < s.alarm, `alarm ${s.alarm} -> ${sHidden.alarm}`);

    // Win path: take the Star of Aurum, then reach the exit.
    await page.evaluate(() => window.__heist.place(1040, 80));
    await sleep(400);
    s = await page.evaluate(() => window.__heist.state());
    check('touching the main loot collects it', s.mainTaken === true, `mainTaken=${s.mainTaken}`);
    await page.evaluate(() => window.__heist.place(80, 48));
    await sleep(400);
    s = await page.evaluate(() => window.__heist.state());
    check('loot + exit completes the night', s.screen === 'level', `screen=${s.screen}`);

    // Lose path: max the alarm while spotted. (This is night 2 now: its
    // first camera sits at tile (31,6) and faces west, so stand west of it.)
    await page.keyboard.press('Enter');
    await sleep(300);
    await page.evaluate(() => {
      const c = window.__heist.world.cameras[0];
      c.speed = 0;
      c.phase = 0;
      window.__heist.setAlarm(99);
      window.__heist.place(900, 208);
    });
    await sleep(1500);
    s = await page.evaluate(() => window.__heist.state());
    check('alarm at max ends the run caught', s.screen === 'caught', `screen=${s.screen}`);

    // Retry after being caught.
    await page.keyboard.press('r');
    await sleep(300);
    s = await page.evaluate(() => window.__heist.state());
    check('R restarts the night after being caught', s.screen === 'play', `screen=${s.screen}`);

    check('zero console errors', errors.length === 0, errors.join(' | '));
    check('zero network requests beyond localhost', outside.length === 0, outside.join(', '));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures.length ? `\nPLAYTEST: ${failures.length} FAILURES` : '\nPLAYTEST: ALL PASS');
  process.exit(failures.length ? 1 : 0);
}

if (process.argv.includes('--playtest')) {
  playtest().catch((e) => { console.error(e); process.exit(1); });
} else {
  takeShots().catch((e) => { console.error(e); process.exit(1); });
}
