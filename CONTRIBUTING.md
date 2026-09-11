# Contributing

## The most useful thing you can report

**A show that synced wrong.** Matching what your media server calls an episode to what a
tracker calls it is the hard part of this project, and every library breaks it in a slightly
different way.

A good report has:

- The title **exactly as your server shows it**, including season and episode numbers.
- What it synced as, or that it didn't sync at all.
- Which media server, and which tracker.
- The entry from Sync History, if there is one.

That last detail is usually what makes the difference between "we'll look into it" and a fix.

Special cases worth reporting: split cours, OVAs and specials, recap episodes, movies inside
a series, absolute numbering, and two shows that share a name.

## Running it locally

You need Node 20+, Docker and pnpm or npm.

```bash
# A database and a Redis for development
docker compose up -d postgres redis

# Backend
cd backend
cp ../.env.production.example .env      # fill in the secrets
npm install
npx prisma db push
npm run start:dev                       # port 4000

# Frontend, in another terminal
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=SECRETO-ROTADO-Y-RETIRADO" > .env.local
npm run dev                             # port 3000
```

Optional demo data:

```bash
cd backend
SEED_ADMIN_PASSWORD='choose-your-own' SEED_USER_PASSWORD='choose-another-one' npx ts-node prisma/seed.ts
```

Both passwords are required and have no defaults — the seed stops rather than create an
admin account with a password anyone can read in this repository.

**The seed wipes every table before it writes.** Its guard checks the host in `DATABASE_URL`
and only lets loopback through, because that is what actually decides which database gets
emptied. Any other host has to be acknowledged with `SEED_DESTINO_OK=1`.

### Schema changes

This project uses `prisma db push`, not migrations. If you change `schema.prisma`, push it and
say so in the pull request.

## Before you open a pull request

```bash
cd backend  && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Both sides must type-check clean.

## House style

The codebase has conventions worth matching:

- **Comments say *why*, not *what*.** Most existing comments explain a decision or a trap
  someone already fell into. Copy that habit rather than narrating the code.
- **User-facing text goes through `t()`.** Both `es.json` and `en.json`, in the same pull
  request. Strings written directly into JSX are the most common review comment here.
- **Colours and sizes come from the CSS variables**, not from Tailwind's palette. `bg-sky-500`
  looks fine in dark mode and disappears in light mode.
- **Don't invent numbers.** If a figure isn't measured or counted, don't show it. There is
  history in this repository of hardcoded percentages that survived long enough to end up in
  a security review.

## Pull requests

- One thing per pull request.
- Say what was broken and how you can tell it isn't any more.
- `npx tsc --noEmit` passes on both sides.
- If it changes the interface, a before/after screenshot at 375 px and at desktop width.

## Licence

Contributions are accepted under [AGPL-3.0](LICENSE), the same licence as the project.
