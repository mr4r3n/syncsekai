# Security

SyncSekai holds OAuth tokens for other people's AniList, MyAnimeList and Kitsu accounts.
That is the whole reason this document exists: you should be able to check what happens to
them instead of taking anyone's word for it. Every claim below names the file that backs it.

## Reporting a vulnerability

**Please don't open a public issue.** Use GitHub's private reporting
(Security → Report a vulnerability) on this repository, or write to the address in the site
footer.

Include what you did, what happened, and what you expected. A proof of concept helps enormously.
Only test against your own instance or your own account on the hosted one — please don't test
against other people's data.

## What is stored, and how

| Data | Where | Protection |
|---|---|---|
| Tracker access and refresh tokens | `AnilistConnection`, `MalConnection`, `KitsuConnection` | AES-256-GCM, encrypted at rest |
| Media server tokens | `PlexConnection`, `JellyfinConnection`, `EmbyConnection` | AES-256-GCM, encrypted at rest |
| Your password | `User.password` | bcrypt, salted. Never stored or logged in the clear |
| Session | `plexsync_session` cookie | HttpOnly, Secure, SameSite=Lax, signed JWT |
| Watch history | `ScrobbleHistory` | Plain — it is the feature. Deleted with your account |

Encryption: [`backend/src/common/crypto/encryption.service.ts`](backend/src/common/crypto/encryption.service.ts)

## OAuth

**We never see your tracker password.** AniList and MyAnimeList use OAuth: you authorise on
their site and can revoke from there whenever you like, without asking us. Kitsu's API only
offers a password grant, so those credentials are exchanged for a token and **the password is
not kept** — if that trade-off doesn't suit you, don't link Kitsu.

The scopes requested are the minimum needed to read and update your anime list. Nothing about
your Google or Discord account is used beyond signing you in.

### State is bound to the browser that started the flow

The `state` parameter is signed, single-use, expires in 15 minutes, and is tied to a
transaction secret held in an HttpOnly cookie. A callback presented in a browser that did not
start the flow is rejected **before** the state is consumed or the provider code is exchanged.

Without that binding, a valid callback could be replayed into someone else's browser and
create a session for the wrong account. This was found in an audit and fixed.

Implementation: [`auth.service.ts`](backend/src/modules/auth/auth.service.ts) —
`createOAuthState` / `consumeOAuthState`.

## Secrets are required, never defaulted

The backend refuses to start if `JWT_SECRET`, `OAUTH_STATE_SECRET`, `ENCRYPTION_KEY` or
`SETUP_BOOTSTRAP_TOKEN` are missing, shorter than 32 bytes, or set to a value that has
appeared as a default in this project's history.

There is no fallback key. A misconfigured instance fails loudly instead of running with a
secret that everyone can read on GitHub.

Implementation: [`required-secret.ts`](backend/src/common/security/required-secret.ts)

## Other measures in the code

- **Content Security Policy** with a per-request nonce and `strict-dynamic`.
- **HSTS**, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`.
- **External URLs are validated against an allowlist** before being fetched: HTTPS only, no
  credentials in the URL, no control characters.
  ([`enlaces-externos.ts`](backend/src/common/security/enlaces-externos.ts))
- **Rate limiting** on authentication endpoints.
- **Admin endpoints** answer `401` with a generic body to anonymous callers — no hint about
  whether a resource exists.

## What is *not* claimed

Being straight about the limits is part of the point:

- **No external security audit.** The code has been reviewed, including by an independent
  agent whose findings are fixed in this repository, but nobody has paid a firm to certify it.
- **No bug bounty.** Reports are welcome; there is no money behind them.
- **The hosted instance is run by one person.** If that matters for your threat model,
  self-host — that is exactly why the code is here.
- **Tokens are encrypted at rest, not end-to-end.** The server necessarily decrypts them to
  talk to the trackers. Anyone with root on the host and the encryption key can read them.
  That is true of every service of this kind; it is stated here so you can weigh it.

## Revoking access

- **AniList** — Settings → Apps → revoke
- **MyAnimeList** — Account Settings → API → revoke
- **Kitsu** — change your Kitsu password, which invalidates the token
- **Everything at once** — delete your SyncSekai account: connections, tokens and history go
  with it.
