# Hearthlight

A family D&D-style storytelling app: you're the DM, your kid taps, chooses,
rolls a physical d20, and looks at the pictures. Two screens stay in sync —
a private DM screen (notes, DCs, controls) and a public story screen
(full-bleed art and choices, legible across a room).

This README is written for a tired parent at 7pm. If a step doesn't work,
that's a bug — say so.

## Quick start

```bash
npm install        # also generates the Prisma client (postinstall)
cp .env.example .env
npx prisma migrate dev   # first time only, creates data/dev.db
npm run dev
```

Open http://localhost:3000 — it links to `/dm` and `/story`.

## Environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — already set to `file:./data/dev.db`, no change needed.
- `OPENAI_API_KEY` — **not required yet.** Nothing in the current build calls
  OpenAI. You'll need this starting at the art pipeline phase; the app will
  tell you clearly when a feature needs it and hasn't been verified without
  one.
- `HEARTHLIGHT_TEXT_MODEL` / `HEARTHLIGHT_IMAGE_MODEL` / `HEARTHLIGHT_TTS_MODEL`
  — optional overrides for the model IDs pinned in
  `src/server/config/models.ts`. Leave blank to use the defaults.
- `HEARTHLIGHT_MONTHLY_CAP_USD` — optional spend cap, enforced against the
  `SpendLog` table once the art/story engines are logging spend.

## What's actually working right now (Phase 1)

- Next.js App Router project, TypeScript strict, Tailwind, `npm run dev`.
- Prisma schema + SQLite migration for the core data model: `Character`,
  `Campaign`, `Scene`, `Item`, `SpendLog`, `Settings`.
- `/dm` and `/story` route shells (placeholder content only — proves the
  screen split renders, nothing else).
- Model config file (`src/server/config/models.ts`) with env-var overrides.
  Model IDs are placeholders (`TBD-verify-in-phase-N`) until the phase that
  actually calls them pins a real, doc-verified snapshot.

**Nothing here calls OpenAI yet**, so nothing here has been verified against
a live API — there's nothing to verify at this stage.

## What's stubbed for later phases

These directories exist (via `.gitkeep`) but are empty — they're the shape
of what's coming, not working code:

| Path | Lands in |
| --- | --- |
| `src/server/sheets/` | Phase 2 — PDF character sheet import |
| `src/server/art/` | Phase 3 — art pipeline, character consistency |
| `src/server/storyEngine/` | Phase 4 — structured-output story engine |
| `src/server/contentPolicy/` | Phase 4 — safety validator |
| `src/server/dice/` | Phase 5 — roll input + modifier math |
| `src/server/sync/` | Phase 6 — dual-screen WebSocket sync |

Build order and checkpoints are tracked against the project plan; each phase
gets verified (and, where it depends on the OpenAI API, actually run) before
being called done.

## Project structure

```
prisma/schema.prisma     # data model
src/app/dm/               # DM screen routes
src/app/story/             # Story screen routes
src/app/api/                # route handlers (all OpenAI calls happen here)
src/server/                  # server-only domain logic, one folder per subsystem
src/lib/                       # shared Zod schemas + types
src/components/                 # DM + story screen UI
data/images/                     # generated art cache (gitignored, kept via .gitkeep)
data/dev.db                       # local SQLite database (gitignored)
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/run
- `npm run lint` — ESLint
- `npx prisma migrate dev` — apply schema changes to the local DB
- `npx prisma studio` — browse the local database
