/**
 * Regenera los recortes de la guía (public/docs/screenshots).
 *
 *     cd frontend
 *     SEED_ADMIN_PASSWORD='...' npx -p playwright -p sharp node scripts/capturar-guia.js
 *
 * Contra el frontend de desarrollo en :3000 con la base sembrada
 * (backend/prisma/seed.ts). Inglés, tema claro, 2560 de ancho, un recorte por
 * elemento: se localizan por su texto, no por coordenadas, así que sobreviven
 * a un rediseño de la página mientras el elemento siga existiendo. Si uno
 * desaparece, el script falla con el nombre del recorte, que es lo que se
 * quiere: una captura vieja en la guía no avisa sola.
 *
 * Playwright y sharp no son dependencias del proyecto; `npx -p` los trae para
 * esta ejecución. La primera vez hay que bajar el navegador:
 * `npx playwright install chromium`.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const BASE = process.env.GUIA_BASE_URL || 'http://localhost:3000';
const DESTINO = path.join(__dirname, '..', 'public', 'docs', 'screenshots');
const CLAVE = process.env.SEED_ADMIN_PASSWORD;
if (!CLAVE) {
  console.error('Falta SEED_ADMIN_PASSWORD: la contraseña con la que se sembró admin@plexsync.local.');
  process.exit(1);
}

const CAPTURAS = [
  { nombre: 'trackers', ruta: '/connections', el: (p) => p.locator('h2', { hasText: 'Linked anime accounts' }).locator('xpath=following::div[contains(@class,"grid")][1]') },
  { nombre: 'plex-webhook', ruta: '/connections', el: (p) => p.getByText('Your private webhook URL (Plex Webhooks)').locator('xpath=ancestor::div[contains(@class,"rounded-[6px]")][1]') },
  { nombre: 'jellyfin-webhook', ruta: '/connections', el: (p) => p.getByText('Your private webhook URL (Jellyfin Webhooks)').locator('xpath=ancestor::div[contains(@class,"rounded-[6px]")][1]') },
  { nombre: 'emby-card', ruta: '/connections', el: (p) => p.locator('h2', { hasText: 'Emby Media Server' }).locator('xpath=ancestor::*[contains(@class,"glass-card")][1]') },
  { nombre: 'catalog-filters', ruta: '/catalog?tracker=LOCAL', el: (p) => p.locator('xpath=//div[contains(@class,"sm:sticky") and contains(@class,"top-16")]').first() },
  { nombre: 'history-rows', ruta: '/history', el: (p) => p.locator('.glass-card', { hasText: 'Recent activity' }).first(), alto: 620 },
  { nombre: 'mappings-row', ruta: '/mappings', el: (p) => p.locator('.glass-card', { hasText: 'Active series associations' }).first(), alto: 600 },
  { nombre: 'blacklist-form', ruta: '/blacklist', el: (p) => p.getByText('Block Title Manually').locator('xpath=ancestor::*[contains(@class,"glass-card")][1]') },
  { nombre: 'rules-threshold', ruta: '/settings/rules', el: (p) => p.locator('.glass-card', { hasText: 'Minimum watch threshold' }).first() },
  { nombre: 'security-2fa', ruta: '/settings/security', el: (p) => p.getByText('Two-Factor Authentication (2FA)').locator('xpath=ancestor::*[contains(@class,"glass-card")][1]') },
];

(async () => {
  fs.mkdirSync(DESTINO, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1, locale: 'en-US' });
  const page = await ctx.newPage();
  const r = await page.request.post(`${BASE}/api/auth/login`, { data: { email: 'admin@plexsync.local', password: CLAVE } });
  if (r.status() !== 201) throw new Error('login ' + r.status());
  await ctx.addInitScript(() => {
    localStorage.setItem('plexsync_locale', 'en');
    localStorage.setItem('plexsync_theme', 'light');
    localStorage.setItem('plexsync_selected_theme', 'claro');
    localStorage.setItem('plexsync_cookie_consent', JSON.stringify({ necessary: true, preferences: true, timestamp: Date.now() }));
  });

  let rutaActual = '';
  for (const c of CAPTURAS) {
    if (c.ruta !== rutaActual) {
      await page.goto(BASE + c.ruta, { waitUntil: 'networkidle' });
      await page.locator('button[aria-label="Close announcement"]').first().click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(600);
      rutaActual = c.ruta;
    }
    const el = c.el(page).first();
    await el.scrollIntoViewIfNeeded();
    // La captura es de la página entera con scroll en 0: así la cabecera fija
    // se queda arriba y no tapa el recorte. Y el webhook local se enseña con el
    // dominio real, que es lo que ve quien lea la guía.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      for (const n of document.querySelectorAll('input[readonly]')) {
        if (n.value.includes('localhost:3000')) n.value = n.value.replace('http://localhost:3000', 'https://syncsekai.com');
      }
    });
    await page.waitForTimeout(300);
    const caja = await el.boundingBox();
    if (!caja) { console.log('SIN CAJA', c.nombre); continue; }
    // Un recorte largo (listas) se limita en alto: lo que enseña son las primeras filas.
    const clip = { x: caja.x, y: caja.y, width: caja.width, height: c.alto ? Math.min(caja.height, c.alto) : caja.height };
    const png = await page.screenshot({ fullPage: true, clip });
    const salida = path.join(DESTINO, `${c.nombre}.webp`);
    await sharp(png).webp({ quality: 82 }).toFile(salida);
    const kb = Math.round(fs.statSync(salida).size / 1024);
    console.log(`${c.nombre.padEnd(18)} ${Math.round(clip.width)}x${Math.round(clip.height)}  ${kb} KB`);
  }
  await browser.close();
})();
