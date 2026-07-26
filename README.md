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
- `OPENAI_API_KEY` — required for AI-assisted sheet import (text-layer PDFs
  and photo/scan uploads) and everything from the art pipeline onward. The
  key that's been added authenticates fine, but this account currently has
  **no billing set up**, so every live call fails with `insufficient_quota`
  until that's added at platform.openai.com → Settings → Billing.
- `HEARTHLIGHT_TEXT_MODEL` / `HEARTHLIGHT_IMAGE_MODEL` / `HEARTHLIGHT_TTS_MODEL`
  — optional overrides for the model IDs pinned in
  `src/server/config/models.ts`. Leave blank to use the defaults.
- `HEARTHLIGHT_MONTHLY_CAP_USD` — optional spend cap, enforced against the
  `SpendLog` table once the art/story engines are logging spend.

## What's actually working right now (Phases 1–2)

**Phase 1 — skeleton:**
- Next.js App Router project, TypeScript strict, Tailwind, `npm run dev`.
- Prisma schema + SQLite migration: `Character`, `Campaign`, `Scene`, `Item`,
  `SpendLog`, `Settings`.
- Model config file (`src/server/config/models.ts`), env-var overridable.
  `text` is pinned to `gpt-5.5-2026-04-23` (confirmed live against
  `/v1/models` and a real, request-accepted `/v1/responses` call). `image`
  and `tts` are still placeholders until Phase 3 / Phase 7.

**Phase 2 — character creation + sheet import:**
- From-scratch character creation (`/dm/characters/new`): all standard 5e
  races/classes, kid-friendly class display names (toggleable), ability
  scores, and a live preview of the derived Might/Magic/Cunning/Heart stats.
  **Fully verified** — created and listed a real character through the
  running app.
- Character library (`/dm/characters`) — lists saved characters with their
  derived stats. Reads live from the DB on every request (this matters:
  Next.js would otherwise statically freeze this page at build time).
- Skill derivation (`src/lib/deriveSkills.ts`) — Might/Magic/Cunning/Heart
  computed from real 5e ability scores, class spellcasting ability, and
  proficiencies. Unit tested (4 tests), and the mapping logic is documented
  inline since the brief doesn't specify an exact formula.
- Sheet import (`/dm/characters/import`, `POST /api/sheets/parse`) handles
  all three cases from the brief:
  - **Form-field PDFs** — deterministic AcroForm extraction. **Verified**
    against a synthetic test PDF (no real D&D Beyond export was available
    to test against, so the exact field-name mapping is a best-effort guess
    at the common Wizards-of-the-Coast fillable layout — that's exactly why
    every import goes through an editable confirmation screen rather than
    saving silently).
  - **Text-layer PDFs** — text extraction is deterministic and verified;
    the LLM mapping step is fully wired (confirmed to reach OpenAI
    correctly) but blocked on billing, so its actual accuracy is
    unverified.
  - **Scans/photos** — classification and page rasterization
    (`@napi-rs/canvas` via `pdf-parse`) are verified; the vision-model call
    is wired and reaches OpenAI correctly, same billing block as above.
- All four sheet-classification paths were exercised end-to-end through the
  real HTTP route with real files — not just unit-tested in isolation.

**Blocked on billing, not on code**: `insufficient_quota` from OpenAI. Every
call that depends on it is wired, type-checked, and confirmed to reach the
API correctly — add billing and re-run to get real results.

## What's stubbed for later phases

These directories exist (via `.gitkeep`) but are empty — they're the shape
of what's coming, not working code:

| Path | Lands in |
| --- | --- |
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
src/app/dm/               # DM screen routes (character library, creation, import)
src/app/story/             # Story screen routes
src/app/api/                # route handlers (all OpenAI calls happen here)
src/server/sheets/            # PDF/photo character sheet parsing (Phase 2)
src/server/                    # server-only domain logic, one folder per subsystem
src/lib/                         # shared Zod schemas, 5e data, skill derivation
src/components/                   # DM + story screen UI
data/images/                       # generated art cache (gitignored, kept via .gitkeep)
data/dev.db                         # local SQLite database (gitignored)
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/run
- `npm run lint` — ESLint
- `npm test` — run the unit test suite (vitest)
- `npx prisma migrate dev` — apply schema changes to the local DB
- `npx prisma studio` — browse the local database
