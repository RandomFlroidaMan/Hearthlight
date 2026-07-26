-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_spend_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "costUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spend_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_spend_logs" ("amount", "campaignId", "costUsd", "createdAt", "id", "kind") SELECT "amount", "campaignId", "costUsd", "createdAt", "id", "kind" FROM "spend_logs";
DROP TABLE "spend_logs";
ALTER TABLE "new_spend_logs" RENAME TO "spend_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
