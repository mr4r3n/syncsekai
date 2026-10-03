import { BadRequestException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

export interface NetworkTargetPolicy {
  allowPrivate: boolean;
  allowPublic: boolean;
  allowedPorts: number[];
  /** Private addresses accepted when allowPrivate is false: exact IPs, or prefixes ending in a dot. */
  privateAllowlist?: string[];
}

export interface ValidatedNetworkTarget {
  url: string;
  addresses: string[];
  httpAgent: HttpAgent;
  httpsAgent: HttpsAgent;
}

export interface IpClassification {
  loopback: boolean;
  linkLocal: boolean;
  unspecified: boolean;
  multicast: boolean;
  privateAddress: boolean;
  reserved: boolean;
}

function parseIpv6Words(addr: string): number[] | null {
  let s = addr.toLowerCase();
  // Handle trailing dotted-decimal notation (e.g. ::ffff:192.0.2.1)
  const lastColon = s.lastIndexOf(':');
  if (lastColon !== -1 && s.slice(lastColon + 1).includes('.')) {
    const v4Part = s.slice(lastColon + 1);
    const v4Octets = v4Part.split('.').map(Number);
    if (v4Octets.length !== 4 || v4Octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    const high = ((v4Octets[0] << 8) | v4Octets[1]).toString(16);
    const low = ((v4Octets[2] << 8) | v4Octets[3]).toString(16);
    s = s.slice(0, lastColon) + ':' + high + ':' + low;
  }

  const doubleColonCount = (s.match(/::/g) || []).length;
  if (doubleColonCount > 1) return null;

  let parts: string[];
  if (doubleColonCount === 1) {
    const [left, right] = s.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    const missing = 8 - (leftParts.length + rightParts.length);
    if (missing < 1) return null;
    parts = [...leftParts, ...Array(missing).fill('0'), ...rightParts];
  } else {
    parts = s.split(':');
  }

  if (parts.length !== 8) return null;
  const words: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null;
    words.push(parseInt(part, 16));
  }
  return words;
}

export function classifyIp(address: string): IpClassification {
  const clean = address.trim().replace(/^\[|\]$/g, '').toLowerCase();

  // 1. Plain IPv4
  const v4Parts = clean.split('.').map(Number);
  let isIpv4 = v4Parts.length === 4 && v4Parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  let octets = isIpv4 ? v4Parts : [];

  // 2. IPv6, detecting IPv4-mapped and IPv4-compatible forms
  let v6Words: number[] | null = null;
  if (!isIpv4) {
    v6Words = parseIpv6Words(clean);
    if (v6Words) {
      // IPv4-mapped (::ffff:x.x.x.x)
      const isIpv4Mapped =
        v6Words[0] === 0 &&
        v6Words[1] === 0 &&
        v6Words[2] === 0 &&
        v6Words[3] === 0 &&
        v6Words[4] === 0 &&
        v6Words[5] === 0xffff;

      // IPv4-compatible (::x.x.x.x, excluding ::1)
      const isIpv4Compat =
        v6Words[0] === 0 &&
        v6Words[1] === 0 &&
        v6Words[2] === 0 &&
        v6Words[3] === 0 &&
        v6Words[4] === 0 &&
        v6Words[5] === 0 &&
        !(v6Words[6] === 0 && v6Words[7] === 1);

      if (isIpv4Mapped || isIpv4Compat) {
        isIpv4 = true;
        octets = [
          (v6Words[6] >> 8) & 0xff,
          v6Words[6] & 0xff,
          (v6Words[7] >> 8) & 0xff,
          v6Words[7] & 0xff,
        ];
      }
    }
  }

  if (isIpv4) {
    const loopback = octets[0] === 127;
    const linkLocal = octets[0] === 169 && octets[1] === 254;
    const unspecified = octets.every((o) => o === 0);
    const multicast = octets[0] >= 224 && octets[0] <= 239;
    const privateAddress =
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
    const reserved =
      octets[0] === 0 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 192 && octets[1] === 0 && (octets[2] === 0 || octets[2] === 2)) ||
      (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19 || (octets[1] === 51 && octets[2] === 100))) ||
      (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) ||
      octets[0] >= 240;

    return { loopback, linkLocal, unspecified, multicast, privateAddress, reserved };
  }

  // Pure IPv6 classification
  if (v6Words) {
    const unspecified = v6Words.every((w) => w === 0);
    const loopback =
      v6Words[0] === 0 &&
      v6Words[1] === 0 &&
      v6Words[2] === 0 &&
      v6Words[3] === 0 &&
      v6Words[4] === 0 &&
      v6Words[5] === 0 &&
      v6Words[6] === 0 &&
      v6Words[7] === 1; // ::1
    const linkLocal = (v6Words[0] & 0xffc0) === 0xfe80; // fe80::/10
    const multicast = (v6Words[0] & 0xff00) === 0xff00; // ff00::/8
    const privateAddress = (v6Words[0] & 0xfe00) === 0xfc00; // fc00::/7 (ULA)
    const reserved = v6Words[0] === 0x2001 && v6Words[1] === 0x0db8; // 2001:db8::/32
    return { loopback, linkLocal, unspecified, multicast, privateAddress, reserved };
  }

  return {
    loopback: false,
    linkLocal: false,
    unspecified: false,
    multicast: false,
    privateAddress: false,
    reserved: true,
  };
}

export async function validateNetworkHost(
  hostname: string,
  policy: Pick<NetworkTargetPolicy, 'allowPrivate' | 'allowPublic' | 'privateAllowlist'>,
): Promise<string[]> {
  const cleanHost = hostname.trim().replace(/^\[|\]$/g, '');
  if (!cleanHost || cleanHost.toLowerCase() === 'localhost') {
    throw new BadRequestException('The network target is not allowed.');
  }

  const records = isIP(cleanHost)
    ? [{ address: cleanHost }]
    : await lookup(cleanHost, { all: true, verbatim: true });
  if (!records.length) throw new BadRequestException('The host could not be resolved.');

  const addresses = records.map((record) => record.address);
  for (const address of addresses) {
    const type = classifyIp(address);
    if (type.loopback || type.linkLocal || type.unspecified || type.multicast || type.reserved) {
      throw new BadRequestException('The target resolves to a reserved network that is not allowed.');
    }
    if (type.privateAddress && !policy.allowPrivate && !inPrivateAllowlist(address, policy.privateAllowlist)) {
      throw new BadRequestException('Private network targets are not allowed.');
    }
    if (!type.privateAddress && !policy.allowPublic) {
      throw new BadRequestException('Public targets are not allowed in this operation.');
    }
  }
  return addresses;
}

function inPrivateAllowlist(address: string, allowlist: string[] = []): boolean {
  const ip = address.replace(/^::ffff:/i, '');
  return allowlist.some((entry) => (entry.endsWith('.') ? ip.startsWith(entry) : ip === entry));
}

/**
 * Media server URLs come from any registered user, so the backend must not follow
 * them into the internal network. Public servers are accepted on any port (Plex
 * remote access uses custom ones); private addresses only if MEDIA_PRIVATE_ALLOWLIST
 * lists them (the operator's own servers). {KIND}_ALLOWED_PORTS and
 * {KIND}_ALLOW_PUBLIC_URLS=false narrow it further.
 */
export function validateMediaServerTarget(
  serverUrl: string,
  kind: 'PLEX' | 'JELLYFIN' | 'EMBY',
): Promise<ValidatedNetworkTarget> {
  const list = (value?: string) => (value || '').split(',').map((v) => v.trim()).filter(Boolean);
  const ports = list(process.env[`${kind}_ALLOWED_PORTS`])
    .map(Number)
    .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
  return validateOutboundTarget(serverUrl, {
    allowPrivate: false,
    privateAllowlist: list(process.env.MEDIA_PRIVATE_ALLOWLIST),
    allowPublic: process.env[`${kind}_ALLOW_PUBLIC_URLS`] !== 'false',
    allowedPorts: ports.length > 0 ? [...new Set(ports)] : Array.from({ length: 65535 }, (_, i) => i + 1),
  });
}

export async function validateOutboundUrl(
  rawUrl: string,
  policy: NetworkTargetPolicy,
): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('The URL is not valid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new BadRequestException('Only HTTP(S) URLs without credentials are allowed.');
  }
  if (parsed.search || parsed.hash) {
    throw new BadRequestException('The base URL cannot contain a query or fragment.');
  }
  const port = Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80));
  if (!policy.allowedPorts.includes(port)) {
    throw new BadRequestException('The target port is not allowed.');
  }
  await validateNetworkHost(parsed.hostname, policy);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/$/, '');
}

export async function validateOutboundTarget(
  rawUrl: string,
  policy: NetworkTargetPolicy,
): Promise<ValidatedNetworkTarget> {
  const url = await validateOutboundUrl(rawUrl, policy);
  const parsed = new URL(url);
  const addresses = await validateNetworkHost(parsed.hostname, policy);
  let nextAddress = 0;
  const pinnedLookup = (_hostname: string, options: any, callback: any) => {
    if (options?.all) {
      callback(null, addresses.map((address) => ({ address, family: isIP(address) })));
      return;
    }
    const address = addresses[nextAddress++ % addresses.length];
    callback(null, address, isIP(address));
  };

  // A Plex server on the LAN uses a self-signed certificate, so it cannot be
  // verified there. A public target must be verified: without this, any intermediary
  // on the route could read or tamper with the Plex token sent in the request.
  const onlyPrivateTargets = addresses.every((address) => classifyIp(address).privateAddress);

  return {
    url,
    addresses,
    httpAgent: new HttpAgent({ lookup: pinnedLookup }),
    httpsAgent: new HttpsAgent({ lookup: pinnedLookup, rejectUnauthorized: !onlyPrivateTargets }),
  };
}
