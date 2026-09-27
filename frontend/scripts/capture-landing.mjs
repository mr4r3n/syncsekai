/**
 * Screenshots for the landing page gallery and the README, taken from /demo.
 *
 *     node scripts/capture-landing.mjs [http://localhost:3000]
 *
 * The demo only holds sample data (lib/demo-data.json), so nothing needs masking
 * and no account is needed. Chrome is driven through its DevTools protocol with
 * Node's own fetch and WebSocket: no Playwright to install. CHROME overrides the
 * browser path. Output: public/landing/<screen>-<theme>-<locale>.webp (the gallery shows
 * the one matching the site's theme and language).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'landing');
const CHROME = process.env.CHROME
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    .find((p) => fs.existsSync(p));
if (!CHROME) throw new Error('Chrome not found: set CHROME to its path.');

const WIDTH = 2000, HEIGHT = 1150;
const SHOTS = [
  { name: 'connections', route: '/connections' },
  { name: 'catalog', route: '/catalog' },
  { name: 'detail', route: '/catalog', open: 'Sousou no Frieren' },
  { name: 'history', route: '/history' },
  { name: 'mappings', route: '/mappings' },
];

const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'syncsekai-capture-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--lang=en-US', `--window-size=${WIDTH},${HEIGHT}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null);
    if (!target) await sleep(200);
  }
  if (!target) throw new Error('Chrome did not start.');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (!pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = (fn, arg) => send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true });

  await send('Page.enable');
  // Announcements come from the live server and would date the screenshots.
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*/api/announcements/active*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  fs.mkdirSync(OUT, { recursive: true });

  for (const locale of ['en', 'es']) for (const theme of ['dark', 'light']) {
    // Before any script of the page: demo on, English, the theme, cookies answered.
    const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', { source: `try {
      sessionStorage.setItem('syncsekai_demo', '1');
      localStorage.setItem('plexsync_locale', '${locale}');
      localStorage.setItem('plexsync_theme', '${theme}');
      localStorage.setItem('plexsync_selected_theme', '${theme === 'light' ? 'claro' : 'oscuro'}');
      localStorage.setItem('plexsync_cookie_consent', JSON.stringify({ necessary: true, preferences: true, timestamp: Date.now() }));
    } catch {}` });

    for (const shot of SHOTS) {
      await send('Page.navigate', { url: BASE + shot.route });
      await sleep(4000);
      if (shot.open) {
        // The click handler is on the card, not on its title.
        await run((title) => [...document.querySelectorAll('h3')].find((h) => h.textContent.trim() === title)?.closest('div.group.relative')?.click(), shot.open);
        await sleep(3000);
      }
      // The pill is for visitors; a screenshot of the panel does not need it.
      await run(() => document.querySelector('[data-demo-bar]')?.remove());
      await run(() => window.scrollTo(0, 0));
      await sleep(600);

      const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } });
      const file = path.join(OUT, `${shot.name}-${theme}-${locale}.webp`);
      await sharp(Buffer.from(data, 'base64')).resize(1400).webp({ quality: 80 }).toFile(file);
      console.log(`${shot.name}-${theme}-${locale}`.padEnd(24), Math.round(fs.statSync(file).size / 1024) + ' KB');
    }
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(500);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
