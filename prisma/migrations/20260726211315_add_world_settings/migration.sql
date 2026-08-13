/*
  Warnings:

  - You are about to drop the column `setting` on the `campaigns` table. All the data in the column will be lost.
  - Added the required column `worldSettingId` to the `campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "world_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "paletteKey" TEXT,
    "referenceImages" JSONB NOT NULL DEFAULT [],
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "worldSettingId" TEXT NOT NULL,
    "act" TEXT NOT NULL DEFAULT 'setup',
    "tone" TEXT,
    "digestSummary" TEXT,
    "unresolvedThreads" JSONB NOT NULL DEFAULT [],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "campaigns_worldSettingId_fkey" FOREIGN KEY ("worldSettingId") REFERENCES "world_settings" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_campaigns" ("act", "characterId", "createdAt", "digestSummary", "id", "status", "tone", "unresolvedThreads", "updatedAt") SELECT "act", "characterId", "createdAt", "digestSummary", "id", "status", "tone", "unresolvedThreads", "updatedAt" FROM "campaigns";
DROP TABLE "campaigns";
ALTER TABLE "new_campaigns" RENAME TO "campaigns";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
