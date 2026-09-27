/**
 * Demo user for the public /demo page.
 *
 *     SEED_DEMO_PASSWORD=... npx ts-node -T scripts/seed-demo-user.ts
 *
 * Creates (or recreates) `demo@syncsekai.local` in the LOCAL test database with a
 * believable library: 20 anime (20 % popular 2020–2025, 10 % lesser-known
 * 2010–2018, the rest 2000–today), two weeks of watching plus older finished
 * series, a few manual mappings, a community one and one pending approval.
 * frontend/scripts/record-demo-data.mjs then records what the API answers for
 * this user; that recording is what /demo shows. Never run it against production.
 */
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { MappingSource, SyncStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EncryptionService } from '../src/common/crypto/encryption.service';

const EMAIL = 'demo@syncsekai.local';
const DAY = 86_400_000;

type Anime = {
  anilistId: number; malId: number; title: string; plexTitle: string; episodes: number;
  watched: number; source?: 'MANUAL' | 'COMMUNITY'; pending?: boolean; server?: 'PLEX' | 'JELLYFIN';
};

// watched === episodes -> finished long ago; watched < episodes -> watching now.
const ANIME: Anime[] = [
  // Popular, 2020–2025 (4)
  { anilistId: 154587, malId: 52991, title: 'Sousou no Frieren', plexTitle: "Frieren: Beyond Journey's End", episodes: 28, watched: 16, source: 'MANUAL' },
  { anilistId: 113415, malId: 40748, title: 'Jujutsu Kaisen', plexTitle: 'Jujutsu Kaisen', episodes: 24, watched: 24 },
  { anilistId: 151807, malId: 52299, title: 'Ore dake Level Up na Ken', plexTitle: 'Solo Leveling', episodes: 12, watched: 7, source: 'COMMUNITY' },
  { anilistId: 171018, malId: 57334, title: 'Dandadan', plexTitle: 'Dan Da Dan', episodes: 12, watched: 9, server: 'JELLYFIN' },
  // Lesser-known, 2010–2018 (2)
  { anilistId: 20722, malId: 22789, title: 'Barakamon', plexTitle: 'Barakamon', episodes: 12, watched: 12 },
  { anilistId: 21284, malId: 31376, title: 'Flying Witch', plexTitle: 'Flying Witch', episodes: 12, watched: 5, server: 'JELLYFIN' },
  // 2000–today (14)
  { anilistId: 205, malId: 205, title: 'Samurai Champloo', plexTitle: 'Samurai Champloo', episodes: 26, watched: 26 },
  { anilistId: 329, malId: 329, title: 'Planetes', plexTitle: 'Planetes', episodes: 26, watched: 26 },
  { anilistId: 457, malId: 457, title: 'Mushishi', plexTitle: 'Mushi-Shi', episodes: 26, watched: 26 },
  { anilistId: 4224, malId: 4224, title: 'Toradora!', plexTitle: 'Toradora!', episodes: 25, watched: 25 },
  { anilistId: 10165, malId: 10165, title: 'Nichijou', plexTitle: 'Nichijou - My Ordinary Life', episodes: 26, watched: 4, pending: true },
  { anilistId: 20607, malId: 22135, title: 'Ping Pong THE ANIMATION', plexTitle: 'Ping Pong the Animation', episodes: 11, watched: 11 },
  { anilistId: 20464, malId: 20583, title: 'Haikyuu!!', plexTitle: 'Haikyu!!', episodes: 25, watched: 25 },
  { anilistId: 21366, malId: 31646, title: '3-gatsu no Lion', plexTitle: 'March Comes in Like a Lion', episodes: 22, watched: 22, source: 'MANUAL' },
  { anilistId: 21507, malId: 32182, title: 'Mob Psycho 100', plexTitle: 'Mob Psycho 100', episodes: 12, watched: 12 },
  { anilistId: 21827, malId: 33352, title: 'Violet Evergarden', plexTitle: 'Violet Evergarden', episodes: 13, watched: 13 },
  { anilistId: 101348, malId: 37521, title: 'VINLAND SAGA', plexTitle: 'Vinland Saga', episodes: 24, watched: 11, server: 'JELLYFIN' },
  { anilistId: 128547, malId: 46102, title: 'Odd Taxi', plexTitle: 'ODDTAXI', episodes: 13, watched: 13 },
  { anilistId: 140960, malId: 50265, title: 'SPY×FAMILY', plexTitle: 'Spy x Family', episodes: 12, watched: 12 },
  { anilistId: 130003, malId: 47917, title: 'Bocchi the Rock!', plexTitle: 'Bocchi the Rock!', episodes: 12, watched: 12 },
];
const FAVORITES = [154587, 457, 130003];

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error('Set SEED_DEMO_PASSWORD (12+ characters).');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const enc = app.get(EncryptionService);
  try {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const now = Date.now();
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        username: 'Hikari',
        passwordHash: await bcrypt.hash(password, 10),
        isActive: true,
        userToken: `usr_live_demo${now.toString(36)}`,
        webhookToken: `whk_live_demo${now.toString(36)}`,
        createdAt: new Date(now - 120 * DAY),
        settings: { create: { completionPercentage: 85, preferredTracker: 'BOTH' } },
        plexConnection: {
          create: {
            serverName: 'Living Room Plex', serverUrl: 'http://plex.home.arpa:32400', plexUsername: 'hikari',
            encryptedAuthToken: enc.encrypt('demo'), monitoredLibraries: ['Anime'], isConnected: true,
            lastSyncAt: new Date(now - 2 * 3600_000),
          },
        },
        jellyfinConnection: {
          create: {
            serverName: 'Bedroom Jellyfin', serverUrl: 'http://jellyfin.home.arpa:8096', jellyfinUsername: 'hikari',
            encryptedApiKey: enc.encrypt('demo'), monitoredLibraries: ['Anime'], isConnected: true,
            lastSyncAt: new Date(now - 26 * 3600_000),
          },
        },
      },
    });
    for (const [provider, remoteUsername] of [['ANILIST', 'hikari'], ['MAL', 'hikari_mal']] as const) {
      await prisma.animeConnection.create({
        data: {
          userId: user.id, provider, remoteUsername, remoteUserId: '1', encryptedAccessToken: enc.encrypt('demo'),
          isConnected: true, lastLatencyMs: provider === 'ANILIST' ? 212 : 348, lastCheckedAt: new Date(now - 600_000),
        },
      });
    }

    // Deterministic pseudo-random, so re-running gives the same library.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const evening = (daysAgo: number) => {
      const d = new Date(now - daysAgo * DAY);
      d.setHours(19 + Math.floor(rnd() * 4), Math.floor(rnd() * 60), 0, 0);
      return d;
    };

    let finishedBlock = 30;
    for (const a of ANIME) {
      await prisma.titleMapping.create({
        data: {
          userId: user.id, plexTitle: a.plexTitle, plexSeason: 1, anilistMediaId: a.anilistId, anilistTitle: a.title,
          malMediaId: a.malId, malTitle: a.title, confidenceScore: a.source ? 1 : 0.95,
          isApproved: !a.pending, isManual: a.source === 'MANUAL',
          source: a.source === 'MANUAL' ? MappingSource.MANUAL : a.source === 'COMMUNITY' ? MappingSource.COMMUNITY : MappingSource.AUTO,
          createdAt: new Date(now - 100 * DAY),
        },
      });
      const watching = a.watched < a.episodes;
      // Watching: the last two weeks. Finished: an older block, a few episodes per evening.
      const start = watching ? 14 : finishedBlock;
      if (!watching) finishedBlock += Math.ceil(a.episodes / 3) + 2;
      for (let ep = 1; ep <= a.watched; ep++) {
        const daysAgo = watching ? Math.max(0, start - Math.floor((ep / a.watched) * 14)) : start + Math.floor((a.watched - ep) / 3);
        const failedMal = a.anilistId === 101348 && ep === a.watched;
        const pendingSync = !!a.pending;
        await prisma.scrobbleHistory.create({
          data: {
            userId: user.id, showTitle: a.plexTitle, episodeNumber: ep, seasonNumber: 1,
            viewPercentage: 88 + Math.floor(rnd() * 12),
            anilistStatus: pendingSync ? SyncStatus.PENDING : SyncStatus.SUCCESS,
            malStatus: pendingSync ? SyncStatus.PENDING : failedMal ? SyncStatus.FAILED : SyncStatus.SUCCESS,
            kitsuStatus: SyncStatus.SKIPPED,
            errorMessage: failedMal ? 'MAL error: the service did not answer in time. It will be retried.' : null,
            source: a.server ?? 'PLEX', serverName: a.server === 'JELLYFIN' ? 'Bedroom Jellyfin' : 'Living Room Plex',
            libraryName: 'Anime', viewedAt: evening(daysAgo), createdAt: evening(daysAgo),
          },
        });
      }
    }
    for (const id of FAVORITES) {
      const a = ANIME.find((x) => x.anilistId === id)!;
      await prisma.userFavorite.create({ data: { userId: user.id, animeId: String(id), title: a.title } });
    }
    const n = await prisma.scrobbleHistory.count({ where: { userId: user.id } });
    console.log(`demo user ready: ${ANIME.length} anime, ${n} history entries`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
