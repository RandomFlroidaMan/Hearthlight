-- Family accounts: characters and campaigns now belong to a family.
-- World settings stay unscoped (shared library across every family).

CREATE TABLE "families" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "families_name_key" ON "families"("name");

-- Every row created before family accounts existed gets parked here so it
-- doesn't collide with whatever name a real family picks later. The code
-- hash below is a random value nobody was ever told — this family can't be
-- logged into, only migrated out of by hand if it ever matters.
INSERT INTO "families" ("id", "name", "codeHash", "createdAt")
VALUES (
    'legacy-data-family',
    'Legacy Data (pre-accounts)',
    '68f5191d99259e36d954969e1f22b1f5:e95370114e957cf2325ad3f9e2f0d3a10448aa6e135eff748b4d3edad0d15bfa61ff0cc0b0a18b7e1bea3a336ff9076ff2648819319312d719d4185eeb73437e',
    CURRENT_TIMESTAMP
);

-- Rebuild characters: add familyId (backfilled to the legacy family) and
-- universe (defaulted to the only value that existed before now).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "universe" TEXT NOT NULL DEFAULT 'fantasy',
    "race" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "strength" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "constitution" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "wisdom" INTEGER NOT NULL,
    "charisma" INTEGER NOT NULL,
    "proficiencies" JSONB NOT NULL,
    "equipment" JSONB NOT NULL,
    "spells" JSONB NOT NULL,
    "background" TEXT,
    "personality" TEXT,
    "appearance" TEXT,
    "readingAge" INTEGER NOT NULL DEFAULT 5,
    "portraitPath" TEXT,
    "sourceSheet" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "characters_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_characters" ("id", "familyId", "name", "displayName", "universe", "race", "className", "level", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma", "proficiencies", "equipment", "spells", "background", "personality", "appearance", "readingAge", "portraitPath", "sourceSheet", "createdAt", "updatedAt")
SELECT "id", 'legacy-data-family', "name", "displayName", 'fantasy', "race", "className", "level", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma", "proficiencies", "equipment", "spells", "background", "personality", "appearance", "readingAge", "portraitPath", "sourceSheet", "createdAt", "updatedAt"
FROM "characters";

DROP TABLE "characters";
ALTER TABLE "new_characters" RENAME TO "characters";

-- Rebuild campaigns: add familyId (backfilled to the legacy family).
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "worldSettingId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "act" TEXT NOT NULL DEFAULT 'setup',
    "tone" TEXT,
    "readingAge" INTEGER NOT NULL DEFAULT 5,
    "digestSummary" TEXT,
    "unresolvedThreads" JSONB NOT NULL DEFAULT '[]',
    "npcsMet" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaigns_worldSettingId_fkey" FOREIGN KEY ("worldSettingId") REFERENCES "world_settings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_campaigns" ("id", "familyId", "worldSettingId", "roomCode", "act", "tone", "readingAge", "digestSummary", "unresolvedThreads", "npcsMet", "status", "createdAt", "updatedAt")
SELECT "id", 'legacy-data-family', "worldSettingId", "roomCode", "act", "tone", "readingAge", "digestSummary", "unresolvedThreads", "npcsMet", "status", "createdAt", "updatedAt"
FROM "campaigns";

DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
CREATE UNIQUE INDEX "campaigns_roomCode_key" ON "campaigns"("roomCode");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- World settings stay shared — just tag which flavor system each belongs to.
ALTER TABLE "world_settings" ADD COLUMN "genre" TEXT NOT NULL DEFAULT 'fantasy';
