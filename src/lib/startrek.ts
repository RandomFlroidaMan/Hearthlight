import { findClass, type ClassInfo } from "./dnd";

/**
 * The Star Trek flavor pack — same shape as dnd.ts (species instead of
 * races, ranks instead of classes) so every mechanic downstream
 * (deriveSkills, character creation, the story engine) works completely
 * unchanged. Character.universe / WorldSetting.genre just pick which of
 * these two vocabularies a character or a place uses; the six ability
 * scores and four kid-facing skills mean exactly the same thing either way.
 */

export const SPECIES = [
  "Human",
  "Vulcan",
  "Klingon",
  "Andorian",
  "Trill",
  "Betazoid",
  "Bajoran",
  "Denobulan",
] as const;

export type Species = (typeof SPECIES)[number];

/** `spellcastingAbility` is reused from dnd.ts's ClassInfo shape rather than
 * renamed — it means the same thing here as there: which ability score
 * governs this role's "Magic" kid-stat (a starship officer's training and
 * problem-solving, not literal spellcasting). */
export const RANKS: ClassInfo[] = [
  { name: "Command Officer", kidName: "Brave Captain", spellcastingAbility: "charisma" },
  { name: "Chief Engineer", kidName: "Master Builder", spellcastingAbility: "intelligence" },
  { name: "Science Officer", kidName: "Curious Scientist", spellcastingAbility: "intelligence" },
  { name: "Security Officer", kidName: "Fearless Guard", spellcastingAbility: null },
  { name: "Medical Officer", kidName: "Kind Healer", spellcastingAbility: "wisdom" },
  { name: "Helm Officer", kidName: "Quick Pilot", spellcastingAbility: "dexterity" },
  { name: "Communications Officer", kidName: "Clever Talker", spellcastingAbility: "charisma" },
];

export function findRank(name: string): ClassInfo | undefined {
  return RANKS.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

/** Looks a class/rank name up across both flavor packs — used anywhere a
 * character's className needs its kidName/spellcastingAbility regardless of
 * which universe it belongs to (deriveSkills, character library pages, the
 * story engine's prompt builder). */
export function findClassInfo(name: string): ClassInfo | undefined {
  return findClass(name) ?? findRank(name);
}
