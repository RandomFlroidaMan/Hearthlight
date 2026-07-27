-- Fixes a bug from the previous migration (20260727122104_campaign_npcs_met):
-- its table-redefine emitted `DEFAULT []` (unquoted) for both unresolvedThreads
-- and npcsMet instead of `DEFAULT '[]'`. SQLite silently accepted this and
-- applied it as the backfill default for any *pre-existing* row missing the
-- new npcsMet column, storing an empty string instead of a valid JSON array
-- — which then broke every future read of that row ("Unexpected end of JSON
-- input"). New rows created via Prisma Client afterward were unaffected,
-- since the client supplies the default value explicitly rather than
-- relying on the column's own DEFAULT clause. Still fixing the table-level
-- default itself so no other code path can hit the same bug.

-- Repair any row already corrupted by the previous migration's backfill.
UPDATE "campaigns" SET "npcsMet" = '[]' WHERE "npcsMet" IS NULL OR "npcsMet" = '';
UPDATE "campaigns" SET "unresolvedThreads" = '[]' WHERE "unresolvedThreads" IS NULL OR "unresolvedThreads" = '';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "worldSettingId" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "act" TEXT NOT NULL DEFAULT 'setup',
    "tone" TEXT,
    "digestSummary" TEXT,
    "unresolvedThreads" JSONB NOT NULL DEFAULT '[]',
    "npcsMet" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaigns_worldSettingId_fkey" FOREIGN KEY ("worldSettingId") REFERENCES "world_settings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_campaigns" ("id", "characterId", "worldSettingId", "roomCode", "act", "tone", "digestSummary", "unresolvedThreads", "npcsMet", "status", "createdAt", "updatedAt")
SELECT "id", "characterId", "worldSettingId", "roomCode", "act", "tone", "digestSummary", "unresolvedThreads", "npcsMet", "status", "createdAt", "updatedAt" FROM "campaigns";
DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
CREATE UNIQUE INDEX "campaigns_roomCode_key" ON "campaigns"("roomCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
