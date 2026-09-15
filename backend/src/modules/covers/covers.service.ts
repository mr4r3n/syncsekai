import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { detectarTipoImagen } from '../../common/security/image-file';
import * as crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';

/**
 * La URL de la portada de un anime de AniList. El título va siempre: es lo que
 * necesita el último paso de la cadena de resolución (búsqueda por título en
 * Kitsu) cuando AniList no responde.
 */
export function urlPortadaAnilist(anilistId: number, titulo?: string | null): string {
  const base = `/api/covers/al_${anilistId}`;
  return titulo ? `${base}?title=${encodeURIComponent(titulo)}` : base;
}

@Injectable()
export class CoversService {
  private readonly logger = new Logger(CoversService.name);
  private readonly coversDir = path.join(process.cwd(), 'uploads', 'covers');
  private memoryMap = new Map<string, string>(); // key -> relative web URL
  /**
   * Un mismo anime llega con hasta cuatro claves (al_, mal_, kitsu_, title_) según
   * qué tracker o qué pantalla lo pida, y cada clave descargaba su propio fichero:
   * la misma portada tres veces en disco. Aquí se apunta qué claves son el mismo
   * anime; la descarga y la lectura pasan siempre por la canónica.
   *
   * Se persiste en un JSON junto a las portadas: en memoria se perdía en cada
   * reinicio y los duplicados volvían.
   */
  private aliasMap = new Map<string, string>(); // aliasKey -> canonicalKey
  private readonly aliasFile = path.join(this.coversDir, 'aliases.json');
  private inFlightDownloads = new Map<string, Promise<string | null>>();

  constructor() {
    if (!fs.existsSync(this.coversDir)) {
      fs.mkdirSync(this.coversDir, { recursive: true });
    }
    try {
      const guardado = JSON.parse(fs.readFileSync(this.aliasFile, 'utf8')) as Record<string, string>;
      for (const [alias, canonica] of Object.entries(guardado)) this.aliasMap.set(alias, canonica);
    } catch {
      // Sin fichero aún, o ilegible: se empieza vacío y se regenera con el uso.
    }
  }

  /** Orden de preferencia para nombrar el fichero: el ID de AniList es el más estable. */
  private static prioridadClave(key: string): number {
    if (key.startsWith('al_')) return 4;
    if (key.startsWith('mal_')) return 3;
    if (key.startsWith('kitsu_')) return 2;
    return 1;
  }

  /** Clave bajo la que se guarda y se lee de verdad. */
  clavecanonica(key: string): string {
    const cleaned = this.getSafeKey(key);
    return this.aliasMap.get(cleaned) || cleaned;
  }

  private ficheroDirecto(key: string): string | null {
    for (const ext of ['.webp', '.jpg', '.png', '.jpeg']) {
      const p = path.join(this.coversDir, `${key}${ext}`);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  /**
   * Declara que dos claves son el mismo anime. Si ya hay fichero para las dos, se
   * borra el del alias; si solo lo tiene el alias, se renombra a la canónica.
   * Así los duplicados que ya existen desaparecen conforme se vuelve a usar el
   * catálogo, sin una migración aparte.
   */
  registrarAlias(a: string, b: string): void {
    let alias = this.clavecanonica(a);
    let canonica = this.clavecanonica(b);
    if (!alias || !canonica || alias === canonica) return;
    if (CoversService.prioridadClave(alias) > CoversService.prioridadClave(canonica)) {
      [alias, canonica] = [canonica, alias];
    }
    // Lo que apuntaba al alias pasa a apuntar a la canónica.
    for (const [k, v] of this.aliasMap) if (v === alias) this.aliasMap.set(k, canonica);
    this.aliasMap.set(alias, canonica);

    const fa = this.ficheroDirecto(alias);
    const fc = this.ficheroDirecto(canonica);
    try {
      if (fa && fc) fs.unlinkSync(fa);
      else if (fa && !fc) fs.renameSync(fa, path.join(this.coversDir, `${canonica}${path.extname(fa)}`));
    } catch (err: any) {
      this.logger.warn(`No se pudo unificar la portada ${alias} -> ${canonica}: ${err.message}`);
    }
    this.memoryMap.delete(alias);

    try {
      fs.writeFileSync(this.aliasFile, JSON.stringify(Object.fromEntries(this.aliasMap)));
    } catch (err: any) {
      this.logger.warn(`No se pudo guardar aliases.json: ${err.message}`);
    }
  }

  getSafeKey(key: string): string {
    const base = (key || '').replace(/\.(jpg|jpeg|png|webp|gif|svg)$/i, '');
    return base.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Dominios de los CDN oficiales de los trackers desde los que se aceptan portadas.
   * Sirve de allowlist contra SSRF: sin esto, cualquiera puede forzar al backend a
   * hacer peticiones a la red interna mediante el parámetro ?fallback= del controlador.
   */
  static readonly ALLOWED_COVER_DOMAINS = [
    'anilist.co',
    'myanimelist.net',
    'kitsu.app',
    'kitsu.io',
  ];

  isAllowedCoverUrl(rawUrl: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    // Credenciales o puerto explícito solo aparecen en URLs manipuladas, nunca en las de un CDN.
    if (parsed.username || parsed.password || parsed.port) return false;

    const host = parsed.hostname.toLowerCase();
    return CoversService.ALLOWED_COVER_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`),
    );
  }

  getTitleKey(title: string): string {
    const clean = (title || '').toLowerCase().trim();
    return `title_${crypto.createHash('md5').update(clean).digest('hex').slice(0, 16)}`;
  }

  getFilePath(safeKey: string): string | null {
    return this.ficheroDirecto(this.clavecanonica(safeKey));
  }

  hasLocalCover(safeKey: string): boolean {
    return this.getFilePath(safeKey) !== null;
  }

  getLocalCoverUrl(safeKey: string): string | null {
    const cleaned = this.getSafeKey(safeKey);
    if (this.hasLocalCover(cleaned)) {
      return `/api/covers/${cleaned}`;
    }
    return null;
  }

  async downloadAndSaveCover(
    safeKey: string,
    remoteUrl: string,
    secondaryKey?: string,
  ): Promise<string | null> {
    if (!remoteUrl) return null;
    if (!this.isAllowedCoverUrl(remoteUrl)) {
      this.logger.warn(`Portada rechazada: el origen no es un CDN autorizado (${remoteUrl.slice(0, 120)}).`);
      return null;
    }
    if (secondaryKey) this.registrarAlias(secondaryKey, safeKey);
    const cleaned = this.clavecanonica(safeKey);
    if (!cleaned || cleaned.length > 96 || this.inFlightDownloads.size >= 80) return null;

    const existing = this.getLocalCoverUrl(cleaned);
    if (existing) {
      return existing;
    }

    // Deduplicar descargas en curso simultáneas
    if (this.inFlightDownloads.has(cleaned)) {
      return this.inFlightDownloads.get(cleaned)!;
    }

    const downloadPromise = (async () => {
      try {
        const res = await axios.get(remoteUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxRedirects: 2,
          maxContentLength: 5 * 1024 * 1024,
          maxBodyLength: 5 * 1024 * 1024,
          headers: {
            'User-Agent': 'SyncSekai/1.0',
          },
        });

        const rawBuffer = Buffer.from(res.data);
        const contentType = String(res.headers['content-type'] || '').toLowerCase();
        if (!contentType.startsWith('image/') || rawBuffer.length > 5 * 1024 * 1024) {
          return null;
        }
        let finalBuffer = rawBuffer;
        let ext = '.webp';

        // Criba por cabecera: el Content-Type lo declara el servidor remoto, asi
        // que no basta para saber que esto es una imagen.
        if (!detectarTipoImagen(rawBuffer)) {
          this.logger.warn(
            `Portada descartada de ${remoteUrl}: los bytes no corresponden a JPEG, PNG ni WebP.`,
          );
          return null;
        }

        try {
          finalBuffer = await sharp(rawBuffer, { limitInputPixels: 25_000_000 })
            .webp({ quality: 92, effort: 4 })
            .toBuffer();
          ext = '.webp';
        } catch (err: any) {
          // Si no se puede reencodificar, se descarta: no se guardan bytes que
          // ningun decodificador haya validado.
          this.logger.warn(
            `Portada descartada de ${remoteUrl}: sharp no pudo reencodificarla (${err.message}).`,
          );
          return null;
        }

        const targetPath = path.join(this.coversDir, `${cleaned}${ext}`);
        await fs.promises.writeFile(targetPath, finalBuffer);

        const webUrl = `/api/covers/${cleaned}`;
        this.memoryMap.set(cleaned, webUrl);
        return webUrl;
      } catch (err: any) {
        this.logger.warn(
          `No se pudo descargar la portada desde ${remoteUrl} (${cleaned}): ${err.message}`,
        );
        return null;
      } finally {
        this.inFlightDownloads.delete(cleaned);
      }
    })();

    this.inFlightDownloads.set(cleaned, downloadPromise);
    return downloadPromise;
  }

  async fetchAndCacheOnDemand(key: string, titleHint?: string): Promise<string | null> {
    const cleaned = this.clavecanonica(key);
    const existing = this.getFilePath(cleaned);
    if (existing) return existing;

    let remoteUrl: string | null = null;
    let secondaryKey: string | undefined = undefined;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    };

    // Caso 1: al_{id} o id numérico de AniList
    if (cleaned.startsWith('al_') || /^\d+$/.test(cleaned)) {
      const anilistId = parseInt(cleaned.replace('al_', ''), 10);
      if (!isNaN(anilistId)) {
        try {
          const query = `
            query ($id: Int) {
              Media(id: $id, type: ANIME) {
                title { romaji english native }
                coverImage {
                  extraLarge
                  large
                  medium
                }
              }
            }
          `;
          const res = await axios.post(
            'https://graphql.anilist.co',
            { query, variables: { id: anilistId } },
            { headers, timeout: 6000 },
          );
          const media = res.data?.data?.Media;
          remoteUrl =
            media?.coverImage?.extraLarge ||
            media?.coverImage?.large ||
            media?.coverImage?.medium ||
            null;
          if (media?.title) {
            const possibleTitle = media.title.romaji || media.title.english;
            if (possibleTitle) {
              secondaryKey = this.getTitleKey(possibleTitle);
            }
          }
        } catch (err: any) {
          this.logger.warn(`Error buscando portada en AniList para ID ${anilistId}: ${err.message}`);
        }

        // Fallback 1: Buscar por mapeo externo directo en Kitsu (anilist/anime)
        if (!remoteUrl) {
          try {
            const kitsuMapRes = await axios.get(
              `https://kitsu.io/api/edge/mappings?filter[external_site]=anilist/anime&filter[external_id]=${anilistId}&include=item`,
              {
                headers: { Accept: 'application/vnd.api+json', 'User-Agent': headers['User-Agent'] },
                timeout: 6000,
              },
            );
            const item = kitsuMapRes.data?.included?.[0]?.attributes;
            if (item?.posterImage?.large || item?.posterImage?.original || item?.posterImage?.medium) {
              remoteUrl = item.posterImage.large || item.posterImage.original || item.posterImage.medium;
            }
            if (item?.canonicalTitle || item?.titles?.en_jp) {
              const title = item.canonicalTitle || item.titles?.en_jp;
              secondaryKey = this.getTitleKey(title);
            }
          } catch {}
        }

        // Fallback 2: Buscar por título en Kitsu si se proporcionó un hint
        if (!remoteUrl && titleHint) {
          try {
            const kitsuRes = await axios.get(
              `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(titleHint)}&page[limit]=1`,
              {
                headers: { Accept: 'application/vnd.api+json', 'User-Agent': headers['User-Agent'] },
                timeout: 6000,
              },
            );
            const poster =
              kitsuRes.data?.data?.[0]?.attributes?.posterImage?.large ||
              kitsuRes.data?.data?.[0]?.attributes?.posterImage?.original ||
              null;
            if (poster) remoteUrl = poster;
          } catch {}
        }
      }
    }

    // Caso 2: mal_{id} de MyAnimeList
    if (!remoteUrl && cleaned.startsWith('mal_')) {
      const malId = parseInt(cleaned.replace('mal_', ''), 10);
      if (!isNaN(malId)) {
        try {
          const query = `
            query ($idMal: Int) {
              Media(idMal: $idMal, type: ANIME) {
                id
                coverImage {
                  extraLarge
                  large
                }
              }
            }
          `;
          const res = await axios.post(
            'https://graphql.anilist.co',
            { query, variables: { idMal: malId } },
            { headers, timeout: 6000 },
          );
          remoteUrl =
            res.data?.data?.Media?.coverImage?.extraLarge ||
            res.data?.data?.Media?.coverImage?.large ||
            null;
          if (res.data?.data?.Media?.id) secondaryKey = `al_${res.data.data.Media.id}`;
        } catch {}

        if (!remoteUrl) {
          try {
            const jikanRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}`, {
              headers: { 'User-Agent': headers['User-Agent'] },
              timeout: 6000,
            });
            remoteUrl =
              jikanRes.data?.data?.images?.webp?.large_image_url ||
              jikanRes.data?.data?.images?.jpg?.large_image_url ||
              null;
          } catch {}
        }

        if (!remoteUrl) {
          try {
            const kitsuMapRes = await axios.get(
              `https://kitsu.io/api/edge/mappings?filter[external_site]=myanimelist/anime&filter[external_id]=${malId}&include=item`,
              {
                headers: { Accept: 'application/vnd.api+json', 'User-Agent': headers['User-Agent'] },
                timeout: 6000,
              },
            );
            const item = kitsuMapRes.data?.included?.[0]?.attributes;
            if (item?.posterImage?.large || item?.posterImage?.original) {
              remoteUrl = item.posterImage.large || item.posterImage.original;
            }
          } catch {}
        }
      }
    }

    // Caso 3: kitsu_{id} de Kitsu
    if (!remoteUrl && cleaned.startsWith('kitsu_')) {
      const kitsuId = parseInt(cleaned.replace('kitsu_', ''), 10);
      if (!isNaN(kitsuId)) {
        try {
          const kitsuRes = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
            headers: {
              Accept: 'application/vnd.api+json',
              'Content-Type': 'application/vnd.api+json',
              'User-Agent': 'SyncSekai/1.0.0',
            },
            timeout: 6000,
          });
          const attr = kitsuRes.data?.data?.attributes;
          remoteUrl =
            attr?.posterImage?.large ||
            attr?.posterImage?.medium ||
            attr?.posterImage?.original ||
            null;
        } catch (err: any) {
          this.logger.warn(`Error buscando portada en Kitsu para ID ${kitsuId}: ${err.message}`);
        }
      }
    }

    // Caso 4: Búsqueda por título (titleHint o key decodificada)
    const searchTarget =
      titleHint || (cleaned.startsWith('title_') && !/^[a-f0-9]{16}$/.test(cleaned.replace('title_', ''))
        ? decodeURIComponent(key.replace(/^title_/, ''))
        : '');

    if (!remoteUrl && searchTarget && searchTarget.trim().length > 1) {
      try {
        const query = `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              id
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;
        const res = await axios.post(
          'https://graphql.anilist.co',
          { query, variables: { search: searchTarget.trim() } },
          { headers, timeout: 6000 },
        );
        const media = res.data?.data?.Media;
        remoteUrl =
          media?.coverImage?.extraLarge ||
          media?.coverImage?.large ||
          media?.coverImage?.medium ||
          null;
        if (media?.id) {
          secondaryKey = `al_${media.id}`;
        }
      } catch (err: any) {
        this.logger.warn(
          `Error buscando portada por título para "${searchTarget}": ${err.message}`,
        );
      }
    }

    if (remoteUrl) {
      await this.downloadAndSaveCover(cleaned, remoteUrl, secondaryKey);
      return this.getFilePath(cleaned);
    }

    return null;
  }

  async getOrFetchCover(showTitle: string, anilistId?: number | null): Promise<string | null> {
    const cleanTitle = (showTitle || '').toLowerCase().trim();
    if (!cleanTitle && !anilistId) return null;

    const titleKey = cleanTitle ? this.getTitleKey(cleanTitle) : null;
    const safeKey = anilistId ? `al_${anilistId}` : titleKey!;

    // 1. Si ya existe en disco local, devolver inmediatamente
    const local = this.getLocalCoverUrl(safeKey);
    if (local) return local;

    if (titleKey) {
      const localTitle = this.getLocalCoverUrl(titleKey);
      if (localTitle) return localTitle;
    }

    // 2. Si tenemos anilistId, buscar en AniList GraphQL por ID
    if (anilistId) {
      try {
        const query = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;
        const reqHeaders = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        };
        const res = await axios.post(
          'https://graphql.anilist.co',
          { query, variables: { id: anilistId } },
          { headers: reqHeaders, timeout: 6000 },
        );
        const coverUrl =
          res.data?.data?.Media?.coverImage?.extraLarge ||
          res.data?.data?.Media?.coverImage?.large ||
          res.data?.data?.Media?.coverImage?.medium;
        if (coverUrl) {
          return await this.downloadAndSaveCover(safeKey, coverUrl, titleKey || undefined);
        }
      } catch (e: any) {
        // Ignorar error de red y continuar
      }
    }

    // 3. Si no hay anilistId o falló, buscar por título en AniList
    if (cleanTitle) {
      const reqHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      };

      try {
        const query = `
          query ($search: String) {
            Media(search: $search, type: ANIME) {
              id
              coverImage {
                extraLarge
                large
                medium
              }
            }
          }
        `;
        const res = await axios.post(
          'https://graphql.anilist.co',
          { query, variables: { search: showTitle } },
          { headers: reqHeaders, timeout: 6000 },
        );
        const media = res.data?.data?.Media;
        const coverUrl =
          media?.coverImage?.extraLarge ||
          media?.coverImage?.large ||
          media?.coverImage?.medium;
        if (coverUrl) {
          const secondary = media?.id ? `al_${media.id}` : undefined;
          return await this.downloadAndSaveCover(titleKey!, coverUrl, secondary);
        }
      } catch (e: any) {
        // Ignorar error de red y probar Kitsu
      }

      // Fallback a Kitsu por texto
      try {
        const kitsuRes = await axios.get(
          `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(showTitle)}&page[limit]=1`,
          {
            headers: {
              Accept: 'application/vnd.api+json',
              'User-Agent': reqHeaders['User-Agent'],
            },
            timeout: 6000,
          },
        );
        const item = kitsuRes.data?.data?.[0]?.attributes;
        const coverUrl = item?.posterImage?.large || item?.posterImage?.original || item?.posterImage?.medium;
        if (coverUrl) {
          const secondary = item?.id ? `kitsu_${item.id}` : undefined;
          return await this.downloadAndSaveCover(titleKey!, coverUrl, secondary);
        }
      } catch {}
    }

    return null;
  }

  private animeMetaCache = new Map<number, { english: string; romaji: string; native: string; malId: number | null }>();

  async batchFetchAnimeMetadata(ids: number[]): Promise<Map<number, { english: string; romaji: string; native: string; malId: number | null }>> {
    const missing = ids.filter((id) => id > 0 && !this.animeMetaCache.has(id));
    if (missing.length > 0) {
      for (let i = 0; i < missing.length; i += 50) {
        const chunk = missing.slice(i, i + 50);
        try {
          const query = `
            query ($ids: [Int]) {
              Page(page: 1, perPage: 50) {
                media(id_in: $ids, type: ANIME) {
                  id
                  idMal
                  title {
                    english
                    romaji
                    native
                  }
                }
              }
            }
          `;
          const res = await axios.post(
            'https://graphql.anilist.co',
            { query, variables: { ids: chunk } },
            {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
              },
              timeout: 6000,
            },
          );
          const list = res.data?.data?.Page?.media || [];
          for (const item of list) {
            this.animeMetaCache.set(item.id, {
              english: item.title?.english || '',
              romaji: item.title?.romaji || '',
              native: item.title?.native || '',
              malId: item.idMal || null,
            });
            if (item.idMal) this.registrarAlias(`mal_${item.idMal}`, `al_${item.id}`);
          }
        } catch (e: any) {
          this.logger.warn(`Error en batchFetchAnimeMetadata (AniList): ${e.message}. Consultando Kitsu...`);
          // Fallback a Kitsu para no dejar los títulos vacíos
          for (const id of chunk) {
            if (!this.animeMetaCache.has(id)) {
              try {
                const kRes = await axios.get(
                  `https://kitsu.io/api/edge/mappings?filter[external_site]=anilist/anime&filter[external_id]=${id}&include=item`,
                  {
                    headers: {
                      Accept: 'application/vnd.api+json',
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                    },
                    timeout: 4000,
                  },
                );
                const item = kRes.data?.included?.[0]?.attributes;
                if (item) {
                  this.animeMetaCache.set(id, {
                    english: item.titles?.en || item.canonicalTitle || '',
                    romaji: item.titles?.en_jp || item.canonicalTitle || '',
                    native: item.titles?.ja_jp || '',
                    malId: null,
                  });
                }
              } catch {}
            }
          }
        }
      }
    }
    return this.animeMetaCache;
  }

  /**
   * Lo que ya esta en memoria, sin tocar la red.
   *
   * Quien pinta una pantalla necesita responder ya; los titulos que falten
   * apareceran en la siguiente carga, cuando `precargarMetadatosAnime` los haya
   * traido. Un fichero sin titulo se ensena por su nombre, que es informacion
   * suficiente para gestionarlo.
   */
  obtenerMetadatosEnCache(ids: number[]) {
    const encontrados = new Map<number, { english: string; romaji: string; native: string; malId: number | null }>();
    for (const id of ids) {
      const meta = this.animeMetaCache.get(id);
      if (meta) encontrados.set(id, meta);
    }
    return encontrados;
  }

  private precargaEnCurso: Promise<unknown> | null = null;

  /**
   * Rellena la cache en segundo plano, fuera de la peticion: con la cache
   * vacia, resolver metadatos en linea son minutos y el proxy corta antes.
   * Solo una precarga a la vez. La cache vive en memoria y se pierde al
   * reiniciar.
   */
  precargarMetadatosAnime(ids: number[]): void {
    if (this.precargaEnCurso) return;
    const faltan = ids.filter((id) => id > 0 && !this.animeMetaCache.has(id));
    if (faltan.length === 0) return;

    this.precargaEnCurso = this.batchFetchAnimeMetadata(faltan)
      .catch((e: any) => {
        // Nadie espera esta promesa: sin este catch, un fallo aqui seria un
        // unhandled rejection y se lleva el proceso por delante.
        this.logger.warn(`Precarga de metadatos en segundo plano fallida: ${e?.message || e}`);
      })
      .finally(() => {
        this.precargaEnCurso = null;
      });
  }

  async forceRefreshCover(key: string, titleHint?: string): Promise<{ success: boolean; url?: string; error?: string }> {
    const cleaned = this.clavecanonica(key);
    const extensions = ['.webp', '.jpg', '.png', '.jpeg'];
    for (const ext of extensions) {
      const p = path.join(this.coversDir, `${cleaned}${ext}`);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch {}
      }
    }
    this.memoryMap.delete(cleaned);

    const newPath = await this.fetchAndCacheOnDemand(cleaned, titleHint);
    if (newPath) {
      return { success: true, url: `/api/covers/${cleaned}` };
    }
    return { success: false, error: 'No se pudo obtener una portada actualizada desde el tracker.' };
  }
}
