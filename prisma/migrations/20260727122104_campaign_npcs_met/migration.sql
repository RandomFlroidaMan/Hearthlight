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
    "unresolvedThreads" JSONB NOT NULL DEFAULT [],
    "npcsMet" JSONB NOT NULL DEFAULT [],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaigns_worldSettingId_fkey" FOREIGN KEY ("worldSettingId") REFERENCES "world_settings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_campaigns" ("act", "characterId", "createdAt", "digestSummary", "id", "roomCode", "status", "tone", "unresolvedThreads", "updatedAt", "worldSettingId") SELECT "act", "characterId", "createdAt", "digestSummary", "id", "roomCode", "status", "tone", "unresolvedThreads", "updatedAt", "worldSettingId" FROM "campaigns";
DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
CREATE UNIQUE INDEX "campaigns_roomCode_key" ON "campaigns"("roomCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
