# AGENTS.md

Guidance for agents (and humans) working in this repo. Read this before changing code.

## What Anily is

A self-hosted anime streaming service. It does not host a library: metadata comes from AniList
and TheTVDB, and video is streamed from third-party providers through a signed proxy. The
distinguishing feature is **anime groupings** — franchise chains built from AniList relations, so
users bookmark a franchise rather than a western-style "season".

Repo: `https://gitlab.com/medialy/anily` (GitLab, not GitHub). Hosted packages come from the
GitLab npm registry (see *Setup*).

## Repo layout

```
client/                    Svelte 5 + Vite + Capacitor shell (thin wrapper)
  src/main.ts              the whole app entry: mountAnilyApp() with Anily branding
  android/                 committed Capacitor Android project
server/                    Hono API + Prisma + background syncs
  src/app.ts               Hono app, error handler, logger middleware
  src/auth.ts              OIDC handlers + /api/login, /api/me, /logout, /callback
  src/main.ts              route imports, static serving, setInterval schedulers
  src/routes/<feature>/    one folder per API area (index.ts registers routes)
  src/services/            furigana, jimaku, subtitleSync, syncAnimePipeline
  src/syncs/               background jobs
  lib/                     AniList / TheTVDB / AnimeSchedule / streaming clients
  prisma/                  schema + migrations
public/                    CI deploy artifacts (Obtainium page generator)
```

There is **no web UI code** in this repo beyond `client/src/main.ts`. The screens, player,
navigation, offline downloads and API client all live in `@medialy/ui`. That package ships **raw
`.svelte`/`.ts` source** (not compiled JS), so read it directly under
`client/node_modules/@medialy/ui/dist/` when you need to know how the app behaves. Changing UI
means bumping that dependency and working in its own repo, not editing here.

## Architecture at a glance

### Request lifecycle

1. `src/app.ts` builds the Hono app, installs OIDC handlers (`src/auth.ts`) and pino logging.
2. `src/main.ts` **imports every route module for its side effects**. Each route file calls
   `app.get(...)`/`app.post(...)` at module scope and exports the handler.
   → A new route is only live if its module is imported in `src/main.ts` (or transitively).
3. Handlers validate with `zValidator` (zod), resolve the user via `getAuthenticatedUser(c)`,
   call Prisma directly or delegate to a service, and return `c.json(...)`.
4. `app.onError` records failures in the in-memory `errorTracker` (`/api/errors`).
5. Static frontend is served from `./public` (built client output), with SPA fallback.

Port is hardcoded to **3000** in `src/main.ts`. `GET /info` is an unauthenticated health check.

### Conventions in route modules

- Path params: reuse `$src/validators/anilistId` or a local `zValidator`.
- Errors return `{ error, reason }` with 500; missing entities return `{ error }` with 404; the
  `notFound`/`unavailable` flag style comes from `apiStream`.
- Per-request user: `const user = await getAuthenticatedUser(c)`. It memoizes on `c.get("user")`,
  matches by OIDC `email`/`sub`, auto-provisions users, and falls back to `DEFAULT_USER_EMAIL`
  (or the oldest user) so single-tenant local dev works without an IdP.
- In-memory caches are common (stream service verification, subtitle text, furigana output).
  They are per-process, so behaviour differs with multiple replicas.

### Data model (`server/prisma/schema.prisma`)

| Model | Role |
| --- | --- |
| `BaseAnime` | AniList-keyed title (id is `anilistId`), names, format, season, trgm search indexes |
| `AnimeRelation` | Directed edges: prequel/sequel/spin-off/side story/… |
| `AnimeSynonym` | Alternate titles, also trgm-indexed |
| `AnimeDetails` | Art/description per anime + its position (`groupingOrder`) in a grouping |
| `AnimeGrouping` | A franchise: `items[]` (member anime) + `displayAnime` (the cover entry) |
| `Episode` | Number, airing time, titles, thumbnail, and offline `media*` fields |
| `SyncJob` | Audit row for every sync run (type, trigger, status, counts, details, error) |
| `User`, `UserBookmark`, `UserAnimeRating`, `UserEpisodeProgress` | Per-user state |

Everything user-scoped is keyed by `userId` with `@@unique([userId, ...])` — the multi-tenancy
migration removed the old global watched/rating columns. Do not reintroduce global state.

### Grouping algorithm (`src/routes/apiGrouping/buildAnimeGroupings.ts`)

`buildChains()` walks `relationsOut` inside a candidate pool: it seeks the chain head by following
`PREQUEL`, then builds a tree along `SEQUEL` edges (forks allowed, re-converging sequels skipped),
and anything left without a sequel becomes `notInChain`. `collectGroupingMemberIds()` expands the
connected component; `updateAnimeGroupingIfNeeded()` re-sets the grouping's items. Creation and
consolidation of duplicate groupings happen in `apiDetails` under an `AsyncKeyedMutex`, so
concurrent bookmarks of the same franchise cannot race.

### Background syncs (`src/syncs/`, started in `src/main.ts`)

- `keepAnilistDataUpdated` — every 5 min: page AniList for media newer than `max(lastUpdated)`,
  upsert titles/synonyms/relations, then rebuild groupings for affected franchises.
- `syncAiringEpisodes` — every 60 min: for bookmarked airing shows, pull episode dates/titles from
  TheTVDB/AnimeSchedule.
Both write `SyncJob` rows and are wrapped so a failure is logged, not fatal. `SyncJobTrigger` is
`SCHEDULED` or `MANUAL`; the manual endpoints are `POST /api/details/:anilistId/refresh` and
`POST /api/episodes/:anilistId/refresh`. Set `ANILY_DISABLE_SCHEDULES=true` to stop the timers.

### Streaming and subtitles

- `@ant.ms/anily-providers` is the provider registry: `checkAvailability` → `resolveStream`.
  `apiStream/getServices.ts` caches verified services for 5 min.
- Stream URLs are HMAC-signed (`@medialy/stream-core`) with expiry; `apiStream/proxy` refuses
  URLs failing `verifyStreamSignature` or `isSafeStreamUrl` (SSRF guard) — keep that check on any
  new outbound fetch.
- Downloads (`apiStream/downloadStream.ts`) shell out to **ffmpeg** (installed in the runtime
  image) and track per-server rate limiting.
- Subtitles: Japanese tracks from Jimaku, converted ASS/SRT→VTT, optional furigana via
  kuroshiro/kuromoji, and time-alignment against a reference English track
  (`src/services/subtitleSync.ts`). `/api/stream/subtitles/track` is signed and cached.

### Client shell (`@medialy/ui`)

`client/src/main.ts` configures and mounts a shared app shell that also powers a sibling app
("Showly"). Everything below is that package's behaviour; know it before changing server contracts.
This repo enables `audioLanguageToggle` and `romanjiTitles`; the shell also supports
`seasonSelector`, `chainsSidebar`, `inlineDescription` and `compactChains` (used by Showly).

- **Backend URL** is chosen at runtime in this order: `localStorage["<appId>:backendUrl"]` (set by
  the login screen, stored as a JSON string) → `appConfig.defaultBackendUrl` (unset here) →
  `window.location.origin`. Every request goes through `new URL(path, apiBaseUrl.current)`, so the
  web build is same-origin by default and the native build asks the user for a server URL.
- **Auth**: cookie `oidc-auth` plus an optional Bearer token installed by a global `fetch`
  interceptor. The server translates `Authorization: Bearer <jwt>` into the cookie and returns a
  refreshed token in the `x-session-token` response header; the client persists it and, on native,
  mirrors it into `CapacitorCookies`. Any 401 on `/api/*` (except `/api/stream/proxy`, `/api/login`,
  `/info`) dispatches an `anily:unauthorized` event and clears the session. `/api/login` starts the
  OIDC flow, `/api/me` returns the profile the login page validates a server URL against.
- **Stream and download URLs can carry `?token=<jwt>`** (or `?session=`) instead of headers,
  because `<a download>` and the native downloader cannot set headers; the server rewrites it into
  the `oidc-auth` cookie. `/api/stream/proxy` and `/api/stream/subtitles/track` bypass API auth
  entirely and rely on their own signature check.
- **Routing** is hash-based: `#/inbox`, `#/waiting`, `#/upcoming`, `#/completed`, `#/settings`,
  `#/logs`, `#/errors`, `#/downloads`, and `#/anime|show|movie/<anilistId>`.
- **Storage keys are prefixed with `appConfig.appId`** (`anily:…`) via `STORAGE_KEYS`. Never
  hardcode a key string; add it to `storageKeys.ts` upstream.
- **Offline behaviour**: watch-status writes go into a localStorage queue when offline/failing and
  flush on reconnect (`syncQueue`); downloads use the `@medialy/android` Capacitor plugin
  (`AnilyNative`) and pre-fetch skip times and subtitles for offline playback.
- **Liveness**: `serverPing` polls `GET /api/ping` every 2.5 min and on resume/reconnect, using the
  latest sync job to decide when to refresh sidebar data. `/info` doubles as the server-identity
  check in the login flow, so keep its `project` field stable.
- **Not every UI call exists here.** The shared shell also serves a TV/movie app; e.g.
  `POST /api/details/:id/ignore` (season ignore) is called by the UI but has no route in this
  repo, so it 404s. Cross-check `src/routes/` + `src/auth.ts` before assuming a call is supported.

### Entry points (API surface)

```
GET  /info                                     GET  /api/ping
GET  /api/login  /callback  /logout            GET  /api/me        (registered in src/auth.ts)
GET  /api/search?q=                            GET  /api/sidebar/:tab
GET  /api/details/:anilistId                   POST /api/details/:anilistId/refresh
POST /api/details/:anilistId/grouping          DELETE /api/details/:anilistId/grouping
POST /api/details/:anilistId/rating            GET  /api/grouping?baseAnilistId=
GET  /api/episodes/:anilistId                  POST /api/episodes/:anilistId/refresh
PUT  /api/episodes/:episodeId/watch            PUT  /api/episodes/:anilistId/watch-all
GET  /api/rate/:anilistId                      PUT  /api/rate/:anilistId
GET  /api/sync-jobs?type=                      GET  /api/errors?category=&query=&limit=&offset=
GET  /api/errors/:id                           POST /api/errors/clear|/api/errors/report
GET  /api/stream/services/:episodeId           GET  /api/stream/play/:episodeId
GET  /api/stream/download/:episodeId           GET  /api/stream/skip-times/:episodeId
GET  /api/stream/subtitles/:episodeId          GET  /api/stream/subtitles/track
ALL  /api/stream/proxy[/…]
```

## Setup

Requires Node 22+, pnpm 10.29.2 (Corepack), PostgreSQL, and a GitLab token for the scoped registry.

```bash
# package install needs GitLab auth: .npmrc maps @ant.ms and @medialy to
# https://gitlab.com/api/v4/packages/npm/  (and @medialy/* pulls in the UI)

cd server && pnpm install
pnpm prisma generate     # writes ./generated/prisma  (NOT committed)
pnpm codegen             # writes ./src/gql          (NOT committed)
pnpm migrate             # prisma migrate deploy (dev: pnpm prisma migrate dev)
pnpm start               # tsx src/main.ts, listens on :3000

cd ../client && pnpm install
pnpm dev                 # Vite on :5173 (no proxy; see backend URL note below)
```

The web dev server does **not** proxy to the backend, and `defaultBackendUrl` is unset, so the app
defaults to `window.location.origin` (:5173) and shows the login screen. Point it at the API by
either using the login screen's server-URL field or setting the key directly (it is JSON-encoded):

```js
localStorage.setItem("anily:backendUrl", JSON.stringify("http://localhost:3000"));
```

With no OIDC env vars the server skips auth, so no login flow is needed once the URL is set.

`server/generated/` and `server/src/gql/` are build artifacts and are absent from a fresh clone.
Run both generation steps before `pnpm check`, `pnpm test`, or `pnpm build`, or you will see
missing-module errors that look like real breakage. They are also not in `.gitignore` — do not
commit them.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID` | IdP config; if unset, auth is skipped and the fallback user is used |
| `OIDC_COOKIE_NAME`, `OIDC_AUTH_EXPIRES`, `OIDC_AUTH_REFRESH_INTERVAL` | Session tuning (defaults: 1 week) |
| `DEFAULT_USER_EMAIL` | Single-tenant fallback identity |
| `CORS_ORIGIN`, `ALLOWED_ORIGINS` | Extra comma-separated origins (localhost and `*.ant.ms` are always allowed) |
| `JIMAKU_API_KEY` / `JIMAKU_TOKEN` | Jimaku subtitle access |
| `ANIMESCHEDULE_TOKEN` | Airing schedule API |
| `ANILY_DISABLE_SCHEDULES` | `true` disables the background timers |
| `LOG_LEVEL`, `NODE_ENV` | pino level; pretty printing is off in production |
| `VITE_ALLOWED_HOSTS` | client dev server host allowlist |

`OPENROUTER_API_KEY` / `OPENROUTER_KEY` appear only in episode tests (they are deleted there),
not in production code paths.

## Commands

| Task | Command |
| --- | --- |
| Typecheck server | `cd server && pnpm check` |
| Tests (CI-style single run) | `cd server && pnpm test --run` |
| Single test file | `cd server && pnpm vitest run src/services/jimaku.test.ts` |
| Prod build | `cd server && pnpm build` (tsup → `dist/`, `$lib`/`$src` aliased) |
| Typecheck client | `cd client && pnpm check` |
| Android build | `cd client && pnpm build && npx cap sync android && (cd android && ./gradlew assembleRelease)` |
| Landing page | `sh public/generate.sh [apk] [outdir]` |

## Testing

- Vitest, files colocated as `*.test.ts` next to the source. Globals are **off** — import
  `describe`, `it`, `expect`, `vi` from `"vitest"`.
- Tests mock Prisma and network calls; there is no test database. Keep new tests in that style.
- `vitest.config.ts` aliases `$lib`, `$src`, and `generated` — use the same aliases in new code so
  tests resolve (`generated` is the odd one: import enums from `generated/prisma/enums`, which is
  how existing code does it).

## Conventions and gotchas

- Path aliases: `$src/*` → `server/src/*`, `$lib/*` → `server/lib/*`. They must stay in sync across
  `tsconfig.json`, `tsup.config.ts` (esbuild alias) and `vitest.config.ts`. A new alias means
  editing all three.
- Prisma is v7 with the `prisma-client` generator (not `prisma-client-js`); the client lives in
  `server/generated/prisma` and is imported via relative path from `src/prisma.ts`.
- Strict TypeScript everywhere (`strict: true`); the server uses ESM (`"type": "module"`).
- Logging: `logger.child({ module: "name" })`, never `console.log`. Do not log tokens, cookies,
  or full URLs with credentials; `errorTracker` redacts by key name.
- Sync writes must go through `SyncJob` so `/api/sync-jobs` stays truthful, and must not throw out
  of the scheduler.
- Any cached fetch to provider servers must keep signature + SSRF validation; never proxy an
  arbitrary user-supplied URL.
- The client is a dependency-driven shell, so server changes must not break its contracts: the
  `/info` `project` field, the `/api/ping` payload, `?token=` auth on stream/download URLs, the
  `x-session-token` refresh header, and error bodies shaped `{ error, reason? }`. Branding, labels
  and feature flags live in `client/src/main.ts`.
- `@medialy/ui` ships raw source, so it is the reference for expected API shapes — read it there
  rather than guessing, and keep `client/node_modules` out of commits.
- Known issues live in `TODO.md` (sidebar/episode loading state) and open items in `PLAN.md`
  (automatic/manual sync triggers, deploy page).

## CI / deployment

`.gitlab-ci.yml`, default branch only:

- `docker-build` — Kaniko builds `server/Dockerfile` (multi-stage: client build → typecheck/codegen
  /tsup → runtime `node:22-alpine` with ffmpeg, client `dist` copied to `./public`) and pushes
  `app:<sha>` and `app:latest`.
- `android-build` — pnpm build, `cap sync`, `gradlew assembleRelease`, APK as artifact (30 days).
- `pages` — `public/generate.sh` renders the Obtainium/install landing page from the APK artifact.

The runtime image does **not** run migrations; run `pnpm migrate` as a deploy step.
