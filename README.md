# SyncSekai

**Watch an episode on Plex, Jellyfin or Emby. Your AniList, MyAnimeList and Kitsu lists update on their own.**

No browser extension, no desktop agent, no manual ticking. Your media server sends a
webhook when you play something, SyncSekai works out which anime and which episode that
is, and pushes the progress to whichever trackers you have linked.

[syncsekai.com](https://syncsekai.com) · [Documentation](https://syncsekai.com/docs) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

---

## What it does

| | |
|---|---|
| **Media servers** | Plex (native webhooks), Jellyfin (webhook plugin), Emby (session watching) |
| **Trackers** | AniList, MyAnimeList, Kitsu — several at once |
| **Syncs** | Episode progress, watch status, and your score |
| **Matching** | Title and season mapping between what your server calls a show and what the trackers call it |
| **Control** | Per-title rules, a blacklist, and a full history you can revert |

## Why it exists

Your media server knows you watched episode 8. Your tracker doesn't. Every existing answer
to that gap wanted something from you: an extension in a specific browser, an agent running
on a specific machine, or remembering to update a list by hand.

A webhook doesn't need any of that. The server already emits the event; something just has
to be listening, and it has to be right about *which* episode that event refers to — which
is the part that turns out to be hard.

## The hard part is the matching

Sending an HTTP request is easy. Knowing what to send is not:

- The same show is called three different things by three different services.
- Seasons don't line up. A "season 2" on your server is often a separate entry on AniList.
- Split cours, OVAs, specials, recaps and movies each break the numbering in their own way.
- Absolute numbering vs per-season numbering.
- Two shows with the same name, years apart.
- Metadata that's simply wrong in your library.

Most of this repository is about that problem, not about HTTP.

## How it works

```
┌──────────────┐   webhook    ┌──────────────┐   OAuth    ┌──────────────┐
│    Plex      │ ───────────► │              │ ─────────► │   AniList    │
│   Jellyfin   │              │  SyncSekai   │            │ MyAnimeList  │
│    Emby      │              │              │            │    Kitsu     │
└──────────────┘              └──────────────┘            └──────────────┘
                                     │
                              title + season
                                  mapping
```

1. You play an episode. SyncSekai notices either through a webhook from your server or by
   polling its active sessions every few seconds — Plex and Emby work without any webhook.
2. SyncSekai resolves the title and season to a tracker ID, using its mapping table and,
   when needed, the trackers' own search.
3. Past a configurable watched threshold, it writes the progress to every linked tracker.
4. Everything lands in a history you can inspect and revert, per entry or in bulk.

## Stack

- **Backend** — NestJS 11, Prisma, PostgreSQL 16, Redis 7 (BullMQ for the sync queue)
- **Frontend** — Next.js 16 (App Router), React, TypeScript, Tailwind v4
- **Deployment** — Docker Compose

## Self-hosting

You need Docker and Docker Compose.

```bash
git clone https://github.com/mr4r3n/syncsekai.git
cd syncsekai
cp .env.production.example .env
```

Open `.env` and fill in the required secrets. The backend **refuses to start** if any of
them is missing, too short, or left at a known default — that is deliberate, and
[`required-secret.ts`](backend/src/common/security/required-secret.ts) is where it happens.

```bash
docker compose up -d --build
```

Then open the app and follow the installer, which walks you through the first administrator
account and the connection to your media server.

### OAuth applications

To link trackers you need your own OAuth applications:

| Service | Where |
|---|---|
| AniList | Settings → Developer → Create New Client |
| MyAnimeList | API → Create ID (PKCE) |
| Kitsu | Uses password grant; no application needed |

Put the client IDs and secrets in `.env`. They never leave your instance.

## Security and your data

The short version, with the long version in [SECURITY.md](SECURITY.md):

- **Tokens are encrypted at rest** with AES-256-GCM. See
  [`encryption.service.ts`](backend/src/common/crypto/encryption.service.ts).
- **We never see your tracker password.** AniList and MyAnimeList go through OAuth; you
  authorise on their site and can revoke from there at any time.
- **Every secret is required, not defaulted.** No `JWT_SECRET` fallback, no shipped keys.
- **Your library data stays in your database.** It goes out only to services you have
  chosen to use: the trackers you linked, Google or Discord if you sign in with them, and
  the mail server for account emails. Cover art is fetched from the trackers' CDNs. There
  is no third-party analytics or advertising. The hosted instance sits behind Cloudflare,
  which sees traffic the way any reverse proxy does.

If you find a vulnerability, [SECURITY.md](SECURITY.md) says how to report it. Please don't
open a public issue for it.

## How this was built

This project was written with heavy use of AI assistants, working alongside me. There is
nothing to hide there, and it is worth saying plainly for two reasons.

The first is that you may want to weigh it when deciding how much to trust the code. So:
every decision here was reviewed by a person, the security-sensitive parts more than once,
and a separate AI agent was pointed at the codebase as a reviewer. It found real problems —
a session-fixation flaw in the OAuth flow among them — which are fixed in this repository.
That review is also what pushed a batch of invented statistics off the interface: numbers
that were written into the markup rather than measured. They are all counted now, or they
are not shown. **No security firm has audited this code.** [SECURITY.md](SECURITY.md) says
the same, and says what that means for you.

The second is that if you are doing something similar, the honest version of this is more
useful to you than pretending a single person typed all of it.

## Where it stands

One person runs this, with one hosted instance. It works, it is used daily, and it is not a
company. Bugs get fixed when I see them. If that is not enough for your use, the whole point
of this repository is that you can run it yourself.

SyncSekai is an independent project. It is not affiliated with, endorsed by, or connected
to Plex, Jellyfin, Emby, AniList, MyAnimeList or Kitsu; their names belong to their owners.

## Contributing

Mapping bugs are the most useful thing you can report: *"episode X of show Y synced as Z"*,
with the title exactly as your server shows it. That single detail is what makes a case
reproducible.

[CONTRIBUTING.md](CONTRIBUTING.md) covers the local setup and what a good report looks like.

## Licence

[AGPL-3.0](LICENSE).

In plain terms: use it, change it, run it for yourself or for other people. If you run a
modified version as a network service, the people using it are entitled to your changes.

The hosted instance at [syncsekai.com](https://syncsekai.com) runs this same code.
