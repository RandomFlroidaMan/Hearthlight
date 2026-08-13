-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_scenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "act" TEXT NOT NULL DEFAULT 'setup',
    "prose" TEXT NOT NULL,
    "imagePath" TEXT,
    "imagePrompt" TEXT,
    "dmNotes" TEXT,
    "choices" JSONB NOT NULL,
    "rollResult" JSONB,
    "ambientTrack" TEXT,
    "isEnding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scenes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_scenes" ("ambientTrack", "campaignId", "choices", "createdAt", "dmNotes", "id", "imagePath", "imagePrompt", "isEnding", "order", "prose", "rollResult") SELECT "ambientTrack", "campaignId", "choices", "createdAt", "dmNotes", "id", "imagePath", "imagePrompt", "isEnding", "order", "prose", "rollResult" FROM "scenes";
DROP TABLE "scenes";
ALTER TABLE "new_scenes" RENAME TO "scenes";
CREATE UNIQUE INDEX "scenes_campaignId_order_key" ON "scenes"("campaignId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
