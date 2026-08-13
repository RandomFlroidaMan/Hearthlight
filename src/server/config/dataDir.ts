import path from "node:path";

/** Base directory for generated art/audio caches. Defaults to `./data`
 * (matching `DATABASE_URL`'s default) but overridable so a production
 * deploy can point both at the same mounted persistent volume. */
export const DATA_DIR = process.env.HEARTHLIGHT_DATA_DIR ?? path.join(process.cwd(), "data");
