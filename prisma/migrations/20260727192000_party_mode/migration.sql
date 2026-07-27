-- Family party mode: campaigns move from one Character to a party of them.

-- 1. New join table for the party, created first so we can backfill it
--    from campaigns.characterId before that column is dropped below.
CREATE TABLE "campaign_characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_characters_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaign_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "campaign_characters_campaignId_characterId_key" ON "campaign_characters"("campaignId", "characterId");

-- 2. Backfill: every existing campaign's single characterId becomes a
--    one-member party.
INSERT INTO "campaign_characters" ("id", "campaignId", "characterId", "createdAt")
SELECT lower(hex(randomblob(16))), "id", "characterId", CURRENT_TIMESTAMP
FROM "campaigns";

-- 3. Rebuild campaigns: add readingAge (backfilled from the party member's
--    own readingAge before the column existed), drop characterId now that
--    campaign_characters holds it. campaign_characters has an FK to
--    campaigns(id), so foreign key enforcement must be off for the
--    drop-and-rename below (PRAGMA foreign_keys has no effect inside a
--    transaction, hence defer_foreign_keys instead).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "campaigns_worldSettingId_fkey" FOREIGN KEY ("worldSettingId") REFERENCES "world_settings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_campaigns" ("id", "worldSettingId", "roomCode", "act", "tone", "readingAge", "digestSummary", "unresolvedThreads", "npcsMet", "status", "createdAt", "updatedAt")
SELECT
    c."id",
    c."worldSettingId",
    c."roomCode",
    c."act",
    c."tone",
    COALESCE((SELECT ch."readingAge" FROM "characters" ch WHERE ch."id" = c."characterId"), 5),
    c."digestSummary",
    c."unresolvedThreads",
    c."npcsMet",
    c."status",
    c."createdAt",
    c."updatedAt"
FROM "campaigns" c;

DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
CREATE UNIQUE INDEX "campaigns_roomCode_key" ON "campaigns"("roomCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- 4. Age-gated combat-lethality toggle.
ALTER TABLE "settings" ADD COLUMN "matureCombatEnabled" BOOLEAN NOT NULL DEFAULT false;
