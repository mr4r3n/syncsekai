import { PrismaClient, Role, AnimeProvider, SyncStatus, TicketCategory, TicketPriority, TicketStatus, SiteLinkKind } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/*
 * El seed borra todas las tablas antes de escribir. La guarda comprueba el host
 * de `DATABASE_URL`, que es lo que decide qué base se vacía; `NODE_ENV` puede
 * estar sin definir al lanzarlo a mano. Sólo pasa el bucle local; cualquier
 * otro host requiere SEED_DESTINO_OK=1.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function comprobarDestino(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no está definida. Sin saber a qué base apunta, no se siembra.');
    process.exit(1);
  }

  let host: string;
  try {
    // `postgresql://` no es un esquema que URL entienda de fábrica para el host,
    // pero sí lo parsea si se le cambia el esquema por uno que sí conozca.
    host = new URL(url.replace(/^[a-z+]+:\/\//i, 'http://')).hostname;
  } catch {
    console.error('DATABASE_URL no se puede interpretar. No se siembra a ciegas.');
    process.exit(1);
  }

  if (LOOPBACK.has(host) || process.env.SEED_DESTINO_OK === '1') return;

  console.error(`Este script BORRA todas las tablas antes de sembrar, y DATABASE_URL apunta a "${host}".`);
  console.error('Si de verdad es una base de desarrollo, vuelve a lanzarlo con SEED_DESTINO_OK=1.');
  process.exit(1);
}

/* Las contraseñas vienen del entorno, sin valor por defecto: el seed para antes
 * que crear una cuenta con una contraseña conocida. */
function claveDelEntorno(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor || valor.length < 12) {
    console.error(`Falta ${nombre}, o tiene menos de 12 caracteres.`);
    console.error(`Ejemplo:  ${nombre}='...' npx ts-node prisma/seed.ts`);
    process.exit(1);
  }
  return valor;
}

// Las comprobaciones van antes de main(): main() borra las tablas primero.
comprobarDestino();
const CLAVE_ADMIN = claveDelEntorno('SEED_ADMIN_PASSWORD');
const CLAVE_USUARIO = claveDelEntorno('SEED_USER_PASSWORD');

// 75 animes reales con variaciones tipográficas extremas (cortos, larguísimos, signos raros, kana/kanji)
const ANIME_CATALOG = [
  // --- TÍTULOS CORTOS ---
  {
    title: 'Monster',
    romaji: 'Monster',
    anilistId: 19,
    malId: 19,
    kitsuId: 19,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19-XSNRAOEsm4Eb.png',
    episodes: 74,
    genres: ['Drama', 'Mystery', 'Psychological', 'Thriller'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Nana',
    romaji: 'Nana',
    anilistId: 877,
    malId: 877,
    kitsuId: 785,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx877-abE22Xl00bH5.jpg',
    episodes: 47,
    genres: ['Drama', 'Music', 'Romance'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Bleach',
    romaji: 'Bleach',
    anilistId: 269,
    malId: 269,
    kitsuId: 245,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx269-eFwwZfy2357o.jpg',
    episodes: 366,
    genres: ['Action', 'Adventure', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'ERASED',
    romaji: 'Boku dake ga Inai Machi',
    anilistId: 21234,
    malId: 31043,
    kitsuId: 11181,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21234-vCdVOd1G0gG4.jpg',
    episodes: 12,
    genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'PSYCHO-PASS',
    romaji: 'Psycho-Pass',
    anilistId: 13601,
    malId: 13601,
    kitsuId: 7046,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx13601-e2q9FwY5xU7o.png',
    episodes: 22,
    genres: ['Action', 'Psychological', 'Sci-Fi', 'Thriller'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Cyberpunk: Edgerunners',
    romaji: 'Cyberpunk: Edgerunners',
    anilistId: 120377,
    malId: 42310,
    kitsuId: 43338,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx120377-5P98eW56qKjZ.jpg',
    episodes: 10,
    genres: ['Action', 'Sci-Fi'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Hyouka',
    romaji: 'Hyouka',
    anilistId: 12189,
    malId: 12189,
    kitsuId: 6767,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx12189-9rG0Wb4i42iE.png',
    episodes: 22,
    genres: ['Mystery', 'Slice of Life'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Dororo',
    romaji: 'Dororo',
    anilistId: 101347,
    malId: 37520,
    kitsuId: 41221,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101347-eL7yU8O5oD5j.jpg',
    episodes: 24,
    genres: ['Action', 'Adventure', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Vinland Saga',
    romaji: 'Vinland Saga',
    anilistId: 101348,
    malId: 37521,
    kitsuId: 41222,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101348-4xWp20qMhQZJ.jpg',
    episodes: 24,
    genres: ['Action', 'Adventure', 'Drama'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Mushishi',
    romaji: 'Mushishi',
    anilistId: 457,
    malId: 457,
    kitsuId: 419,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx457-3N91fPqE8f4y.png',
    episodes: 26,
    genres: ['Adventure', 'Fantasy', 'Mystery', 'Slice of Life', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },

  // --- TÍTULOS LARGOS DE NOVELAS LIGERAS (PONEN A PRUEBA TRUNCATE Y ALTURA) ---
  {
    title: 'Kono Subarashii Sekai ni Shukufuku wo! Kurenai Densetsu',
    romaji: 'Kono Subarashii Sekai ni Shukufuku wo! Kurenai Densetsu',
    anilistId: 102976,
    malId: 38040,
    kitsuId: 41530,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx102976-yY6rW4iRjO8l.jpg',
    episodes: 1,
    genres: ['Adventure', 'Comedy', 'Fantasy'],
    season: 'Película',
    seasonNumber: 1,
  },
  {
    title: 'Honzuki no Gekokujou: Shisho ni Naru Tame ni wa Shudan o Erande Iraremasen Season 3',
    romaji: 'Honzuki no Gekokujou Season 3',
    anilistId: 121176,
    malId: 42429,
    kitsuId: 43372,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx121176-BqP73wQ4dG5q.jpg',
    episodes: 10,
    genres: ['Fantasy', 'Slice of Life'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka IV: Shin Shou - Meikyuu-hen',
    romaji: 'DanMachi IV',
    anilistId: 129196,
    malId: 47164,
    kitsuId: 44026,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx129196-1k8rXwO9lM0b.jpg',
    episodes: 11,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    season: 'T4',
    seasonNumber: 4,
  },
  {
    title: 'Ore no Imouto ga Konna ni Kawaii Wake ga Nai.',
    romaji: 'OreImo Season 2',
    anilistId: 13659,
    malId: 13659,
    kitsuId: 7064,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx13659-4vM5p6r3u8s1.jpg',
    episodes: 16,
    genres: ['Comedy', 'Romance'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Yahari Ore no Seishun Love Come wa Machigatteiru. Kan',
    romaji: 'Oregairu Climax',
    anilistId: 108489,
    malId: 39547,
    kitsuId: 42203,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx108489-dZ4Y5oW4iK3m.jpg',
    episodes: 12,
    genres: ['Comedy', 'Drama', 'Romance', 'Slice of Life'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Itai no wa Iya nano de Bougyoryoku ni Kyokufuri Shitai to Omoimasu. 2',
    romaji: 'BOFURI Season 2',
    anilistId: 116528,
    malId: 41514,
    kitsuId: 43105,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx116528-7z6mN4iL5k2j.jpg',
    episodes: 12,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy', 'Sci-Fi'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Otome Game no Hametsu Flag shika Nai Akuyaku Reijou ni Tensei shiteshimatta... X',
    romaji: 'Hamefura X',
    anilistId: 120209,
    malId: 42282,
    kitsuId: 43314,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx120209-4v9rN2qO5k1j.jpg',
    episodes: 12,
    genres: ['Comedy', 'Fantasy', 'Romance'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Shinchou Yuusha: Kono Yuusha ga TUEEE Kuse ni Shinchou Sugiru',
    romaji: 'Cautious Hero',
    anilistId: 105156,
    malId: 38659,
    kitsuId: 41846,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx105156-pY5m8nN4kL2j.jpg',
    episodes: 12,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Tensei shitara Slime Datta Ken 3rd Season',
    romaji: 'Tensura Season 3',
    anilistId: 156822,
    malId: 53580,
    kitsuId: 46698,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx156822-uY9s8wR5mL3q.jpg',
    episodes: 24,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Maou Gakuin no Futekigousha: Shijou Saikyou no Maou no Shiso, Tensei shite Shison-tachi no Gakkou e Kayou II',
    romaji: 'The Misfit of Demon King Academy II',
    anilistId: 130588,
    malId: 48417,
    kitsuId: 44146,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130588-e2v7yQ5qW8l1.jpg',
    episodes: 12,
    genres: ['Action', 'Fantasy'],
    season: 'T2',
    seasonNumber: 2,
  },

  // --- SÍMBOLOS, GUIONES, PUNTUACIÓN Y CORCHETES ---
  {
    title: 'Re:ZERO -Starting Life in Another World- Season 2',
    romaji: 'Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season',
    anilistId: 108632,
    malId: 39587,
    kitsuId: 42207,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx108632-15T6q8zIlnzM.jpg',
    episodes: 13,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy', 'Psychological', 'Thriller'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'K-On!',
    romaji: 'K-On!',
    anilistId: 5680,
    malId: 5680,
    kitsuId: 4252,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5680-Jc0g0fU84I6Q.png',
    episodes: 13,
    genres: ['Comedy', 'Music', 'Slice of Life'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Fate/Zero 2nd Season',
    romaji: 'Fate/Zero 2nd Season',
    anilistId: 11741,
    malId: 11741,
    kitsuId: 6586,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11741-9Yg50mZJc8rF.png',
    episodes: 12,
    genres: ['Action', 'Fantasy', 'Supernatural'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Steins;Gate 0',
    romaji: 'Steins;Gate 0',
    anilistId: 21127,
    malId: 30484,
    kitsuId: 10817,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21127-xY7rW3bH8d2m.jpg',
    episodes: 23,
    genres: ['Drama', 'Sci-Fi', 'Thriller'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: '86: Eighty-Six Part 2',
    romaji: '86: Eighty-Six Part 2',
    anilistId: 131586,
    malId: 48569,
    kitsuId: 44265,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx131586-y9Q2xO7nL3m1.jpg',
    episodes: 12,
    genres: ['Action', 'Drama', 'Mecha', 'Sci-Fi'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Gintama°',
    romaji: 'Gintama°',
    anilistId: 20665,
    malId: 28977,
    kitsuId: 10072,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20665-u3dZ8qL9s1x5.png',
    episodes: 51,
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    season: 'T4',
    seasonNumber: 4,
  },
  {
    title: '【OSHI NO KO】Season 2',
    romaji: 'Oshi no Ko 2nd Season',
    anilistId: 166531,
    malId: 55791,
    kitsuId: 47683,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166531-uR9w8xP5mK3j.jpg',
    episodes: 13,
    genres: ['Drama', 'Mystery', 'Supernatural'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Mob Psycho 100 III',
    romaji: 'Mob Psycho 100 III',
    anilistId: 140439,
    malId: 50172,
    kitsuId: 45340,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140439-pY8mN5rW2xL1.jpg',
    episodes: 12,
    genres: ['Action', 'Comedy', 'Supernatural'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Neon Genesis Evangelion: The End of Evangelion',
    romaji: 'Shin Seiki Evangelion Gekijouban: Air/Magokoro wo, Kimi ni',
    anilistId: 32,
    malId: 32,
    kitsuId: 28,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx32-O97zB0U7m1uE.png',
    episodes: 1,
    genres: ['Drama', 'Mecha', 'Psychological', 'Sci-Fi'],
    season: 'Película',
    seasonNumber: 1,
  },
  {
    title: "JoJo's Bizarre Adventure: Golden Wind",
    romaji: 'JoJo no Kimyou na Bouken: Ougon no Kaze',
    anilistId: 102883,
    malId: 37991,
    kitsuId: 41484,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx102883-uQ7xM2nO8k4l.jpg',
    episodes: 39,
    genres: ['Action', 'Adventure', 'Supernatural'],
    season: 'T5',
    seasonNumber: 5,
  },
  {
    title: 'Kill la Kill',
    romaji: 'Kill la Kill',
    anilistId: 18679,
    malId: 18679,
    kitsuId: 7820,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx18679-5yZ47bT9I8u5.png',
    episodes: 24,
    genres: ['Action', 'Comedy'],
    season: 'T1',
    seasonNumber: 1,
  },

  // --- KANA Y KANJI NATIVOS ---
  {
    title: 'ぼっち・ざ・ろっく！',
    romaji: 'Bocchi the Rock!',
    anilistId: 130003,
    malId: 47917,
    kitsuId: 44093,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx130003-5edeHG2unTtB.png',
    episodes: 12,
    genres: ['Comedy', 'Music', 'Slice of Life'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: '葬送のフリーレン',
    romaji: 'Sousou no Frieren',
    anilistId: 154587,
    malId: 52991,
    kitsuId: 46474,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-n2hr0omrgn5f.jpg',
    episodes: 28,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: '鬼滅の刃 柱稽古編',
    romaji: 'Kimetsu no Yaiba: Hashira Geiko-hen',
    anilistId: 166240,
    malId: 55701,
    kitsuId: 47653,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166240-mY5k2wO5JtV1.png',
    episodes: 8,
    genres: ['Action', 'Fantasy', 'Supernatural'],
    season: 'T4',
    seasonNumber: 4,
  },
  {
    title: 'チェンソーマン',
    romaji: 'Chainsaw Man',
    anilistId: 127230,
    malId: 44511,
    kitsuId: 43806,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-FlochcFsyoF4.png',
    episodes: 12,
    genres: ['Action', 'Comedy', 'Drama', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: '進撃の巨人 The Final Season',
    romaji: 'Shingeki no Kyojin: The Final Season',
    anilistId: 110277,
    malId: 40028,
    kitsuId: 42422,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx110277-szH72u2Ds9yo.png',
    episodes: 16,
    genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
    season: 'T4',
    seasonNumber: 4,
  },
  {
    title: '呪術廻戦 懐玉・玉折 / 渋谷事変',
    romaji: 'Jujutsu Kaisen 2nd Season',
    anilistId: 145064,
    malId: 51009,
    kitsuId: 45866,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx145064-7Q41G1zIInjy.jpg',
    episodes: 23,
    genres: ['Action', 'Fantasy', 'Supernatural'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: '無職転生 II ～異世界行ったら本気だす～',
    romaji: 'Mushoku Tensei II: Isekai Ittara Honki Dasu',
    anilistId: 166873,
    malId: 55888,
    kitsuId: 47714,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166873-uY5p2zR8nN4j.jpg',
    episodes: 12,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: '薬屋のひとりごと',
    romaji: 'Kusuriya no Hitorigoto',
    anilistId: 161645,
    malId: 54492,
    kitsuId: 47094,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx161645-5F8rW4iRjO8l.jpg',
    episodes: 24,
    genres: ['Drama', 'Mystery'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'ダンジョン飯',
    romaji: 'Dungeon Meshi',
    anilistId: 153518,
    malId: 52701,
    kitsuId: 46358,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153518-7Fj7G9xLwX5M.jpg',
    episodes: 24,
    genres: ['Adventure', 'Comedy', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: '怪獣8号',
    romaji: 'Kaijuu 8-gou',
    anilistId: 153288,
    malId: 52588,
    kitsuId: 46332,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx153288-yY5m8nN4kL2j.jpg',
    episodes: 12,
    genres: ['Action', 'Sci-Fi'],
    season: 'T1',
    seasonNumber: 1,
  },

  // --- CATÁLOGO POPULAR ADICIONAL HASTA 70+ SERIES ---
  {
    title: 'SPY x FAMILY Season 2',
    romaji: 'Spy x Family Season 2',
    anilistId: 158870,
    malId: 53887,
    kitsuId: 46873,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx158870-pY5m8nN4kL2j.jpg',
    episodes: 12,
    genres: ['Action', 'Comedy'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Chihayafuru 3',
    romaji: 'Chihayafuru 3',
    anilistId: 101215,
    malId: 37379,
    kitsuId: 41183,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101215-kL7yU8O5oD5j.jpg',
    episodes: 24,
    genres: ['Drama', 'Sports'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Made in Abyss: Retsujitsu no Ougonkyou',
    romaji: 'Made in Abyss: The Golden City of the Scorching Sun',
    anilistId: 114745,
    malId: 41084,
    kitsuId: 42924,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx114745-zX8rW4iRjO8l.jpg',
    episodes: 12,
    genres: ['Adventure', 'Drama', 'Fantasy', 'Mystery', 'Sci-Fi'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Baccano!',
    romaji: 'Baccano!',
    anilistId: 2251,
    malId: 2251,
    kitsuId: 2038,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2251-sK9yU8O5oD5j.png',
    episodes: 13,
    genres: ['Action', 'Adventure', 'Mystery', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Cowboy Bebop',
    romaji: 'Cowboy Bebop',
    anilistId: 1,
    malId: 1,
    kitsuId: 1,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-CXtrrkMpJ8ig.png',
    episodes: 26,
    genres: ['Action', 'Adventure', 'Drama', 'Sci-Fi'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Samurai Champloo',
    romaji: 'Samurai Champloo',
    anilistId: 205,
    malId: 205,
    kitsuId: 181,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx205-i5r0Wb4i42iE.png',
    episodes: 26,
    genres: ['Action', 'Adventure', 'Comedy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Tengen Toppa Gurren Lagann',
    romaji: 'Tengen Toppa Gurren Lagann',
    anilistId: 2001,
    malId: 2001,
    kitsuId: 1797,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2001-e2q9FwY5xU7o.png',
    episodes: 27,
    genres: ['Action', 'Adventure', 'Comedy', 'Mecha', 'Sci-Fi'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Fullmetal Alchemist: Brotherhood',
    romaji: 'Hagane no Renkinjutsushi: Fullmetal Alchemist',
    anilistId: 5114,
    malId: 5114,
    kitsuId: 3936,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-1Q13cOaC4E9C.png',
    episodes: 64,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Hunter x Hunter (2011)',
    romaji: 'Hunter x Hunter (2011)',
    anilistId: 11061,
    malId: 11061,
    kitsuId: 6448,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx11061-6P2rW4iRjO8l.png',
    episodes: 148,
    genres: ['Action', 'Adventure', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Death Note',
    romaji: 'Death Note',
    anilistId: 1535,
    malId: 1535,
    kitsuId: 1376,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1535-lawiWSaLflHQ.jpg',
    episodes: 37,
    genres: ['Mystery', 'Psychological', 'Supernatural', 'Thriller'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'One Punch Man',
    romaji: 'One Punch Man',
    anilistId: 21087,
    malId: 30276,
    kitsuId: 10740,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21087-7z6mN4iL5k2j.jpg',
    episodes: 12,
    genres: ['Action', 'Comedy', 'Sci-Fi', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Violet Evergarden',
    romaji: 'Violet Evergarden',
    anilistId: 21827,
    malId: 33352,
    kitsuId: 12230,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21827-1DiH3uV6xV9e.png',
    episodes: 13,
    genres: ['Drama', 'Fantasy', 'Slice of Life'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Koe no Katachi',
    romaji: 'Koe no Katachi',
    anilistId: 20954,
    malId: 28851,
    kitsuId: 8935,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20954-UMhP1R4v9lM1.jpg',
    episodes: 1,
    genres: ['Drama', 'Romance', 'Slice of Life'],
    season: 'Película',
    seasonNumber: 1,
  },
  {
    title: 'Kimi no Na wa.',
    romaji: 'Kimi no Na wa.',
    anilistId: 21519,
    malId: 32281,
    kitsuId: 11614,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21519-5F8rW4iRjO8l.jpg',
    episodes: 1,
    genres: ['Drama', 'Romance', 'Supernatural'],
    season: 'Película',
    seasonNumber: 1,
  },
  {
    title: 'Kaguya-sama wa Kokurasetai: Ultra Romantic',
    romaji: 'Kaguya-sama: Love is War - Ultra Romantic',
    anilistId: 125367,
    malId: 43608,
    kitsuId: 43763,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx125367-uR9w8xP5mK3j.jpg',
    episodes: 13,
    genres: ['Comedy', 'Psychological', 'Romance', 'Slice of Life'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Boku no Hero Academia Season 7',
    romaji: 'My Hero Academia Season 7',
    anilistId: 163139,
    malId: 54789,
    kitsuId: 47214,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx163139-4v9rN2qO5k1j.jpg',
    episodes: 21,
    genres: ['Action', 'Adventure', 'Sci-Fi'],
    season: 'T7',
    seasonNumber: 7,
  },
  {
    title: 'Dr. STONE: New World Part 2',
    romaji: 'Dr. Stone: New World Part 2',
    anilistId: 162670,
    malId: 54856,
    kitsuId: 47260,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx162670-eL7yU8O5oD5j.jpg',
    episodes: 11,
    genres: ['Action', 'Adventure', 'Comedy', 'Sci-Fi'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Tokyo Ghoul',
    romaji: 'Tokyo Ghoul',
    anilistId: 20605,
    malId: 22319,
    kitsuId: 8213,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20605-e2q9FwY5xU7o.png',
    episodes: 12,
    genres: ['Action', 'Drama', 'Horror', 'Mystery', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Black Clover',
    romaji: 'Black Clover',
    anilistId: 97940,
    malId: 34572,
    kitsuId: 13207,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx97940-bY7rW3bH8d2m.jpg',
    episodes: 170,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Haikyuu!! To the Top',
    romaji: 'Haikyuu!! To the Top',
    anilistId: 106625,
    malId: 38883,
    kitsuId: 42023,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx106625-y9Q2xO7nL3m1.jpg',
    episodes: 13,
    genres: ['Comedy', 'Drama', 'Sports'],
    season: 'T4',
    seasonNumber: 4,
  },
  {
    title: 'Kuroko no Basket 3rd Season',
    romaji: 'Kuroko no Basket 3rd Season',
    anilistId: 20589,
    malId: 24415,
    kitsuId: 8527,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20589-pY8mN5rW2xL1.jpg',
    episodes: 25,
    genres: ['Comedy', 'Sports'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Code Geass: Hangyaku no Lelouch R2',
    romaji: 'Code Geass: Lelouch of the Rebellion R2',
    anilistId: 2904,
    malId: 2904,
    kitsuId: 2636,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2904-O97zB0U7m1uE.png',
    episodes: 25,
    genres: ['Action', 'Drama', 'Mecha', 'Sci-Fi', 'Thriller'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Toradora!',
    romaji: 'Toradora!',
    anilistId: 4224,
    malId: 4224,
    kitsuId: 3672,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx4224-uQ7xM2nO8k4l.png',
    episodes: 25,
    genres: ['Comedy', 'Drama', 'Romance', 'Slice of Life'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Clannad: After Story',
    romaji: 'Clannad: After Story',
    anilistId: 4181,
    malId: 4181,
    kitsuId: 3632,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx4181-5yZ47bT9I8u5.png',
    episodes: 24,
    genres: ['Drama', 'Romance', 'Supernatural'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Fate/stay night: Unlimited Blade Works 2nd Season',
    romaji: 'Fate/stay night [Unlimited Blade Works] 2nd Season',
    anilistId: 20792,
    malId: 28701,
    kitsuId: 9988,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20792-5edeHG2unTtB.png',
    episodes: 13,
    genres: ['Action', 'Fantasy', 'Supernatural'],
    season: 'T2',
    seasonNumber: 2,
  },
  {
    title: 'Puella Magi Madoka Magica',
    romaji: 'Mahou Shoujo Madoka★Magica',
    anilistId: 9756,
    malId: 9756,
    kitsuId: 5851,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9756-7Fj7G9xLwX5M.jpg',
    episodes: 12,
    genres: ['Action', 'Drama', 'Fantasy', 'Psychological', 'Thriller'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Ginga Eiyuu Densetsu',
    romaji: 'Legend of the Galactic Heroes',
    anilistId: 820,
    malId: 820,
    kitsuId: 737,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx820-n2hr0omrgn5f.jpg',
    episodes: 110,
    genres: ['Drama', 'Sci-Fi'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Bakemonogatari',
    romaji: 'Bakemonogatari',
    anilistId: 5081,
    malId: 5081,
    kitsuId: 3907,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5081-FlochcFsyoF4.png',
    episodes: 15,
    genres: ['Comedy', 'Drama', 'Mystery', 'Psychological', 'Romance', 'Supernatural'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'No Game No Life',
    romaji: 'No Game No Life',
    anilistId: 19815,
    malId: 19815,
    kitsuId: 7926,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19815-szH72u2Ds9yo.png',
    episodes: 12,
    genres: ['Adventure', 'Comedy', 'Ecchi', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Overlord IV',
    romaji: 'Overlord IV',
    anilistId: 133844,
    malId: 48895,
    kitsuId: 44529,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx133844-7Q41G1zIInjy.jpg',
    episodes: 13,
    genres: ['Action', 'Adventure', 'Fantasy'],
    season: 'T4',
    seasonNumber: 4,
  },
  {
    title: 'Tate no Yuusha no Nariagari Season 3',
    romaji: 'The Rising of the Shield Hero Season 3',
    anilistId: 111322,
    malId: 40357,
    kitsuId: 42533,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx111322-mY5k2wO5JtV1.png',
    episodes: 12,
    genres: ['Action', 'Adventure', 'Fantasy'],
    season: 'T3',
    seasonNumber: 3,
  },
  {
    title: 'Solo Leveling',
    romaji: 'Ore dake Level Up na Ken',
    anilistId: 151807,
    malId: 52299,
    kitsuId: 46197,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-uY5p2zR8nN4j.jpg',
    episodes: 12,
    genres: ['Action', 'Adventure', 'Fantasy'],
    season: 'T1',
    seasonNumber: 1,
  },
  {
    title: 'Kage no Jitsuryokusha ni Naritakute! 2nd Season',
    romaji: 'The Eminence in Shadow 2nd Season',
    anilistId: 163132,
    malId: 54595,
    kitsuId: 47190,
    cover: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx163132-uR9w8xP5mK3j.jpg',
    episodes: 12,
    genres: ['Action', 'Comedy', 'Fantasy'],
    season: 'T2',
    seasonNumber: 2,
  },
];

async function main() {
  console.log('🌱 Iniciando seed enriquecido de desarrollo para Sync Sekai...');

  // 1. Limpiar datos existentes en orden de dependencias
  await prisma.systemMetric.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.siteLink.deleteMany();
  await prisma.systemAnnouncement.deleteMany();
  await prisma.announcementPreset.deleteMany();
  await prisma.userFavorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.scrobbleHistory.deleteMany();
  await prisma.titleMapping.deleteMany();
  await prisma.blacklistEntry.deleteMany();
  await prisma.session.deleteMany();
  await prisma.animeConnection.deleteMany();
  await prisma.plexConnection.deleteMany();
  await prisma.jellyfinConnection.deleteMany();
  await prisma.embyConnection.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();

  // 2. Crear usuarios con roles y avatares variados
  // Un salt por contraseña: con uno compartido, dos contraseñas iguales dan el mismo hash.
  const adminPasswordHash = await bcrypt.hash(CLAVE_ADMIN, 10);
  const userPasswordHash = await bcrypt.hash(CLAVE_USUARIO, 10);

  // 2.1 SuperAdmin (ADMIN con conexiones Plex, Jellyfin, AniList, MAL)
  const superAdmin = await prisma.user.create({
    data: {
      userToken: 'usr_live_superadmin_2026',
      email: 'admin@plexsync.local',
      username: 'SuperAdmin',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      isActive: true,
      webhookToken: 'whk_live_superadmin_2026',
      avatarUrl: '/avatars/sakura.svg',
      settings: {
        create: {
          completionPercentage: 85,
          syncRatings: true,
          emailErrorAlerts: true,
          autoApproveMappings: true,
          preferredTracker: 'BOTH',
          blockedGenres: ['Hentai', 'Ecchi'],
          canScrobble: true,
          canAccessCatalog: true,
          canEditMappings: true,
          canSyncAnilist: true,
          canSyncMal: true,
          canSyncKitsu: true,
          isSuspended: false,
          themeMode: 'dark',
          themePalette: 'sync',
        },
      },
      plexConnection: {
        create: {
          serverName: 'Plex-Master-Server',
          serverUrl: 'http://127.0.0.1:32400',
          plexUsername: 'SuperAdmin',
          encryptedAuthToken: 'enc_plex_token_mock_12345',
          isConnected: true,
          monitoredLibraries: ['Anime HD', 'Películas Anime', 'Temporada Actual'],
          lastSyncAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      },
      jellyfinConnection: {
        create: {
          serverName: 'Jellyfin-Otaku-Box',
          serverUrl: 'http://127.0.0.1:8096',
          jellyfinUsername: 'SuperAdmin',
          encryptedApiKey: 'enc_jellyfin_api_key_mock_12345',
          isConnected: true,
          monitoredLibraries: ['Anime 1080p', 'Anime 4K HDR'],
          lastSyncAt: new Date(Date.now() - 45 * 60 * 1000),
        },
      },
      embyConnection: {
        create: {
          serverName: 'Emby-Cinema-Core',
          serverUrl: 'http://127.0.0.1:8097',
          embyUsername: 'SuperAdmin',
          encryptedApiKey: 'enc_emby_api_key_mock_12345',
          isConnected: false,
          monitoredLibraries: ['Anime Clásicos'],
          lastSyncAt: null,
        },
      },
      // IDs sintéticos: los datos de prueba no dependen de cuentas reales.
      animeConnections: {
        create: [
          {
            provider: AnimeProvider.ANILIST,
            isConnected: true,
            encryptedAccessToken: 'enc_mock_anilist_token_2026',
            remoteUserId: '1000001',
            remoteUsername: 'SuperAdmin_AL',
            avatarUrl: 'https://s4.anilist.co/file/anilistcdn/user/avatar/large/default.png',
            lastLatencyMs: 24,
            lastCheckedAt: new Date(),
          },
          {
            provider: AnimeProvider.MAL,
            isConnected: true,
            encryptedAccessToken: 'enc_mock_mal_token_2026',
            remoteUserId: '1000002',
            remoteUsername: 'SuperAdmin_MAL',
            avatarUrl: 'https://cdn.myanimelist.net/images/userimages/default.jpg',
            lastLatencyMs: 42,
            lastCheckedAt: new Date(),
          },
          {
            provider: AnimeProvider.KITSU,
            isConnected: true,
            encryptedAccessToken: 'enc_mock_kitsu_token_2026',
            remoteUserId: '1000003',
            remoteUsername: 'SuperAdmin_Kitsu',
            avatarUrl: '/avatars/torii.svg',
            lastLatencyMs: 65,
            lastCheckedAt: new Date(),
          },
        ],
      },
    },
  });

  // 2.2 AlexOtaku (Usuario activo habitual con avatar de gato)
  const alexUser = await prisma.user.create({
    data: {
      userToken: 'usr_live_alex_2026',
      email: 'alex@plexsync.local',
      username: 'AlexOtaku',
      passwordHash: userPasswordHash,
      role: Role.USER,
      isActive: true,
      webhookToken: 'whk_live_alex_2026',
      avatarUrl: '/avatars/gato.svg',
      settings: {
        create: {
          completionPercentage: 80,
          preferredTracker: 'ANILIST',
          themeMode: 'dark',
          themePalette: 'plex',
        },
      },
      plexConnection: {
        create: {
          serverName: 'Alex-Plex',
          serverUrl: 'http://192.168.1.100:32400',
          plexUsername: 'AlexOtaku',
          encryptedAuthToken: 'enc_alex_token',
          isConnected: true,
          monitoredLibraries: ['Anime'],
        },
      },
    },
  });

  // 2.3 LunaAnime (Usuario activo con avatar de luna y modo claro preferido)
  const lunaUser = await prisma.user.create({
    data: {
      userToken: 'usr_live_luna_2026',
      email: 'luna@plexsync.local',
      username: 'LunaAnime',
      passwordHash: userPasswordHash,
      role: Role.USER,
      isActive: true,
      webhookToken: 'whk_live_luna_2026',
      avatarUrl: '/avatars/luna.svg',
      settings: {
        create: {
          completionPercentage: 90,
          preferredTracker: 'MAL',
          themeMode: 'light',
          themePalette: 'sync',
        },
      },
    },
  });

  // 2.4 SpamBot (Usuario suspendido con avatar de casete)
  await prisma.user.create({
    data: {
      userToken: 'usr_live_spambot_2026',
      email: 'spambot@blocked.local',
      username: 'SpamBot',
      passwordHash: userPasswordHash,
      role: Role.USER,
      isActive: false,
      webhookToken: 'whk_live_spambot_2026',
      avatarUrl: '/avatars/casete.svg',
      settings: {
        create: {
          isSuspended: true,
        },
      },
    },
  });

  // 2.5 UsuarioVacio (Usuario nuevo sin actividad, scrobbles ni conexiones para probar estados vacíos)
  await prisma.user.create({
    data: {
      userToken: 'usr_live_nuevo_2026',
      email: 'nuevo@plexsync.local',
      username: 'UsuarioVacio',
      passwordHash: userPasswordHash,
      role: Role.USER,
      isActive: true,
      webhookToken: 'whk_live_nuevo_2026',
      avatarUrl: '/avatars/brote.svg',
      settings: {
        create: {
          completionPercentage: 85,
          preferredTracker: 'BOTH',
          themeMode: 'dark',
          themePalette: 'sync',
        },
      },
    },
  });

  console.log('✅ 5 usuarios creados con diversos roles y avatares.');

  // 3. Crear Mapeos de Títulos (Globales, Individuales y Pendientes)
  for (let i = 0; i < ANIME_CATALOG.length; i++) {
    const a = ANIME_CATALOG[i];
    // 85% aprobados, 15% pendientes con score bajo para auditar la bandeja de pendientes
    const isApproved = i % 7 !== 0;
    const isGlobal = i < 40;
    const isManual = i % 5 === 0;
    const confidenceScore = isApproved ? 0.95 + (i % 5) * 0.01 : 0.65 + (i % 20) * 0.01;

    await prisma.titleMapping.create({
      data: {
        userId: superAdmin.id,
        plexTitle: a.title,
        plexSeason: a.seasonNumber,
        anilistMediaId: a.anilistId,
        anilistTitle: a.title,
        malMediaId: a.malId,
        malTitle: a.romaji,
        kitsuMediaId: a.kitsuId,
        kitsuTitle: a.title,
        confidenceScore: Math.min(1.0, confidenceScore),
        isApproved,
        isGlobal,
        isManual,
      },
    });
  }
  console.log(`✅ ${ANIME_CATALOG.length} mapeos de títulos creados.`);

  // 4. Crear 500 Scrobbles realistas en los últimos 90 días
  const now = Date.now();
  const scrobbleSources = ['PLEX', 'JELLYFIN', 'EMBY'];

  // Generar curva natural: más actividad los fines de semana y descansos
  let scrobblesCount = 0;
  for (let d = 90; d >= 0; d--) {
    const dayDate = new Date(now - d * 24 * 60 * 60 * 1000);
    const dayOfWeek = dayDate.getDay(); // 0 domingo, 6 sábado
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Algunos días vacíos intencionados (crea valles realistas en la gráfica)
    if (d % 11 === 0) continue;

    // Entre 4 y 11 reproducciones diarias (más en fin de semana)
    const dailyCount = isWeekend ? Math.floor(Math.random() * 6) + 6 : Math.floor(Math.random() * 4) + 4;

    for (let s = 0; s < dailyCount; s++) {
      scrobblesCount++;
      const anime = ANIME_CATALOG[Math.floor(Math.random() * ANIME_CATALOG.length)];
      const episodeNumber = Math.floor(Math.random() * Math.min(24, anime.episodes)) + 1;
      const hourOffset = Math.floor(Math.random() * 14) + 9; // entre 9am y 11pm
      const minuteOffset = Math.floor(Math.random() * 59);
      const scrobbleTime = new Date(dayDate.getTime() + (hourOffset * 3600 + minuteOffset * 60) * 1000);

      // Mezcla de estados:
      // 82% SUCCESS, 10% FAILED, 5% PENDING, 3% SKIPPED
      const roll = Math.random();
      let anilistStatus: SyncStatus = SyncStatus.SUCCESS;
      let malStatus: SyncStatus = SyncStatus.SUCCESS;
      let kitsuStatus: SyncStatus = SyncStatus.SUCCESS;
      let errorMessage: string | null = null;

      if (roll < 0.10) {
        // Fallos de sincronización con mensajes realistas
        anilistStatus = SyncStatus.FAILED;
        malStatus = Math.random() > 0.5 ? SyncStatus.SUCCESS : SyncStatus.FAILED;
        kitsuStatus = SyncStatus.SUCCESS;
        const errType = Math.floor(Math.random() * 4);
        if (errType === 0) errorMessage = 'AniList API: Rate limit 429 exceeded. Retry after 60s.';
        else if (errType === 1) errorMessage = 'MyAnimeList: Invalid OAuth token (HTTP 401). Token refresh failed.';
        else if (errType === 2) errorMessage = `Metadata mismatch: Episode ${episodeNumber + 12} exceeds known total episodes (${anime.episodes}) on tracker.`;
        else errorMessage = 'Network timeout: Connection to AniList GraphQL gateway aborted after 15000ms.';
      } else if (roll < 0.15) {
        // Pendientes en cola
        anilistStatus = SyncStatus.PENDING;
        malStatus = SyncStatus.PENDING;
        kitsuStatus = SyncStatus.PENDING;
      } else if (roll < 0.18) {
        // Ignorados por regla de lista negra
        anilistStatus = SyncStatus.SKIPPED;
        malStatus = SyncStatus.SKIPPED;
        kitsuStatus = SyncStatus.SKIPPED;
        errorMessage = 'Ignorado: El título coincide con la regla de exclusión de lista negra.';
      }

      const rating = Math.random() > 0.4 ? Number((Math.random() * 3 + 7).toFixed(1)) : null; // 7.0 a 10.0
      const source = scrobbleSources[Math.floor(Math.random() * scrobbleSources.length)];

      await prisma.scrobbleHistory.create({
        data: {
          userId: superAdmin.id,
          showTitle: anime.title,
          episodeNumber,
          seasonNumber: anime.seasonNumber,
          viewPercentage: Math.floor(Math.random() * 15) + 85,
          rating,
          anilistStatus,
          malStatus,
          kitsuStatus,
          source,
          serverName: source === 'JELLYFIN' ? 'Jellyfin-Otaku-Box' : source === 'EMBY' ? 'Emby-Cinema-Core' : 'Plex-Master-Server',
          libraryName: 'Anime HD',
          errorMessage,
          viewedAt: scrobbleTime,
          createdAt: scrobbleTime,
        },
      });
    }
  }
  console.log(`✅ ${scrobblesCount} registros de scrobble generados en 90 días con curvas realistas.`);

  // 5. Crear Favoritos del usuario SuperAdmin (para catálogo y filtros)
  const favoriteAnimes = ANIME_CATALOG.slice(0, 18);
  for (const fav of favoriteAnimes) {
    await prisma.userFavorite.create({
      data: {
        userId: superAdmin.id,
        animeId: String(fav.anilistId),
        title: fav.title,
        coverUrl: fav.cover,
        genres: fav.genres,
      },
    });
  }
  console.log(`✅ ${favoriteAnimes.length} animes favoritos creados.`);

  // 6. Crear Entradas de Lista Negra
  const blacklistRules = [
    { titlePattern: 'Overflow', reason: 'Contenido para Adultos / NSFW no deseado en trackers públicos' },
    { titlePattern: 'Redo of Healer', reason: 'Contenido para Adultos / NSFW' },
    { titlePattern: 'Yosuga no Sora', reason: 'Privacidad de cuenta personal' },
    { titlePattern: 'Interspecies Reviewers', reason: 'Contenido para Adultos / NSFW' },
    { titlePattern: 'Naruto Shippuden (Relleno)', reason: 'Episodios no canónicos / Relleno irrelevante' },
    { titlePattern: 'Bleach (Bount Arc)', reason: 'Saga de relleno omitida de tracking' },
    { titlePattern: '^\\[RAW\\].*$', reason: 'Archivos RAW de captura antes de procesamiento' },
    { titlePattern: 'One Piece (Especiales)', reason: 'Cortos y episodios promocionales de TV' },
  ];

  for (const b of blacklistRules) {
    await prisma.blacklistEntry.create({
      data: {
        userId: superAdmin.id,
        titlePattern: b.titlePattern,
        reason: b.reason,
      },
    });
  }
  console.log(`✅ ${blacklistRules.length} reglas de lista negra creadas.`);

  // 7. Crear Enlaces del Pie (Panel > Enlaces del pie)
  const siteLinks = [
    {
      kind: SiteLinkKind.SOCIAL,
      provider: 'discord',
      label: 'Discord',
      url: 'https://discord.gg/syncsekai',
      isEnabled: true,
      sortOrder: 1,
    },
    {
      kind: SiteLinkKind.SOCIAL,
      provider: 'github',
      label: 'GitHub',
      url: 'https://github.com/mr4r3n/PlexSync',
      isEnabled: true,
      sortOrder: 2,
    },
    {
      kind: SiteLinkKind.SOCIAL,
      provider: 'x',
      label: 'X / Twitter',
      url: 'https://x.com/syncsekai',
      isEnabled: true,
      sortOrder: 3,
    },
    {
      kind: SiteLinkKind.FRIEND,
      provider: null,
      label: 'AnimeThemes',
      url: 'https://animethemes.moe',
      description: 'El mayor archivo comunitario de aperturas y finales de anime en alta definición.',
      iconUrl: 'https://animethemes.moe/favicon.ico',
      isEnabled: true,
      sortOrder: 4,
    },
    {
      kind: SiteLinkKind.FRIEND,
      provider: null,
      label: 'AniList',
      url: 'https://anilist.co',
      description: 'Plataforma moderna de seguimiento de anime y manga con API GraphQL abierta.',
      iconUrl: 'https://anilist.co/img/icons/icon.svg',
      isEnabled: true,
      sortOrder: 5,
    },
    {
      kind: SiteLinkKind.FRIEND,
      provider: null,
      label: 'Jellyfin',
      url: 'https://jellyfin.org',
      description: 'El servidor multimedia de código abierto, autónomo y sin telemetría.',
      iconUrl: 'https://jellyfin.org/images/favicon.png',
      isEnabled: true,
      sortOrder: 6,
    },
  ];

  for (const l of siteLinks) {
    await prisma.siteLink.create({ data: l });
  }
  console.log(`✅ ${siteLinks.length} enlaces de pie (redes y recomendados) creados.`);

  // 8. Crear Anuncio Activo del Sistema
  await prisma.systemAnnouncement.create({
    data: {
      isActive: true,
      category: 'INFO',
      themePreset: 'INFO',
      badgeText: 'v2.4.0',
      badgeBgColor: 'rgba(255, 99, 74, 0.2)',
      badgeTextColor: '#FF634A',
      message: '🎉 ¡Sync Sekai 2.4 ya está disponible! Soporte nativo para Jellyfin y Emby, scrobbling bidireccional y visor de catálogo renovado.',
      mediaType: 'NONE',
      backgroundType: 'GRADIENT',
      backgroundValue: 'linear-gradient(90deg, rgba(255,99,74,0.15) 0%, rgba(37,37,37,0.85) 100%)',
      textColor: '#FFFFFF',
      effectType: 'NONE',
      enableGlobalAtmosphere: false,
      ctaText: 'Ver Catálogo',
      ctaUrl: '/catalog',
      ctaTarget: '_self',
      ctaBgColor: '#FF634A',
      ctaTextColor: '#FFFFFF',
      isClosable: true,
      targetAudience: 'ALL',
      dismissExpiryDays: 7,
    },
  });
  console.log('✅ Anuncio activo del sistema creado.');

  // 9. Crear Tickets de Soporte con Conversación
  // Ticket 1: Técnico (Jellyfin Scrobble)
  const ticket1 = await prisma.ticket.create({
    data: {
      userId: alexUser.id,
      assignedAdminId: superAdmin.id,
      subject: 'Problema al scrobblear el episodio 8 de Bocchi the Rock! desde Jellyfin',
      category: TicketCategory.SCROBBLE_SYNC,
      priority: TicketPriority.HIGH,
      status: TicketStatus.IN_PROGRESS,
      lastReplyAt: new Date(Date.now() - 2 * 3600 * 1000),
      messages: {
        create: [
          {
            senderId: alexUser.id,
            isStaff: false,
            content: 'Hola, ayer estuve viendo Bocchi the Rock! en el cliente de Jellyfin para Android TV y el episodio 8 llegó al 100%, pero en el historial de Sync Sekai aparece como fallido con error de Rate Limit. ¿Podríais revisarlo?',
            createdAt: new Date(Date.now() - 5 * 3600 * 1000),
          },
          {
            senderId: superAdmin.id,
            isStaff: true,
            content: 'Buenas Alex. He revisado los registros del servidor y efectivamente la API de AniList devolvió un código 429 temporal debido a una ráfaga de peticiones simultáneas. Hemos reintentado el scrobble automáticamente y ya debería constar como completado en tu perfil. ¿Nos confirmas si lo ves bien?',
            createdAt: new Date(Date.now() - 3 * 3600 * 1000),
          },
          {
            senderId: alexUser.id,
            isStaff: false,
            content: '¡Perfecto! Ya lo veo reflejado correctamente tanto en la web como en mi cuenta de AniList. ¡Muchas gracias por la rapidez!',
            createdAt: new Date(Date.now() - 2 * 3600 * 1000),
          },
        ],
      },
    },
  });

  // Ticket 2: Mapeo de Título Pendiente
  await prisma.ticket.create({
    data: {
      userId: lunaUser.id,
      subject: 'Sugerencia de mapeo: Tensei shitara Slime Datta Ken 3rd Season',
      category: TicketCategory.MAPPINGS,
      priority: TicketPriority.NORMAL,
      status: TicketStatus.OPEN,
      lastReplyAt: new Date(Date.now() - 12 * 3600 * 1000),
      messages: {
        create: [
          {
            senderId: lunaUser.id,
            isStaff: false,
            content: 'Hola equipo, en mi servidor de Plex la temporada 3 de Slime se llama "That Time I Got Reincarnated as a Slime S3" y el mapeo automático le asignó un 72% de confianza. Creo que sería bueno añadirlo a los alias globales para que otros usuarios no tengan que aprobarlo a mano.',
            createdAt: new Date(Date.now() - 12 * 3600 * 1000),
          },
        ],
      },
    },
  });

  // Ticket 3: Resuelto (Seguridad 2FA)
  await prisma.ticket.create({
    data: {
      userId: alexUser.id,
      assignedAdminId: superAdmin.id,
      subject: 'Consulta sobre generación de códigos de respaldo 2FA',
      category: TicketCategory.ACCOUNT,
      priority: TicketPriority.LOW,
      status: TicketStatus.RESOLVED,
      closedAt: new Date(Date.now() - 24 * 3600 * 1000),
      lastReplyAt: new Date(Date.now() - 24 * 3600 * 1000),
      messages: {
        create: [
          {
            senderId: alexUser.id,
            isStaff: false,
            content: '¿Dónde puedo volver a ver mis códigos de respaldo de doble factor si extravié la nota guardada?',
            createdAt: new Date(Date.now() - 48 * 3600 * 1000),
          },
          {
            senderId: superAdmin.id,
            isStaff: true,
            content: 'Hola Alex, por motivos de seguridad criptográfica los códigos de respaldo se cifran con un hash irreversible y solo se muestran una vez al generarlos. Puedes regenerar un juego nuevo en Ajustes > Seguridad > Códigos de Respaldo tras introducir tu clave actual.',
            createdAt: new Date(Date.now() - 26 * 3600 * 1000),
          },
          {
            senderId: alexUser.id,
            isStaff: false,
            content: 'Resuelto, ya he generado un juego nuevo y lo he guardado en mi gestor de contraseñas. Podéis cerrar el ticket.',
            createdAt: new Date(Date.now() - 24 * 3600 * 1000),
          },
        ],
      },
    },
  });
  console.log('✅ 3 tickets de soporte con conversación real creados.');

  // 10. Crear Métricas GeoIP para el Mapa de Administración (/admin/geo)
  const geoLocations = [
    { ip: '88.12.45.101', city: 'Madrid', country: 'España', code: 'ES', region: 'Comunidad de Madrid', lat: 40.4168, lon: -3.7038, isp: 'Telefónica de España', visits: 42 },
    { ip: '80.58.67.22', city: 'Barcelona', country: 'España', code: 'ES', region: 'Catalunya', lat: 41.3879, lon: 2.16992, isp: 'Vodafone Ono', visits: 29 },
    { ip: '189.217.55.4', city: 'Ciudad de México', country: 'México', code: 'MX', region: 'CDMX', lat: 19.4326, lon: -99.1332, isp: 'Uninet / Telmex', visits: 35 },
    { ip: '201.149.88.9', city: 'Guadalajara', country: 'México', code: 'MX', region: 'Jalisco', lat: 20.6597, lon: -103.3496, isp: 'Megacable', visits: 18 },
    { ip: '190.191.22.4', city: 'Buenos Aires', country: 'Argentina', code: 'AR', region: 'CABA', lat: -34.6037, lon: -58.3816, isp: 'Telecom Argentina', visits: 24 },
    { ip: '190.161.44.8', city: 'Santiago', country: 'Chile', code: 'CL', region: 'Metropolitana', lat: -33.4489, lon: -70.6693, isp: 'VTR Comunicaciones', visits: 16 },
    { ip: '133.242.18.2', city: 'Tokyo', country: 'Japón', code: 'JP', region: 'Kanto', lat: 35.6762, lon: 139.6503, isp: 'SAKURA Internet', visits: 14 },
    { ip: '104.28.19.44', city: 'New York', country: 'Estados Unidos', code: 'US', region: 'New York', lat: 40.7128, lon: -74.006, isp: 'Cloudflare Inc.', visits: 38 },
    { ip: '172.56.21.90', city: 'Los Angeles', country: 'Estados Unidos', code: 'US', region: 'California', lat: 34.0522, lon: -118.2437, isp: 'T-Mobile USA', visits: 21 },
    { ip: '178.62.199.3', city: 'Frankfurt', country: 'Alemania', code: 'DE', region: 'Hesse', lat: 50.1109, lon: 8.6821, isp: 'DigitalOcean LLC', visits: 12 },
    { ip: '51.15.88.10', city: 'París', country: 'Francia', code: 'FR', region: 'Île-de-France', lat: 48.8566, lon: 2.3522, isp: 'Scaleway', visits: 10 },
  ];

  const dateKey = new Date().toISOString().split('T')[0];
  for (const g of geoLocations) {
    await prisma.systemMetric.create({
      data: {
        metricKey: 'daily_visit',
        ipAddress: g.ip,
        dateKey,
        value: g.visits,
        metadata: {
          city: g.city,
          country: g.country,
          code: g.code,
          region: g.region,
          lat: g.lat,
          lon: g.lon,
          isp: g.isp,
        },
      },
    });
  }
  console.log(`✅ ${geoLocations.length} métricas GeoIP registradas para el mapa.`);

  // 11. Crear Registros de Auditoría (/admin/logs)
  const auditLogs = [
    { level: 'INFO', service: 'AUTH', message: 'Inicio de sesión exitoso mediante credenciales para SuperAdmin', details: { ip: '127.0.0.1', userAgent: 'Mozilla/5.0 Chrome/128' } },
    { level: 'INFO', service: 'SCROBBLE', message: 'Webhook recibido de Plex Media Server: Sousou no Frieren Ep. 28', details: { show: 'Sousou no Frieren', season: 1, ep: 28, viewPct: 96 } },
    { level: 'INFO', service: 'MAPPINGS', message: 'Mapeo resuelto automáticamente con confianza 1.0 para Sousou no Frieren -> AniList 154587', details: { confidence: 1.0 } },
    { level: 'WARN', service: 'SCROBBLE', message: 'AniList API rate limit aproximándose al umbral (78/90 req/min)', details: { remaining: 12, resetSeconds: 45 } },
    { level: 'ERROR', service: 'TRACKER', message: 'Fallo al comunicar con MyAnimeList OAuth token endpoint: HTTP 401 Unauthorized', details: { endpoint: 'https://myanimelist.net/v1/oauth2/token', status: 401 } },
    { level: 'INFO', service: 'JELLYFIN', message: 'Servidor Jellyfin-Otaku-Box sincronizó biblioteca Anime 1080p con éxito (142 elementos analizados)', details: { items: 142 } },
    { level: 'INFO', service: 'SYSTEM', message: 'Limpieza periódica de archivos temporales de portadas completada: 0 huérfanos eliminados', details: { deleted: 0 } },
    { level: 'WARN', service: 'BLACKLIST', message: 'Reproducción excluida por regla de lista negra "Overflow"', details: { rule: 'Overflow', user: 'SuperAdmin' } },
    { level: 'INFO', service: 'TICKETS', message: 'Nuevo ticket de soporte #1001 asignado a SuperAdmin', details: { ticketId: ticket1.id } },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`✅ ${auditLogs.length} logs de auditoría registrados.`);

  console.log('\n=============================================================');
  console.log('🎉 BASE DE DATOS SEMBRADA CON ÉXITO PARA AUDITORÍA DE UI');
  console.log('=============================================================');
  // Se nombra la variable, no el valor, para no dejar la contraseña en el log.
  console.log('Cuentas creadas:');
  console.log('-------------------------------------------------------------');
  console.log('👤 Administrador: admin@plexsync.local   | SEED_ADMIN_PASSWORD');
  console.log('👤 Usuario Normal: alex@plexsync.local    | SEED_USER_PASSWORD');
  console.log('👤 Usuario Vacío:  nuevo@plexsync.local   | SEED_USER_PASSWORD');
  console.log('=============================================================\n');
}

main()
  .catch((e) => {
    console.error('Error durante la ejecución del seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
