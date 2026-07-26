/** Prisma Json columns come back as `unknown` — this narrows one holding a
 * string array (proficiencies, equipment, spells, referenceImages, etc.)
 * back to string[], dropping anything that isn't actually a string. */
export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
