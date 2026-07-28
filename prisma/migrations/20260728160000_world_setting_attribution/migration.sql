-- Attribution for the shared world setting library: which family built a
-- given place, shown as "built by The Fugetts" so families can tell whose
-- adventures they're browsing. Nullable so every existing row (created
-- before this column existed) simply shows no attribution.
ALTER TABLE "world_settings" ADD COLUMN "createdByFamilyId" TEXT REFERENCES "families" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
