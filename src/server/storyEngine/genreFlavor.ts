export type Genre = "fantasy" | "star-trek";

/** The minimal shape crossoverGuidance needs — kept local rather than
 * importing the full Prisma Character type, same reasoning as
 * validator.ts's BeatLike: self-contained and easy to test with plain
 * objects. Character's own shape satisfies this structurally. */
export interface CharacterLike {
  name: string;
  universe: string;
}

/**
 * Genre-specific vocabulary/tone guidance folded into the system prompt
 * alongside the universal safety rules (generateBeatContent.ts's
 * GENTLE_SAFETY_RULES / MATURE_SAFETY_RULES). The safety invariants
 * themselves never change between genres — only what "monster" and
 * "adventure" mean in-world.
 */
export const GENRE_FLAVOR: Record<Genre, string> = {
  fantasy: "",
  "star-trek": `STAR TREK FLAVOR — this adventure is set aboard a starship and on alien worlds, not a fantasy realm:
- Replace fantasy vocabulary with Star Trek equivalents: a "monster" is a hostile alien creature, a malfunctioning hologram, an unstable anomaly, or an away-mission hazard — never a human, never a fellow crew member.
- Draw on real Star Trek texture: phasers (always set to stun, never lethal), tricorders, transporters, replicators, the holodeck, shuttlecraft, away missions, first contact with a new species, diplomacy, a warp-core problem to solve cleverly.
- Tone: wonder, curiosity, and "boldly go" exploration — discovery and clever problem-solving matter as much as any confrontation.
- Every safety rule above still applies exactly as written, just retargeted: "defeated/bonked/out-smarted/chased off" becomes "stunned, outsmarted, beamed away, calmed down, or made a new friend of" — never harm to any creature or crew member.`,
};

/**
 * When a party mixes characters from both flavor packs in the same
 * campaign (a Klingon warrior playing in a fantasy party, or vice versa) —
 * the "pulled through a portal" premise the brief asked for. Detected
 * purely from data (WorldSetting.genre vs each Character.universe), so no
 * separate flag is needed anywhere else.
 */
export function crossoverGuidance(genre: Genre, characters: CharacterLike[]): string | null {
  const outsiders = characters.filter((c) => c.universe !== genre);
  if (outsiders.length === 0) return null;

  const names = outsiders.map((c) => c.name).join(", ");
  const outsiderIsStarTrek = outsiders[0].universe === "star-trek";
  const home = outsiderIsStarTrek ? "a starship crew" : "fantasy-world adventurers";
  const here = genre === "star-trek" ? "aboard this ship or mission" : "in this fantasy realm";

  return `CROSSOVER: ${names} come from a very different kind of world than the rest of this story (${home}), and are now unexpectedly here ${here}. The first time they appear (ideally the opening beat), briefly explain in one gentle, wondrous line that a strange portal or anomaly pulled them here and they're presently stuck, trying to find a way home while adventuring together with the rest of the party. After that first mention, treat it as an accepted, ongoing fact of the story — don't re-explain it every beat.`;
}
