-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "setting" TEXT NOT NULL,
    "act" TEXT NOT NULL DEFAULT 'setup',
    "tone" TEXT,
    "digestSummary" TEXT,
    "unresolvedThreads" JSONB NOT NULL DEFAULT [],
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "campaigns_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "prose" TEXT NOT NULL,
    "imagePath" TEXT,
    "dmNotes" TEXT,
    "choices" JSONB NOT NULL,
    "rollResult" JSONB,
    "ambientTrack" TEXT,
    "isEnding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scenes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imagePath" TEXT,
    "earnedAtScene" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "spend_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "costUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spend_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "monthlyCapUsd" REAL,
    "defaultReadingAge" INTEGER NOT NULL DEFAULT 5,
    "narrationMuted" BOOLEAN NOT NULL DEFAULT false,
    "ambienceMuted" BOOLEAN NOT NULL DEFAULT false,
    "effectsMuted" BOOLEAN NOT NULL DEFAULT false,
    "dmFudgeEnabled" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE UNIQUE INDEX "scenes_campaignId_order_key" ON "scenes"("campaignId", "order");
