export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    // In local dev with localhost or IP, use port 4000
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const protocol = window.location.protocol || 'http:';
      return `${protocol}//${hostname}:4000`;
    }
    // In production domain behind reverse proxy (Nginx / Cloudflare), use same origin (relative path)
    return '';
  }
  return 'http://127.0.0.1:4000';
}

export function clearAuthToken() {}

/** Red del catalogo: de aqui salen el nombre y el icono, sin subir nada. */
export interface RedSocial {
  id: string;
  label: string;
  icon: string;
  /** Variante blanca, solo en las marcas monocromas que se pierden en oscuro. */
  iconDark?: string;
  ejemplo: string;
}

/** Enlace externo del pie: red social o sitio recomendado. */
export interface SiteSettings {
  siteName: string;
  siteTitle: string;
  siteDescription: string;
  contactEmail: string;
  registrationOpen: boolean;
}

export interface SiteLink {
  id: string;
  kind: 'SOCIAL' | 'FRIEND';
  /** Id de la red del catalogo. Solo lo llevan los SOCIAL. */
  provider?: string | null;
  label: string;
  url: string;
  description?: string | null;
  iconUrl?: string | null;
  /** Variante para tema oscuro, resuelta en el servidor desde el catalogo. */
  iconDarkUrl?: string | null;
  // Sólo llegan al panel: la lectura pública no devuelve los desactivados.
  isEnabled?: boolean;
  sortOrder?: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const apiBase = getApiBase();

  try {
    const res = await fetch(`${apiBase}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      let message = `Error HTTP ${res.status}`;
      try {
        const errorData = await res.json();
        if (Array.isArray(errorData.message)) {
          message = errorData.message.join(' | ');
        } else if (errorData.message) {
          message = errorData.message;
        } else if (errorData.error) {
          message = `${errorData.error} (HTTP ${res.status})`;
        }
      } catch {
        const text = await res.text().catch(() => '');
        if (text) {
          message = text.length > 150 ? text.slice(0, 150) + '...' : text;
        }
      }
      throw new Error(message);
    }

    const text = await res.text();
    if (!text || !text.trim()) {
      return null as unknown as T;
    }
    return JSON.parse(text);
  } catch (err: any) {
    if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message?.includes('fetch'))) {
      throw new Error(
        `No se pudo conectar con el backend (${apiBase || 'API'}). Comprueba que el servicio esté iniciado en el puerto 4000.`
      );
    }
    throw err;
  }
}

export const api = {
  auth: {
    checkDomain: (email: string) =>
      request<{ isAllowed: boolean; message: string; status: string }>(
        `/api/auth/check-domain?email=${encodeURIComponent(email)}`,
      ),
    register: (data: any) => request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    activateAccount: (token: string) => request<any>(`/api/auth/activate/${token}`),
    confirmEmailChange: (token: string) => request<any>(`/api/auth/confirm-email/${token}`),
    login: (data: any) => request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    forgotPassword: (data: { email: string }) =>
      request<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
    resetPassword: (data: { token: string; newPassword: string }) =>
      request<{ message: string }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
    logout: () =>
      request<any>('/api/auth/logout', { method: 'POST' })
        .catch(() => {})
        .finally(() => clearAuthToken()),
    me: () => request<any>('/api/auth/me'),
    updateProfile: (data: { username?: string; email?: string; currentPassword?: string }) =>
      request<any>('/api/auth/profile', { method: 'POST', body: JSON.stringify(data) }),
    uploadAvatar: (formData: FormData) =>
      request<{ avatarUrl: string; message: string }>('/api/auth/avatar', {
        method: 'POST',
        body: formData,
      }),
    presetAvatars: () => request<{ avatars: string[] }>('/api/auth/preset-avatars'),
    setPresetAvatar: (avatar: string) =>
      request<{ avatarUrl: string; message: string }>('/api/auth/avatar/preset', {
        method: 'POST',
        body: JSON.stringify({ avatar }),
      }),
    updatePassword: (data: { currentPassword?: string; newPassword?: string; twoFactorCode?: string }) =>
      request<any>('/api/auth/password', { method: 'POST', body: JSON.stringify(data) }),
    updateSettings: (data: any) =>
      request<any>('/api/auth/settings', { method: 'POST', body: JSON.stringify(data) }),
    generateTotp: () =>
      request<{ secret: string; qrCodeDataUrl: string; otpauth: string }>('/api/auth/2fa/generate-totp', { method: 'POST' }),
    enableTotp: (data: { token: string }) =>
      request<any>('/api/auth/2fa/enable-totp', { method: 'POST', body: JSON.stringify(data) }),
    requestEmailOtp: () =>
      request<{ message: string; previewCode?: string }>('/api/auth/2fa/request-email-otp', { method: 'POST' }),
    enableEmailOtp: (data: { code: string }) =>
      request<any>('/api/auth/2fa/enable-email', { method: 'POST', body: JSON.stringify(data) }),
    disable2Fa: (data: { password?: string; verificationCode?: string }) =>
      request<any>('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify(data) }),
    startGoogleLink: () =>
      request<{ url: string }>('/api/auth/social/link-google/start', { method: 'POST' }),
    unlinkGoogle: () =>
      request<any>('/api/auth/social/unlink-google', { method: 'POST' }),
    startDiscordLink: () =>
      request<{ url: string }>('/api/auth/social/link-discord/start', { method: 'POST' }),
    unlinkDiscord: () =>
      request<any>('/api/auth/social/unlink-discord', { method: 'POST' }),
    getSessions: () =>
      request<any[]>('/api/auth/sessions'),
    revokeSession: (id: string) =>
      request<{ message: string }>(`/api/auth/sessions/${id}`, { method: 'DELETE' }),
    revokeOtherSessions: () =>
      request<{ message: string }>('/api/auth/sessions/revoke-others', { method: 'POST' }),
    regenerateWebhookToken: () =>
      request<{ message: string; webhookToken: string }>('/api/auth/regenerate-webhook-token', { method: 'POST' }),
    generateBackupCodes: () =>
      request<{ codes: string[]; challengeIndex: number; challengeNumber: number; totalCodes: number }>(
        '/api/auth/backup-codes/generate',
        { method: 'POST' },
      ),
    verifyAndSaveBackupCodes: (data: { codes: string[]; challengeIndex: number; confirmedCode: string }) =>
      request<{ success: boolean; message: string; remainingCount: number; generatedAt: string }>(
        '/api/auth/backup-codes/verify-and-save',
        { method: 'POST', body: JSON.stringify(data) },
      ),
    getBackupCodesStatus: () =>
      request<{ hasBackupCodes: boolean; remainingCount: number; generatedAt: string | null }>(
        '/api/auth/backup-codes/status',
      ),
    recoverWithBackupCode: (data: { identifier: string; backupCode: string; newPassword: string }) =>
      request<{ success: boolean; message: string; remainingCodes: number }>(
        '/api/auth/recover-with-backup-code',
        { method: 'POST', body: JSON.stringify(data) },
      ),
    requestAccountDeletion: (data: { password?: string; twoFactorCode?: string }) =>
      request<{ message: string }>('/api/auth/account/request-deletion', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    confirmAccountDeletion: (token: string) =>
      request<{ message: string; scheduledAt?: string }>('/api/auth/account/confirm-deletion', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    cancelAccountDeletion: () =>
      request<{ message: string }>('/api/auth/account/cancel-deletion', {
        method: 'POST',
      }),
  },

  connections: {
    getHub: () => request<any>('/api/connections/hub'),
    runHealthCheck: () => request<any>('/api/connections/health-check', { method: 'POST' }),
    updateSettings: (settings: any) =>
      request<any>('/api/connections/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    simulateScrobble: (payload: any) =>
      request<any>('/api/connections/simulate-scrobble', { method: 'POST', body: JSON.stringify(payload) }),
  },

  plex: {
    requestPin: () => request<any>('/api/plex/pin', { method: 'POST' }),
    verifyPin: (pinId: number, clientIdentifier?: string) =>
      request<any>('/api/plex/verify-pin', { method: 'POST', body: JSON.stringify({ pinId, clientIdentifier }) }),
    connectManual: (token: string, serverUrl?: string, serverName?: string) =>
      request<any>('/api/plex/connect-manual', { method: 'POST', body: JSON.stringify({ token, serverUrl, serverName }) }),
    getServers: () => request<any[]>('/api/plex/servers'),
    selectServer: (serverName: string, serverUrl: string) =>
      request<any>('/api/plex/select-server', { method: 'POST', body: JSON.stringify({ serverName, serverUrl }) }),
    testConnection: (serverUrl: string, token: string) =>
      request<any>('/api/plex/test-connection', { method: 'POST', body: JSON.stringify({ serverUrl, token }) }),
    getLibraries: () => request<any[]>('/api/plex/libraries'),
    updateLibraries: (monitoredLibraries: string[]) =>
      request<any>('/api/plex/libraries', { method: 'PUT', body: JSON.stringify({ monitoredLibraries }) }),
    getWebhookInfo: () => request<any>('/api/plex/webhook-info'),
    disconnect: () => request<any>('/api/plex/disconnect', { method: 'POST' }),
  },

  jellyfin: {
    testConnection: (serverUrl: string, apiKey: string) =>
      request<any>('/api/jellyfin/test-connection', { method: 'POST', body: JSON.stringify({ serverUrl, apiKey }) }),
    connect: (serverUrl: string, apiKey: string, serverName?: string, jellyfinUsername?: string) =>
      request<any>('/api/jellyfin/connect', { method: 'POST', body: JSON.stringify({ serverUrl, apiKey, serverName, jellyfinUsername }) }),
    getLibraries: () => request<any[]>('/api/jellyfin/libraries'),
    updateLibraries: (monitoredLibraries: string[]) =>
      request<any>('/api/jellyfin/libraries', { method: 'PUT', body: JSON.stringify({ monitoredLibraries }) }),
    getWebhookInfo: () => request<any>('/api/jellyfin/webhook-info'),
    disconnect: () => request<any>('/api/jellyfin/disconnect', { method: 'POST' }),
  },

  emby: {
    testConnection: (serverUrl: string, apiKey: string) =>
      request<any>('/api/emby/test-connection', { method: 'POST', body: JSON.stringify({ serverUrl, apiKey }) }),
    connect: (serverUrl: string, apiKey: string, serverName?: string, embyUsername?: string) =>
      request<any>('/api/emby/connect', { method: 'POST', body: JSON.stringify({ serverUrl, apiKey, serverName, embyUsername }) }),
    getLibraries: () => request<any[]>('/api/emby/libraries'),
    updateLibraries: (monitoredLibraries: string[]) =>
      request<any>('/api/emby/libraries', { method: 'PUT', body: JSON.stringify({ monitoredLibraries }) }),
    getWebhookInfo: () => request<any>('/api/emby/webhook-info'),
    disconnect: () => request<any>('/api/emby/disconnect', { method: 'POST' }),
  },

  anilist: {
    getOAuthUrl: () => request<{ url: string; clientId: string; state?: string }>('/api/anilist/oauth-url'),
    handleOAuthCallback: (code: string, state?: string) =>
      request<any>('/api/anilist/oauth/callback', { method: 'POST', body: JSON.stringify({ code, state }) }),
    connectToken: (token: string) =>
      request<any>('/api/anilist/connect-token', { method: 'POST', body: JSON.stringify({ token }) }),
    search: (query: string) => request<any[]>(`/api/anilist/search?q=${encodeURIComponent(query)}`),
    ping: () => request<any>('/api/anilist/ping', { method: 'POST' }),
    disconnect: () => request<any>('/api/anilist/disconnect', { method: 'POST' }),
  },

  mal: {
    getOAuthUrl: () =>
      request<{ url: string; codeVerifier: string; clientId: string; redirectUri: string }>('/api/mal/oauth-url'),
    handleOAuthCallback: (data: { code: string; codeVerifier: string }) =>
      request<any>('/api/mal/oauth/callback', { method: 'POST', body: JSON.stringify(data) }),
    connectToken: (token: string) =>
      request<any>('/api/mal/connect-token', { method: 'POST', body: JSON.stringify({ token }) }),
    ping: () => request<any>('/api/mal/ping', { method: 'POST' }),
    disconnect: () => request<any>('/api/mal/disconnect', { method: 'POST' }),
  },

  kitsu: {
    getOAuthUrl: () => request<{ url: string; clientId: string }>('/api/kitsu/oauth-url'),
    handleOAuthCallback: (code: string) =>
      request<any>('/api/kitsu/oauth/callback', { method: 'POST', body: JSON.stringify({ code }) }),
    connectCredentials: (username: string, password: string) =>
      request<any>('/api/kitsu/connect-credentials', { method: 'POST', body: JSON.stringify({ username, password }) }),
    connectToken: (accessToken: string) =>
      request<any>('/api/kitsu/connect-token', { method: 'POST', body: JSON.stringify({ accessToken }) }),
    search: (query: string) => request<any[]>(`/api/kitsu/search?query=${encodeURIComponent(query)}`),
    ping: () => request<any>('/api/kitsu/ping', { method: 'POST' }),
    disconnect: () => request<any>('/api/kitsu/disconnect', { method: 'POST' }),
  },

  catalog: {
    getPublic: (params?: { provider?: string }) => {
      const qs = params?.provider ? `?provider=${encodeURIComponent(params.provider)}` : '';
      return request<any>(`/api/catalog${qs}`);
    },
    getUser: (params?: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      provider?: 'ANILIST' | 'MAL' | 'ALL' | string;
      forceRefresh?: boolean;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.status && params.status !== 'ALL') searchParams.set('status', params.status);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.provider) searchParams.set('provider', params.provider);
      if (params?.forceRefresh) searchParams.set('forceRefresh', 'true');
      const qs = searchParams.toString();
      return request<any>(`/api/catalog/user${qs ? `?${qs}` : ''}`);
    },
    getFranchise: (params: {
      anilistId?: number;
      malId?: number;
      provider?: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL' | string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params.anilistId && params.anilistId > 0) searchParams.set('anilistId', String(params.anilistId));
      if (params.malId && params.malId > 0) searchParams.set('malId', String(params.malId));
      if (params.provider) searchParams.set('provider', params.provider);
      return request<any>(`/api/catalog/franchise?${searchParams.toString()}`);
    },
    getUserStats: () => request<any>('/api/catalog/stats'),
    toggleFavorite: (data: { animeId: string; title: string; coverUrl?: string; genres?: string[] }) =>
      request<any>('/api/catalog/favorites/toggle', { method: 'POST', body: JSON.stringify(data) }),
    getFavorites: () => request<any[]>('/api/catalog/favorites'),
    exportData: (format?: 'mal_xml' | 'json' | 'csv') =>
      request<{ contentType: string; filename: string; content: string }>(
        `/api/catalog/export?format=${format || 'mal_xml'}`,
      ),
    importData: (data: string) =>
      request<{ success: boolean; importedCount: number; favoritesCount: number; message: string }>(
        '/api/catalog/import',
        { method: 'POST', body: JSON.stringify({ data }) },
      ),
    syncProgress: (data: {
      anilistMediaId?: number;
      malMediaId?: number;
      progress?: number;
      score?: number;
      status?: string;
      showTitle?: string;
      seasonNumber?: number;
    }) => request<any>('/api/catalog/sync-progress', { method: 'POST', body: JSON.stringify(data) }),
  },

  history: {
    get: (params?: { page?: number; limit?: number; search?: string }) => {
      const q = new URLSearchParams();
      if (params?.page) q.append('page', String(params.page));
      if (params?.limit) q.append('limit', String(params.limit));
      if (params?.search) q.append('search', params.search);
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ items: any[]; total: number; page: number; totalPages: number; limit: number } | any[]>(
        `/api/history${queryStr}`,
      );
    },
    deleteAndRevert: (id: string) => request<any>(`/api/history/${id}`, { method: 'DELETE' }),
    batchDeleteAndRevert: (ids: string[]) =>
      request<any>('/api/history/batch-revert', { method: 'POST', body: JSON.stringify({ ids }) }),
    getHeatmap: () => request<any>('/api/history/stats/heatmap'),
    getSummary: () => request<any>('/api/history/stats/summary'),
  },

  mappings: {
    get: () => request<any[]>('/api/mappings'),
    getAdminAll: () => request<any[]>('/api/mappings/admin/all'),
    toggleGlobal: (id: string) => request<any>(`/api/mappings/${id}/toggle-global`, { method: 'POST' }),
    approve: (id: string) => request<any>(`/api/mappings/${id}/approve`, { method: 'POST' }),
    setManual: (data: any) => request<any>('/api/mappings/manual', { method: 'POST', body: JSON.stringify(data) }),
    unlink: (id: string) => request<any>(`/api/mappings/${id}`, { method: 'DELETE' }),
    searchRemote: (q: string, season?: number) =>
      request<any[]>(`/api/mappings/search-remote?q=${encodeURIComponent(q)}${season ? `&season=${season}` : ''}`),
    import: (items: any[]) =>
      request<{ success: boolean; message: string; importedCount: number }>('/api/mappings/import', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
  },

  blacklist: {
    get: () => request<any[]>('/api/blacklist'),
    getBlockedGenres: () => request<{ blockedGenres: string[] }>('/api/blacklist/genres'),
    updateBlockedGenres: (genres: string[]) =>
      request<any>('/api/blacklist/genres', { method: 'PUT', body: JSON.stringify({ genres }) }),
    add: (titlePattern: string, reason?: string) =>
      request<any>('/api/blacklist', { method: 'POST', body: JSON.stringify({ titlePattern, reason }) }),
    remove: (id: string) => request<any>(`/api/blacklist/${id}`, { method: 'DELETE' }),
  },

  admin: {
    getDashboard: (params?: { timeframe?: string }) => {
      const qs = params?.timeframe ? `?timeframe=${encodeURIComponent(params.timeframe)}` : '';
      return request<any>(`/api/admin/dashboard${qs}`);
    },
    getChart: (timeframe: string) => request<any[]>(`/api/admin/chart?timeframe=${encodeURIComponent(timeframe)}`),
    getActivityHeatmap: () => request<any>('/api/admin/activity-heatmap'),
    getSiteSettings: () => request<any>('/api/admin/site-settings'),
    updateSiteSettings: (changes: Record<string, string>) =>
      request<{ success: boolean; updated: string[] }>('/api/admin/site-settings', {
        method: 'PUT',
        body: JSON.stringify({ changes }),
      }),
    getCredentials: () => request<any>('/api/admin/credentials'),
    updateCredentials: (currentPassword: string, changes: Record<string, string>) =>
      request<any>('/api/admin/credentials', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, changes }),
      }),
    getGenreOverview: () => request<any>('/api/admin/genres'),
    getFailedScrobbles: (page = 1, limit = 50) =>
      request<{
        pagination: {
          currentPage: number;
          itemsPerPage: number;
          totalItems: number;
          totalPages: number;
        };
        items: Array<{
          id: string;
          showTitle: string;
          episodeNumber: number;
          seasonNumber: number;
          username: string;
          failedTrackers: string[];
          errorMessage: string;
          viewedAt: string;
        }>;
      }>(`/api/admin/failed-scrobbles?page=${page}&limit=${limit}`),
    resetGeoMetrics: () =>
      request<{ success: boolean; message: string }>('/api/admin/metrics/geo', { method: 'DELETE' }),
    getUsers: () => request<any[]>('/api/admin/users'),
    updateUserPermissions: (id: string, payload: any) =>
      request<any>(`/api/admin/users/${id}/permissions`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteUser: (id: string) => request<any>(`/api/admin/users/${id}`, { method: 'DELETE' }),
    getSystemHealth: () => request<any>('/api/admin/system-health'),
    addDomain: (domain: string, isAllowed = true, reason?: string) =>
      request<any>('/api/admin/domains', { method: 'POST', body: JSON.stringify({ domain, isAllowed, reason }) }),
    deleteDomain: (id: string) => request<any>(`/api/admin/domains/${id}`, { method: 'DELETE' }),

    // BACKUPS & PROGRAMACIÓN
    getBackups: () =>
      request<{ backups: any[]; schedule: any; totalBackups: number; storageUsedFormatted: string }>(
        '/api/admin/backups',
      ),
    createBackup: (type: 'DATABASE' | 'FULL_SYSTEM') =>
      request<{ success: boolean; message: string; filename: string; sizeBytes: number; createdAt: string }>(
        '/api/admin/backups/create',
        { method: 'POST', body: JSON.stringify({ type }) },
      ),
    deleteBackup: (filename: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      }),
    restoreBackup: (filename: string) =>
      request<{ success: boolean; message: string; restoredRecords: number; details: any }>(
        '/api/admin/backups/restore',
        { method: 'POST', body: JSON.stringify({ filename }) },
      ),
    downloadBackup: async (filename: string): Promise<Blob> => {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/admin/backups/${encodeURIComponent(filename)}/download`, {
        credentials: 'include',
      });
      if (!res.ok) {
        let msg = `Error al descargar copia de seguridad (${res.status})`;
        try {
          const err = await res.json();
          if (err.message) msg = err.message;
        } catch {}
        throw new Error(msg);
      }
      return res.blob();
    },
    uploadAndRestoreBackup: async (file: File) => {
      const formData = new FormData();
      formData.append('backupFile', file);
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/admin/backups/upload-restore`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al restaurar copia de seguridad');
      }
      return res.json();
    },
    saveBackupSchedule: (schedule: {
      enabled: boolean;
      frequency: string;
      time: string;
      includeMedia: boolean;
      retentionCount: number;
    }) =>
      request<{ success: boolean; message: string; schedule: any }>('/api/admin/backups/schedule', {
        method: 'POST',
        body: JSON.stringify(schedule),
      }),
    getMedia: () =>
      request<{
        media: any[];
        totalFiles: number;
        totalSizeBytes: number;
        totalSizeFormatted: string;
        totalLinked?: number;
        totalOrphans?: number;
      }>('/api/admin/media'),
    deleteMedia: (filename: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/media/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      }),
    purgeMedia: () =>
      request<{ success: boolean; message: string; deletedCount: number }>('/api/admin/media/purge', {
        method: 'POST',
      }),
    purgeOrphanMedia: () =>
      request<{ success: boolean; message: string; deletedCount: number }>('/api/admin/media/purge-orphans', {
        method: 'POST',
      }),
    refreshMedia: (filename: string) =>
      request<{ success: boolean; message: string; url?: string }>(
        `/api/admin/media/refresh/${encodeURIComponent(filename)}`,
        {
          method: 'POST',
        },
      ),

    // MODO MANTENIMIENTO
    getMaintenance: () =>
      request<{ enabled: boolean; message: string; estimatedEnd: string | null }>('/api/admin/maintenance'),
    setMaintenance: (data: { enabled: boolean; message?: string; estimatedEnd?: string }) =>
      request<{ enabled: boolean; message: string; estimatedEnd: string | null }>('/api/admin/maintenance', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // ENLACES DEL PIE (redes sociales y sitios recomendados)
    siteLinks: () => request<{ links: SiteLink[] }>('/api/admin/site-links'),
    siteLinkProviders: () =>
      request<{ providers: RedSocial[] }>('/api/admin/site-links/providers'),
    createSiteLink: (data: Partial<SiteLink>) =>
      request<{ links: SiteLink[] }>('/api/admin/site-links', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateSiteLink: (id: string, data: Partial<SiteLink>) =>
      request<{ links: SiteLink[] }>(`/api/admin/site-links/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteSiteLink: (id: string) =>
      request<{ links: SiteLink[] }>(`/api/admin/site-links/${id}`, { method: 'DELETE' }),
    uploadSiteLinkIcon: (id: string, formData: FormData) =>
      request<{ links: SiteLink[] }>(`/api/admin/site-links/${id}/icon`, {
        method: 'POST',
        body: formData,
      }),

    // AVATARES PREDETERMINADOS
    presetAvatars: () => request<{ avatars: string[] }>('/api/admin/preset-avatars'),
    addPresetAvatar: (formData: FormData) =>
      request<{ avatars: string[] }>('/api/admin/preset-avatars', { method: 'POST', body: formData }),
    removePresetAvatar: (avatar: string) =>
      request<{ avatars: string[] }>('/api/admin/preset-avatars', {
        method: 'DELETE',
        body: JSON.stringify({ avatar }),
      }),

    // SOPORTE & TICKETS (ADMIN)
    tickets: {
      list: (params?: { status?: string; category?: string; priority?: string; search?: string; page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.set('status', params.status);
        if (params?.category) queryParams.set('category', params.category);
        if (params?.priority) queryParams.set('priority', params.priority);
        if (params?.search) queryParams.set('search', params.search);
        if (params?.page) queryParams.set('page', params.page.toString());
        if (params?.limit) queryParams.set('limit', params.limit.toString());
        const qs = queryParams.toString();
        return request<{ tickets: any[]; total: number; page: number; limit: number; totalPages: number }>(
          `/api/admin/tickets${qs ? `?${qs}` : ''}`,
        );
      },
      getStats: () =>
        request<{
          total: number;
          open: number;
          waitingUser: number;
          inProgress: number;
          resolved: number;
          closed: number;
          pendingStaff: number;
          urgent: number;
          todayResolved: number;
          byCategory: { category: string; count: number }[];
        }>('/api/admin/tickets/stats'),
      get: (id: string) => request<any>(`/api/admin/tickets/${encodeURIComponent(id)}`),
      reply: (id: string, data: { content: string; isInternalNote?: boolean; status?: string; attachments?: any[] }) =>
        request<any>(`/api/admin/tickets/${encodeURIComponent(id)}/reply`, {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      updateStatus: (
        id: string,
        data: { status?: string; priority?: string; category?: string; assignedAdminId?: string | null },
      ) =>
        request<any>(`/api/admin/tickets/${encodeURIComponent(id)}/status`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        request<{ success: boolean; message: string }>(`/api/admin/tickets/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),
    },
  },

  tickets: {
    list: (params?: { status?: string; category?: string; search?: string; page?: number; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.set('status', params.status);
      if (params?.category) queryParams.set('category', params.category);
      if (params?.search) queryParams.set('search', params.search);
      if (params?.page) queryParams.set('page', params.page.toString());
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      const qs = queryParams.toString();
      return request<{ tickets: any[]; total: number; page: number; limit: number; totalPages: number }>(
        `/api/tickets${qs ? `?${qs}` : ''}`,
      );
    },
    get: (id: string) => request<any>(`/api/tickets/${encodeURIComponent(id)}`),
    uploadAttachment: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/api/tickets/upload-attachment`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al adjuntar archivo');
      }
      return res.json() as Promise<{ success: boolean; attachment: { fileName: string; fileSize: number; mimeType: string; fileUrl: string } }>;
    },
    create: (data: { subject: string; category?: string; priority?: string; message: string; attachments?: any[] }) =>
      request<any>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    reply: (id: string, data: { content: string; attachments?: any[] }) =>
      request<any>(`/api/tickets/${encodeURIComponent(id)}/reply`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    close: (id: string) =>
      request<any>(`/api/tickets/${encodeURIComponent(id)}/close`, {
        method: 'POST',
      }),
  },

  setup: {
    getSiteSettings: () => request<SiteSettings>('/api/setup/site-settings'),
    getSiteLinks: () =>
      request<{ social: SiteLink[]; friends: SiteLink[] }>('/api/setup/site-links'),
    getStatus: () =>
      request<{ isInstalled: boolean; needsAdmin: boolean; adminCount: number; appDomain: string | null; requiresSetup: boolean }>(
        '/api/setup/status',
      ),
    getPublicStats: () =>
      request<{
        status: string;
        uptimeFormatted: string;
        uptimePercentage: string;
        successRate: string;
        latency: string;
        totalScrobbles: number;
        totalUsers: number;
        totalMappings: number;
        engine: string;
        services: Record<string, string>;
      }>('/api/setup/public-stats'),
    getMaintenanceStatus: () =>
      request<{
        inMaintenance: boolean;
        message: string;
        estimatedEnd: string | null;
      }>('/api/setup/maintenance-status'),
    testSmtp: (data: any) =>
      request<{ success: boolean; message: string }>('/api/setup/test-smtp', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    initialize: (data: any) =>
      request<{ success: boolean; message: string; admin: any }>('/api/setup/initialize', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  notifications: {
    get: (limit?: number) =>
      request<{ notifications: any[]; unreadCount: number }>(
        `/api/notifications${limit ? `?limit=${limit}` : ''}`,
      ),
    getUnreadCount: () => request<{ unreadCount: number }>('/api/notifications/unread-count'),
    markAsRead: (id: string) => request<any>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    markAllAsRead: () =>
      request<{ success: boolean; message: string }>('/api/notifications/mark-all-read', {
        method: 'POST',
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/notifications/${id}`, {
        method: 'DELETE',
      }),
    testDiscord: () =>
      request<{ success: boolean; message: string }>('/api/notifications/test-discord', {
        method: 'POST',
      }),
  },

  announcements: {
    getActive: () => request<any>('/api/announcements/active'),
    getAdminConfig: () =>
      request<{ announcement: any; presets: any[]; customPresets: any[] }>('/api/admin/announcements'),
    update: (data: any) =>
      request<{ success: boolean; message: string; announcement: any }>('/api/admin/announcements', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    toggle: (isActive?: boolean) =>
      request<{ success: boolean; isActive: boolean; message: string; announcement: any }>(
        '/api/admin/announcements/toggle',
        {
          method: 'POST',
          body: JSON.stringify({ isActive }),
        },
      ),
    applyPreset: (presetId: string) =>
      request<{ success: boolean; message: string; announcement: any }>(
        `/api/admin/announcements/apply-preset/${encodeURIComponent(presetId)}`,
        {
          method: 'POST',
        },
      ),
    saveCustomPreset: (data: any) =>
      request<{ success: boolean; message: string; preset: any }>('/api/admin/announcements/custom-presets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteCustomPreset: (id: string) =>
      request<{ success: boolean; message: string }>(
        `/api/admin/announcements/custom-presets/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        },
      ),
    uploadMedia: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/api/admin/announcements/upload-media`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al subir archivo');
      }
      return res.json();
    },
  },
};

