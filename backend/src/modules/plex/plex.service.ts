import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { validateMediaServerTarget, type ValidatedNetworkTarget } from '../../common/security/network-target';

export interface PlexPinResponse {
  id: number;
  code: string;
  authUrl: string;
  expiresIn: number;
}

export interface PlexLibraryItem {
  id: string;
  key: string;
  title: string;
  type: string; // 'show' | 'movie' | 'artist' | 'photo'
  path?: string;
  agent?: string;
  scanner?: string;
  language?: string;
  monitored: boolean;
}

export interface PlexServerResource {
  name: string;
  clientIdentifier: string;
  accessToken: string;
  owned: boolean;
  connections: Array<{
    protocol: string;
    address: string;
    port: number;
    uri: string;
    local: boolean;
    relay: boolean;
    IPv6: boolean;
  }>;
}

/** Certificate hash in a plex.direct host name: the same server, whatever its IP. */
export function plexDirectHash(url: string): string | null {
  try {
    return /\.([a-f0-9]{32})\.plex\.direct$/i.exec(new URL(url).hostname)?.[1].toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Plex connection: PIN, manual token, servers and libraries. */
@Injectable()
export class PlexService {
  private readonly logger = new Logger(PlexService.name);

  private readonly clientIdentifier: string;
  /**
   * Real library list (categories) of the user's Plex server.
   */
  /**
   * Real libraries with a short cache, for consumers that call it often.
   *
   * The connections hub requests it on every panel load (the sidebar included),
   * and querying the PMS every time would add up to 3 seconds per page. The
   * "Refresh" button still uses getLibraries(), which queries live and updates
   * this cache, so the user always has a way to force fresh data.
   *
   * In-process memory cache. It is lost on restart and not shared between
   * replicas; if the backend is scaled, this moves to Redis.
   */
  private static readonly LIBRARIES_CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly librariesCache = new Map<string, { libs: PlexLibraryItem[]; ts: number }>();

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {
    this.clientIdentifier = this.configService.get<string>('PLEX_CLIENT_IDENTIFIER') || 'SyncSekai-App-2026-v1';
  }

  private getPlexHeaders(token?: string, clientId?: string) {
    const headers: Record<string, string> = {
      'X-Plex-Product': 'SyncSekai',
      'X-Plex-Version': '1.0.0',
      'X-Plex-Client-Identifier': clientId || this.clientIdentifier,
      'X-Plex-Platform': 'Web',
      'X-Plex-Device': 'Browser',
      'X-Plex-Device-Name': 'SyncSekai Web App',
      Accept: 'application/json',
    };
    if (token) {
      headers['X-Plex-Token'] = token;
    }
    return headers;
  }

  validateUserServerTarget(serverUrl: string): Promise<ValidatedNetworkTarget> {
    return validateMediaServerTarget(serverUrl, 'PLEX');
  }

  async validateUserServerUrl(serverUrl: string): Promise<string> {
    return (await this.validateUserServerTarget(serverUrl)).url;
  }

  /**
   * Requests an official PIN from Plex.tv for passwordless OAuth sign-in.
   */
  async requestPin(): Promise<PlexPinResponse> {
    try {
      const response = await axios.post(
        'https://plex.tv/api/v2/pins',
        { strong: true },
        {
          headers: this.getPlexHeaders(),
          timeout: 7000,
        },
      );

      const { id, code, expires_in } = response.data;
      const authUrl = `https://app.plex.tv/auth#?clientID=${encodeURIComponent(
        this.clientIdentifier,
      )}&code=${encodeURIComponent(code)}&context%5Bdevice%5D%5Bproduct%5D=SyncSekai`;

      return {
        id,
        code,
        authUrl,
        expiresIn: expires_in || 900,
      };
    } catch (error: any) {
      this.logger.error('Error requesting a PIN from Plex.tv', error.message);
      throw new BadRequestException('Could not reach Plex.tv to generate the authorization PIN.');
    }
  }

  /**
   * Checks whether the user already approved the PIN on Plex.tv and discovers their servers.
   */
  async verifyPin(
    userId: string,
    pinId: number,
    clientIdentifier?: string,
  ): Promise<{
    verified: boolean;
    serverName?: string;
    serverUrl?: string;
    plexUsername?: string;
    libraries?: PlexLibraryItem[];
    serversCount?: number;
  }> {
    try {
      const response = await axios.get(`https://plex.tv/api/v2/pins/${pinId}`, {
        headers: this.getPlexHeaders(undefined, clientIdentifier),
        timeout: 5000,
      });

      const authToken = response.data?.authToken;
      if (!authToken) {
        return { verified: false };
      }

      // Get the user's profile from Plex.tv
      let plexUsername = 'PlexUser';
      try {
        const userRes = await axios.get('https://plex.tv/api/v2/user', {
          headers: this.getPlexHeaders(authToken, clientIdentifier),
          timeout: 5000,
        });
        plexUsername = userRes.data?.username || userRes.data?.email || plexUsername;
      } catch (e: any) {
        this.logger.warn(`Could not get the Plex username: ${e.message}`);
      }

      // Discover real servers and libraries
      const discovery = await this.discoverAndQueryPrimaryServer(authToken);

      const encryptedAuthToken = this.encryptionService.encrypt(authToken);
      const serverName = discovery.serverName || `${plexUsername}'s Media Server`;
      const serverUrl = discovery.serverUrl || 'http://localhost:32400';
      const discoveredLibraries = discovery.libraries || [];

      // Preselect libraries related to anime or series
      let initialMonitored: string[] = [];
      if (discoveredLibraries.length > 0) {
        const animeLibs = discoveredLibraries.filter((lib) =>
          lib.title.toLowerCase().includes('anime') || lib.title.toLowerCase().includes('animaci'),
        );
        if (animeLibs.length > 0) {
          initialMonitored = animeLibs.map((l) => l.title);
        } else {
          initialMonitored = discoveredLibraries
            .filter((lib) => lib.type === 'show' || lib.type === 'movie')
            .map((l) => l.title);
        }
      }

      await this.prisma.plexConnection.upsert({
        where: { userId },
        update: {
          encryptedAuthToken,
          plexUsername,
          serverName,
          serverUrl,
          monitoredLibraries: initialMonitored,
          isConnected: true,
          lastSyncAt: new Date(),
        },
        create: {
          userId,
          encryptedAuthToken,
          plexUsername,
          serverName,
          serverUrl,
          monitoredLibraries: initialMonitored,
          isConnected: true,
          lastSyncAt: new Date(),
        },
      });

      const librariesWithStatus = discoveredLibraries.map((lib) => ({
        ...lib,
        monitored: initialMonitored.includes(lib.title) || initialMonitored.includes(lib.id),
      }));

      return {
        verified: true,
        serverName,
        serverUrl,
        plexUsername,
        libraries: librariesWithStatus,
        serversCount: discovery.totalServers,
      };
    } catch (error: any) {
      this.logger.warn(`Plex PIN ${pinId} verification failed or pending: ${error.message}`);
      return { verified: false };
    }
  }

  /**
   * Where, and with which token, a user's Plex server answers today. Everything that
   * talks to a user's server goes through here.
   *
   * The stored token of a PIN link is the account token: it opens the user's whole
   * Plex account, so it never goes to a server, which may be someone else's machine
   * shared with them. plex.tv gives the server's own access token instead, and its
   * current addresses (the stored plex.direct address has the server's IP inside, and
   * home IPs change). The server is the one whose plex.direct name carries the same
   * certificate hash. Only https addresses (the token travels in a header), direct
   * ones before the relay (which works with no open ports, only slower).
   *
   * - `{ url, token }`: use these.
   * - `'stored-token'`: the stored token is not an account token (plex.tv refuses it, or
   *   the URL was typed in by hand): it was given for that server, use it there.
   * - `null`: nothing safe to use now (plex.tv down, server gone or offline).
   */
  async findServerAccess(
    serverUrl: string,
    encryptedToken: string,
  ): Promise<{ url: string; token: string } | 'stored-token' | null> {
    const hash = plexDirectHash(serverUrl);
    if (!hash) return 'stored-token';
    const resources = await this.loadResources(this.encryptionService.decrypt(encryptedToken));
    if (resources === 'refused') return 'stored-token';
    if (resources === 'unavailable') return null;
    const server = resources.find((s) => s.connections.some((c) => plexDirectHash(c.uri) === hash));
    if (!server?.accessToken) return null;
    const candidates = server.connections
      .filter((c) => c.uri?.startsWith('https://'))
      .sort((a, b) => Number(a.relay) - Number(b.relay));
    for (const c of candidates) {
      // A relay that has not been used for a while takes several seconds to open its
      // tunnel (measured: 3 s timed out, then 0.3 s per request once open).
      const libraries = await this.fetchLibrariesFromPMS(c.uri, server.accessToken, c.relay ? 10_000 : 3000);
      if (libraries.length > 0) return { url: c.uri, token: server.accessToken };
    }
    return null;
  }

  /**
   * Lists the servers available on the user's Plex account ([] if plex.tv does not answer).
   */
  async getResources(token: string): Promise<PlexServerResource[]> {
    const resources = await this.loadResources(token);
    return Array.isArray(resources) ? resources : [];
  }

  /** The servers, or why there are none: plex.tv refuses the token, or does not answer. */
  private async loadResources(token: string): Promise<PlexServerResource[] | 'refused' | 'unavailable'> {
    try {
      const res = await axios.get(
        'https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1',
        {
          headers: this.getPlexHeaders(token),
          timeout: 6000,
        },
      );

      const resources = Array.isArray(res.data) ? res.data : [];
      const servers: PlexServerResource[] = [];

      for (const r of resources) {
        const provides = String(r.provides || '');
        if (provides.includes('server')) {
          servers.push({
            name: r.name || 'Plex Media Server',
            clientIdentifier: r.clientIdentifier,
            // A shared server only ever gets its own token, never the account token.
            accessToken: r.accessToken || (r.owned ? token : ''),
            owned: !!r.owned,
            connections: Array.isArray(r.connections)
              ? r.connections.map((c: any) => ({
                  protocol: c.protocol,
                  address: c.address,
                  port: Number(c.port),
                  uri: c.uri,
                  local: Boolean(c.local),
                  relay: Boolean(c.relay),
                  IPv6: Boolean(c.IPv6),
                }))
              : [],
          });
        }
      }

      return servers;
    } catch (e: any) {
      if (e.response?.status === 401) return 'refused';
      this.logger.warn(`Error querying resources on Plex.tv: ${e.message}`);
      return 'unavailable';
    }
  }

  /**
   * Reads the real sections directly from a Plex Media Server (/library/sections).
   */
  async fetchLibrariesFromPMS(serverUrl: string, token: string, timeoutMs = 3000): Promise<PlexLibraryItem[]> {
    if (!serverUrl || !token) return [];

    let endpoint = serverUrl;

    try {
      const target = await this.validateUserServerTarget(serverUrl);
      endpoint = `${target.url}/library/sections`;
      const response = await axios.get(endpoint, {
        headers: this.getPlexHeaders(token),
        timeout: timeoutMs,
        maxRedirects: 2,
        maxContentLength: 2 * 1024 * 1024,
        httpAgent: target.httpAgent,
        httpsAgent: target.httpsAgent,
      });

      const container = response.data?.MediaContainer;
      if (!container) return [];

      let directory = container.Directory || [];
      if (!Array.isArray(directory)) {
        directory = [directory];
      }

      return directory.map((dir: any) => {
        let path = '';
        if (Array.isArray(dir.Location) && dir.Location.length > 0) {
          path = dir.Location[0]?.path || '';
        } else if (dir.Location?.path) {
          path = dir.Location.path;
        }

        return {
          id: String(dir.key || dir.id),
          key: String(dir.key || dir.id),
          title: dir.title || 'Untitled',
          type: dir.type || 'show',
          path,
          agent: dir.agent,
          scanner: dir.scanner,
          language: dir.language,
          monitored: false,
        };
      });
    } catch (error: any) {
      this.logger.warn(`Could not query ${endpoint}: ${error.message}`);
      return [];
    }
  }

  /**
   * Discovers servers and reads the sections of the first reachable primary server.
   */
  private async discoverAndQueryPrimaryServer(
    token: string,
  ): Promise<{
    serverName?: string;
    serverUrl?: string;
    libraries: PlexLibraryItem[];
    totalServers: number;
  }> {
    const servers = await this.getResources(token);
    if (servers.length === 0) {
      return {
        libraries: [],
        totalServers: 0,
      };
    }

    // Strict isolation: if the user has their own servers, NEVER assign a shared one
    const ownedServers = servers.filter((s) => s.owned);
    const candidateServers = ownedServers.length > 0 ? ownedServers : servers;

    for (const server of candidateServers) {
      const serverToken = server.accessToken;
      if (!serverToken) continue;
      // Try connections in order (prefer direct https and local)
      const sortedConns = [...(server.connections || [])].sort((a, b) => {
        if (a.protocol === 'https' && b.protocol !== 'https') return -1;
        if (a.protocol !== 'https' && b.protocol === 'https') return 1;
        if (a.local && !b.local) return -1;
        if (!a.local && b.local) return 1;
        if (!a.relay && b.relay) return -1;
        return 0;
      });

      const testUris = Array.from(new Set(sortedConns.map((c) => c.uri).filter(Boolean)));

      if (testUris.length > 0) {
        // Try all connections in parallel for a fast response (<2s)
        const results = await Promise.allSettled(
          testUris.map(async (uri) => {
            const libs = await this.fetchLibrariesFromPMS(uri, serverToken);
            return { uri, libs };
          }),
        );

        for (const res of results) {
          if (res.status === 'fulfilled' && res.value.libs && res.value.libs.length > 0) {
            return {
              serverName: server.name,
              serverUrl: res.value.uri,
              libraries: res.value.libs,
              totalServers: servers.length,
            };
          }
        }
      }
    }

    // If the user's own server did not answer the backend's HTTP requests directly,
    // it is still assigned with its first URL, so the user is not linked to
    // someone else's libraries or to the administrator's server.
    const defaultServer = candidateServers[0];
    const defaultUri = defaultServer?.connections?.[0]?.uri || 'http://localhost:32400';

    return {
      serverName: defaultServer?.name || 'Plex Media Server',
      serverUrl: defaultUri,
      libraries: [],
      totalServers: servers.length,
    };
  }

  /**
   * Connects Plex with a manual token and a custom URL.
   */
  async connectManualToken(userId: string, token: string, serverUrl?: string, serverName?: string) {
    if (!token || token.length > 512) throw new BadRequestException('Invalid Plex token.');
    if (!serverUrl) throw new BadRequestException('The Plex server URL is required.');

    let plexUsername = 'PlexUser';
    try {
      const userRes = await axios.get('https://plex.tv/api/v2/user', {
        headers: this.getPlexHeaders(token),
        timeout: 4000,
      });
      plexUsername = userRes.data?.username || userRes.data?.email || plexUsername;
    } catch {
      this.logger.warn('Plex.tv validation skipped for a direct token.');
    }

    const cleanUrl = await this.validateUserServerUrl(serverUrl);
    const realLibraries = await this.fetchLibrariesFromPMS(cleanUrl, token);

    let initialMonitored: string[] = [];
    if (realLibraries.length > 0) {
      const animeLibs = realLibraries.filter((lib) =>
        lib.title.toLowerCase().includes('anime') || lib.title.toLowerCase().includes('animaci'),
      );
      initialMonitored = animeLibs.length > 0 ? animeLibs.map((l) => l.title) : realLibraries.map((l) => l.title);
    }

    const encryptedAuthToken = this.encryptionService.encrypt(token);
    const finalServerName = serverName || `${plexUsername}'s Media Server`;

    const conn = await this.prisma.plexConnection.upsert({
      where: { userId },
      update: {
        encryptedAuthToken,
        plexUsername,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
      create: {
        userId,
        encryptedAuthToken,
        plexUsername,
        serverName: finalServerName,
        serverUrl: cleanUrl,
        monitoredLibraries: initialMonitored,
        isConnected: true,
        lastSyncAt: new Date(),
      },
    });

    return {
      ...conn,
      availableLibraries: realLibraries.map((lib) => ({
        ...lib,
        monitored: initialMonitored.includes(lib.title) || initialMonitored.includes(lib.id),
      })),
    };
  }

  async getLibrariesCached(userId: string): Promise<PlexLibraryItem[]> {
    const cached = this.librariesCache.get(userId);
    if (cached && Date.now() - cached.ts < PlexService.LIBRARIES_CACHE_TTL_MS) {
      return cached.libs;
    }
    try {
      return await this.getLibraries(userId);
    } catch (err: any) {
      this.logger.warn(`Could not get the Plex libraries for ${userId}: ${err.message}`);
      // Never make data up: if Plex does not answer, the list is empty and the
      // interface offers the refresh button.
      return [];
    }
  }

  async getLibraries(userId: string): Promise<PlexLibraryItem[]> {
    const conn = await this.prisma.plexConnection.findUnique({ where: { userId } });
    if (!conn || !conn.isConnected || !conn.encryptedAuthToken) {
      return [];
    }

    const token = this.encryptionService.decrypt(conn.encryptedAuthToken);
    let libraries: PlexLibraryItem[] = [];

    // The same server first, at its current address with the token it takes (see
    // findServerAccess); only then whatever server the account has.
    if (conn.serverUrl) {
      const access = await this.findServerAccess(conn.serverUrl, conn.encryptedAuthToken).catch(() => null);
      if (access === 'stored-token') {
        libraries = await this.fetchLibrariesFromPMS(conn.serverUrl, token);
      } else if (access) {
        libraries = await this.fetchLibrariesFromPMS(access.url, access.token);
        if (access.url !== conn.serverUrl) {
          await this.prisma.plexConnection.update({ where: { userId }, data: { serverUrl: access.url } });
        }
      }
    }

    if (libraries.length === 0) {
      const discovery = await this.discoverAndQueryPrimaryServer(token);
      if (discovery.libraries.length > 0) {
        libraries = discovery.libraries;
        if (discovery.serverUrl && discovery.serverUrl !== conn.serverUrl) {
          await this.prisma.plexConnection.update({
            where: { userId },
            data: { serverUrl: discovery.serverUrl, serverName: discovery.serverName || conn.serverName },
          });
        }
      }
    }

    const monitored = conn.monitoredLibraries || [];
    const result = libraries.map((lib) => ({
      ...lib,
      monitored: monitored.includes(lib.title) || monitored.includes(lib.id) || monitored.includes(lib.key),
    }));

    // Refresh the cache the hub reads, so pressing "Refresh" also updates
    // what is shown after reloading the page.
    this.librariesCache.set(userId, { libs: result, ts: Date.now() });
    return result;
  }

  /**
   * Updates the selection of monitored libraries.
   */
  async updateMonitoredLibraries(userId: string, monitoredLibraries: string[]) {
    return this.prisma.plexConnection.update({
      where: { userId },
      data: {
        monitoredLibraries,
        lastSyncAt: new Date(),
      },
    });
  }

  /**
   * Tests the connection and reads the sections of a specific PMS.
   */
  async testConnection(serverUrl: string, token: string) {
    if (!serverUrl || !token || token.length > 512) {
      throw new BadRequestException('The server URL and authentication token are required.');
    }
    const cleanUrl = await this.validateUserServerUrl(serverUrl);
    const libraries = await this.fetchLibrariesFromPMS(cleanUrl, token);
    return {
      success: libraries.length > 0,
      url: cleanUrl,
      librariesCount: libraries.length,
      libraries,
    };
  }

  /**
   * Lists the servers available on the account.
   */
  async getUserServers(userId: string) {
    const conn = await this.prisma.plexConnection.findUnique({ where: { userId } });
    if (!conn || !conn.encryptedAuthToken) {
      return [];
    }
    const token = this.encryptionService.decrypt(conn.encryptedAuthToken);
    return this.getResources(token);
  }

  /**
   * Changes the active server.
   */
  async selectServer(userId: string, serverName: string, serverUrl: string) {
    const conn = await this.prisma.plexConnection.findUnique({ where: { userId } });
    if (!conn || !conn.encryptedAuthToken) {
      throw new NotFoundException('Plex connection not found.');
    }

    const cleanUrl = await this.validateUserServerUrl(serverUrl);
    const access = await this.findServerAccess(cleanUrl, conn.encryptedAuthToken).catch(() => null);
    const libraries =
      access === 'stored-token'
        ? await this.fetchLibrariesFromPMS(cleanUrl, this.encryptionService.decrypt(conn.encryptedAuthToken))
        : access
          ? await this.fetchLibrariesFromPMS(cleanUrl, access.token)
          : [];

    await this.prisma.plexConnection.update({
      where: { userId },
      data: {
        serverName,
        serverUrl: cleanUrl,
        lastSyncAt: new Date(),
      },
    });

    return {
      serverName,
      serverUrl: cleanUrl,
      libraries,
    };
  }

  /**
   * Disconnects Plex.
   */
  async disconnect(userId: string) {
    return this.prisma.plexConnection.update({
      where: { userId },
      data: {
        isConnected: false,
        encryptedAuthToken: null,
        serverName: null,
        serverUrl: null,
        plexUsername: null,
        monitoredLibraries: [],
        lastSyncAt: null,
      },
    });
  }
}
