/**
 * Check that a user's media server URL cannot point the backend at the internal network.
 *
 *     npx ts-node -T scripts/check-media-targets.ts
 *
 * Exercises the REAL `validateMediaServerTarget` with IP literals, so it needs no
 * DNS and opens no connection. Private addresses pass only if MEDIA_PRIVATE_ALLOWLIST
 * lists them; public servers pass on any port (Plex remote access uses custom ones).
 */
import assert from 'node:assert/strict';
import { validateMediaServerTarget } from '../src/common/security/network-target';

const passes = async (url: string, kind: 'PLEX' | 'JELLYFIN' | 'EMBY' = 'PLEX') =>
  validateMediaServerTarget(url, kind).then(() => true, () => false);

async function main() {
  process.env.MEDIA_PRIVATE_ALLOWLIST = '10.20.30.40, 192.168.7.';
  delete process.env.PLEX_ALLOWED_PORTS;
  delete process.env.PLEX_ALLOW_PUBLIC_URLS;

  assert.equal(await passes('http://10.20.30.40:32400'), true, 'listed private IP');
  assert.equal(await passes('http://192.168.7.20:8096', 'JELLYFIN'), true, 'listed private prefix');
  assert.equal(await passes('http://10.20.30.41:8006'), false, 'unlisted private IP (another host on the LAN)');
  assert.equal(await passes('http://172.20.0.2:5432', 'EMBY'), false, 'docker network (postgres)');
  assert.equal(await passes('http://192.168.70.1:80'), false, 'prefix must not match 192.168.70.');
  assert.equal(await passes('http://127.0.0.1:32400'), false, 'loopback');
  assert.equal(await passes('http://169.254.169.254'), false, 'link-local metadata');
  assert.equal(await passes('https://8.8.8.8:23989'), true, 'public server on a custom port');

  delete process.env.MEDIA_PRIVATE_ALLOWLIST;
  assert.equal(await passes('http://10.20.30.40:32400'), false, 'no allowlist, no private targets');

  process.env.PLEX_ALLOW_PUBLIC_URLS = 'false';
  assert.equal(await passes('https://8.8.8.8:32400'), false, 'public URLs switched off');
  delete process.env.PLEX_ALLOW_PUBLIC_URLS;

  process.env.PLEX_ALLOWED_PORTS = '32400';
  assert.equal(await passes('https://8.8.8.8:23989'), false, 'port outside PLEX_ALLOWED_PORTS');
  assert.equal(await passes('https://8.8.8.8:32400'), true, 'port inside PLEX_ALLOWED_PORTS');

  console.log('OK: private media server targets need MEDIA_PRIVATE_ALLOWLIST');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
