# Hearthlight — agent instructions

A family D&D-style storytelling web app. Full product context lives in
[`README.md`](./README.md) (what's built, phase by phase) and
[`DEPLOY.md`](./DEPLOY.md) (Railway deployment). Read this file first for
how to work in the codebase; read those for what the app does and how to
ship it.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind v4
  (CSS-first `@theme`, no `tailwind.config.js`), React 19.
- Prisma 7 + SQLite (`better-sqlite3` adapter) — schema at
  `prisma/schema.prisma`. The generated client is gitignored
  (`src/generated/prisma`); `npm install` regenerates it via `postinstall`.
- A custom `server.ts` wraps Next with a raw `ws` WebSocket server at `/ws`
  — this is why `npm run dev`/`npm start` run `tsx server.ts`, not
  `next dev`/`next start`. Dual-screen sync (DM screen ↔ story screen) and
  the family play hub both depend on it; don't reintroduce plain
  `next dev` without checking `server.ts` stays load-bearing.
- OpenAI (`openai` SDK) for story text (Responses API, structured
  outputs), scene/portrait art (`gpt-image-2`), and narration (TTS). All
  calls are server-only, routed through `src/server/openaiClient.ts` and
  the pinned model IDs in `src/server/config/models.ts`.

## Commands

```bash
npm install                  # also runs `prisma generate`
cp .env.example .env         # fill in OPENAI_API_KEY at minimum; see below
npx prisma migrate dev       # first run only — creates data/dev.db
npm run dev                  # tsx server.ts, with /ws
npm run lint                 # eslint
npm test                     # vitest run
npm run build                # next build (also type-checks)
```

No `tsc --noEmit` script is defined, but running it directly
(`npx tsc --noEmit`) is fast and worth doing before `next build`, which is
slower and type-checks as a side effect anyway.

## Before calling anything done

This repo's history (see `git log`) was built with strict discipline:
`tsc --noEmit` → `eslint` → `vitest run` → `next build` → a real
live-server check (not just reading the diff) → clean up any test
data/files created during that check → commit. Keep doing this. In
particular:

- **Actually run the app and click through the change**, or hit the route
  with `curl`/a WebSocket client, rather than trusting that code compiles.
  A past bug here (two independently-random session-secret fallbacks
  across the Edge middleware and Node runtimes) only surfaced by actually
  logging in, not by type-checking. `server.ts` serves the whole app
  including `/ws`, so start it with `npx tsx server.ts`, not `next dev`.
- **OpenAI calls may be unreachable** in a sandboxed/offline environment.
  If so, verify the call is correctly *attempted* and fails *gracefully*
  (existing fallback paths: `generateSceneImage` retries then falls back
  to `WorldSetting.lastSceneImage`; `generateNarration` falls back to
  `null`; a failed beat broadcasts `generation_failed` rather than
  wedging the UI) — don't claim full verification you couldn't actually
  run.
- **Delete any test families/characters/campaigns** created against the
  dev DB during verification before committing — there's no auth
  fixture/factory, so manual `curl` + a throwaway bootstrap code is the
  normal way to get a logged-in session locally (see "Family accounts"
  below).

## Architectural patterns worth knowing before touching code

- **Fire-and-forget generation.** Any route that triggers an OpenAI call
  (campaign creation, advancing a beat) responds immediately and runs
  generation in the background, broadcasting the result over the
  WebSocket. An inline await on a 15-30s OpenAI round trip is long enough
  to trip a host's own proxy timeout — this bit the project once in
  production (Railway's "Application failed to respond"). Don't add a
  synchronous await on a generation call in a route handler.
- **Text-then-media progressive reveal.** Beat generation is split into a
  text phase (`generateBeatText`) and a media phase
  (`generateBeatMedia`, art + narration in parallel) — see
  `src/server/storyEngine/generateBeat.ts`. A scene is saved and
  broadcast (`{ type: "scene" }`) the moment its prose/choices are ready,
  with `imagePath`/`narrationPath` still null; a second broadcast
  (`{ type: "scene_media" }`) patches those in once art/narration finish.
  Art generation is the dominant latency cost, so this is what keeps a
  family from staring at a blank screen. Preserve this split rather than
  reverting to one combined await.
- **Speculative prefetch.** `src/server/storyEngine/prefetch.ts` +
  `prefetchCache.ts` speculatively generate *every* choice's content
  (both outcomes, for a skill check) as soon as a scene is shown, keyed
  by `sceneId:choiceIndex:outcome:sortedPartyCharacterIds`. Real beat
  advancement checks this cache before generating fresh. The cache entry
  is itself split into a `textPromise` and a `mediaPromise` so a cache
  hit can still reveal text before media resolves.
- **No mechanics outside the DM screen.** Skill names, DCs, roll numbers
  never appear on the story screen or in the keepsake PDF — only DM
  notes/tools. `src/server/contentPolicy/` validates generated beats
  against the app's gentle-content safety rules (no real violence/death
  toward humans, monster-only conflict, age-scaled prose) with a
  hand-authored fallback beat per act if generation keeps failing
  validation.
- **Family accounts, not user accounts.** One login per household
  (`Family`: name + scrypt-hashed code), gated by a deployment-wide
  `HEARTHLIGHT_BOOTSTRAP_CODE` so one instance can host several families.
  Most campaign/character data is family-scoped; world settings are
  shared across all families on a deployment. Session is a signed cookie
  (`src/server/auth/token.ts`, HMAC-SHA256) verified identically in Edge
  middleware and Node route handlers — set `HEARTHLIGHT_SESSION_SECRET`
  or it falls back to a fixed (not random) insecure default, logged as a
  warning.
- **Disk caches, content-addressed.** Generated images/audio are hashed
  and cached under `data/images` / `data/audio` (see
  `src/server/art/imageStore.ts`, `src/server/audio/audioStore.ts`) —
  identical prompts/inputs reuse the same file rather than re-generating.

## Testing

`vitest` unit tests live alongside the code in `__tests__/` directories
(not one top-level `tests/` folder). Favor testing pure logic
(`rollResolution`, `beatSchema`, `prefetchCache`, `contentPolicy`,
`deriveSkills`, etc.) directly; for the few tests that touch the
generation pipeline (`generateBeat.test.ts`), mock `@/server/db`,
`@/server/sync/transport`, and the OpenAI-calling modules with
`vi.mock`/`vi.hoisted` rather than hitting a real database or network —
see that file for the pattern.
