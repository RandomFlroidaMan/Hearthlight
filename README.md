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
  and photo/scan uploads) and everything from the art pipeline onward.
  Working and billed, confirmed with live calls.
- `HEARTHLIGHT_TEXT_MODEL` / `HEARTHLIGHT_IMAGE_MODEL` / `HEARTHLIGHT_TTS_MODEL`
  — optional overrides for the model IDs pinned in
  `src/server/config/models.ts`. Leave blank to use the defaults.
- `HEARTHLIGHT_MONTHLY_CAP_USD` — optional spend cap, enforced against the
  `SpendLog` table once the art/story engines are logging spend.

## What's actually working right now (Phases 1–5)

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
  all three cases from the brief, **all fully verified end-to-end with live
  OpenAI calls** (billing was added after the initial build):
  - **Form-field PDFs** — deterministic AcroForm extraction, verified
    against a synthetic test PDF (no real D&D Beyond export was available
    to test against, so the exact field-name mapping is a best-effort guess
    at the common Wizards-of-the-Coast fillable layout — that's exactly why
    every import goes through an editable confirmation screen rather than
    saving silently).
  - **Text-layer PDFs** — text extraction plus the LLM structured-output
    mapping, verified against a real generated PDF: every field (name,
    race, class/level, all six ability scores, proficiencies, equipment,
    spells, background, personality) came back correct.
  - **Scans/photos** — page rasterization (`@napi-rs/canvas` via
    `pdf-parse`) plus the vision-model call, verified two ways: a rendered
    "photo" of the same test sheet extracted every field correctly, and a
    genuinely blank scan fell back to sensible defaults (`"Unknown"`, 10s,
    empty lists) instead of crashing or fabricating data.
- All four sheet-classification paths were exercised through the real HTTP
  route with real files and a real API key — not mocked, not just
  unit-tested in isolation.

**Phase 3 — art pipeline + character/setting consistency:**
- Style bible (`src/server/art/artDirection.ts`) — one file, per the brief:
  base painterly-watercolor prompt, negative directions folded into the
  text (gpt-image models have no separate negative-prompt param), 16:9
  scene size / square portrait size, and 4 preset biome palettes.
- Character reference portraits (`generateCharacterPortrait`, via
  `images.generate`) and reference-guided scene art
  (`generateSceneImage`, via `images.edit` with the portrait + setting
  reference images as inputs) — hash-based disk cache, served through
  `/api/images/[filename]` since generated art lives outside `public/`.
  Retries once on failure, then falls back to the setting's last
  successfully generated image rather than ever showing a placeholder box.
- **World settings** (`/dm/settings`, `/dm/settings/new`) — a reusable
  library of places, either a built-in palette or a fully custom setting
  built from a prompt plus up to 5 reference images. One form serves both a
  saved library entry and a quick prompt-only story start.
- **`/dm/art-test`** — the brief's own mandated checkpoint: generate several
  scenes from the same character + setting references and eyeball
  consistency before building anything else on top. **Actually run**, not
  just built: a real "Wandering Bog" setting (bog town on a giant,
  slow-grazing turtle, built from a real reference photo) plus an existing
  character produced a reference portrait and 5 scene images, all
  consistent in character appearance and setting look, none needed the
  fallback path. Images were reviewed directly, not just code-reviewed.
- Found and fixed one real bug via that live run: `gpt-image-2` rejects the
  `input_fidelity` parameter (that's `gpt-image-1`/`1.5` only) — the SDK's
  own docstring reads ambiguously on this point, so this was only caught by
  actually calling the API.
- `image.model` pinned to `gpt-image-2-2026-04-21`, confirmed live.

**Phase 4 — story engine + content policy:**
- Content policy (`src/server/contentPolicy/`) — the brief's hard safety
  rules (§5) as one readable, tested module: a banned-word list (word-
  boundary matched, not substring — verified against false positives like
  "scarecrow"), an approved-outcome vocabulary fed into the prompt, a
  best-effort human-vs-monster conflict heuristic, and a hand-authored
  fallback beat per act. 16 unit tests, including every fallback beat
  validating against its own validator.
- Story engine (`src/server/storyEngine/`) — structured-output beat
  generation (`generateBeat`) reusing the same `zodTextFormat` +
  Responses API pattern proven in Phase 2's sheet parsing: prose, 2-3
  choices with optional skill/DC, private DM notes, an image prompt, an
  ambient-audio tag, an optional item reward, an ending flag. A reading-
  age-aware act planner (setup → journey → complication → climax →
  resolution) and a digest summarizer that folds older scenes into
  `Campaign.digestSummary` so long campaigns don't blow the context window.
  Regenerates up to 3 times against content-policy violations before
  falling back to an authored-safe beat.
- Campaigns (`/dm/campaigns/new`, `/dm/campaigns/[id]`,
  `/story/campaigns/[id]`) — picking a character + world setting starts a
  real campaign; the DM screen shows prose/choices/notes with overrides
  (pick a choice, regenerate, inject a direction, force an ending, edit
  prose inline); the story screen shows art/prose/choices only, with DM
  notes confirmed never leaking there.
- **Fully verified with a real, live, multi-scene campaign** — Quinn in
  The Wandering Bog, played through setup → journey → complication →
  resolution across 4 real beats. Every generated beat passed content
  policy on the first attempt (no regeneration or fallback needed). Every
  DM override was exercised for real: prose edit, regenerate-in-place
  (confirmed it replaces rather than duplicates), direction injection
  (confirmed the model actually followed it), and force-ending (confirmed
  campaign status flips to `"ended"`). Digest summarization fired
  correctly once past the 3-scene threshold. Checked via a real headless
  browser, not just `curl`: both screens render with zero console errors,
  and the DM-notes privacy boundary holds on the story screen.
- **Explicitly stubbed, not scope-crept in from later phases**: picking a
  choice always auto-resolves as success — real dice math is Phase 5. The
  two screens don't push updates to each other live — that's Phase 6.
  `ambientTrack` is stored as a tag only — real audio is Phase 7.

**Phase 5 — dice + rules engine:**
- `src/server/dice/rollResolution.ts` — the mechanic decided before this
  build started: no animated 3D die, just a physical d20 typed in, plus the
  character's derived skill modifier (Might/Magic/Cunning/Heart, from
  Phase 2) against the choice's DC. Age-scaled complexity (age 3 ignores
  the modifier entirely — "one die and a target number" — ages 5/7/10 apply
  it in full), advantage/disadvantage (7/10 only, roll twice and take the
  better/worse), and natural 20/1 always succeed/fail regardless of total —
  a documented kid-friendly simplification, not strict 5e RAW. 11 unit
  tests.
- Picking a skill-check choice now actually requires a roll (or a DM-fudge
  override) — the DM screen shows a roll panel with the skill/DC/modifier
  breakdown, an advantage/disadvantage selector where applicable, and (only
  if `Settings.dmFudgeEnabled`) a force-success/failure override. The story
  screen keeps "no mechanics" absolute: tapping a skill-check choice there
  shows only a bare 1-20 number pad, no DC or modifier shown.
- **Fully verified with real, live rolls** against a level-4 Wizard
  (Cunning modifier confirmed correct: DEX +2, plus proficiency bonus +2
  for Investigation, matching hand-calculated expectations exactly):
  a normal-mode success, a natural-1 forced failure, an advantage roll
  (confirmed it took the higher of two dice), and DM-fudge overrides for
  both outcomes. `Scene.rollResult` confirmed attached to the *prior* scene
  (the one that presented the choice), not the new one being generated.
- Found and fixed one real gap via that live run: DM-fudge outcomes weren't
  recording anything in `rollResult`, unlike real rolls — no audit trail of
  an override having happened. Fixed to record `{ skill, fudged: true,
  success }`, re-verified live.

## What's stubbed for later phases

These directories are empty — they're the shape of what's coming, not
working code:

| Path | Lands in |
| --- | --- |
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
