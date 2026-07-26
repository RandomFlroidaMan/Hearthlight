/**
 * Static 5e reference data: races, classes, and the 18 standard skills mapped
 * to their governing ability score. Used by character creation and by
 * deriveSkills.ts to turn a real 5e sheet into the four kid-facing stats.
 */

export const RACES = [
  "Human",
  "Elf",
  "Dwarf",
  "Halfling",
  "Dragonborn",
  "Gnome",
  "Half-Elf",
  "Half-Orc",
  "Tiefling",
] as const;

export type Race = (typeof RACES)[number];

export type AbilityName =
  | "strength"
  | "dexterity"
  | "constitution"
  | "intelligence"
  | "wisdom"
  | "charisma";

export interface ClassInfo {
  name: string;
  /** Shown to a 3-year-old instead of the real class name; toggle-able off as they grow. */
  kidName: string;
  /** Primary spellcasting ability, or null for a non-caster (Fighter, Rogue, Barbarian, Monk). */
  spellcastingAbility: AbilityName | null;
}

export const CLASSES: ClassInfo[] = [
  { name: "Barbarian", kidName: "Mighty Smasher", spellcastingAbility: null },
  { name: "Bard", kidName: "Cheerful Singer", spellcastingAbility: "charisma" },
  { name: "Cleric", kidName: "Kind Healer", spellcastingAbility: "wisdom" },
  { name: "Druid", kidName: "Nature Friend", spellcastingAbility: "wisdom" },
  { name: "Fighter", kidName: "Brave Knight", spellcastingAbility: null },
  { name: "Monk", kidName: "Swift Wanderer", spellcastingAbility: null },
  { name: "Paladin", kidName: "Shining Guardian", spellcastingAbility: "charisma" },
  { name: "Ranger", kidName: "Forest Tracker", spellcastingAbility: "wisdom" },
  { name: "Rogue", kidName: "Sneaky Scout", spellcastingAbility: null },
  { name: "Sorcerer", kidName: "Spark Weaver", spellcastingAbility: "charisma" },
  { name: "Warlock", kidName: "Mystery Whisperer", spellcastingAbility: "charisma" },
  { name: "Wizard", kidName: "Clever Mage", spellcastingAbility: "intelligence" },
];

export function findClass(name: string): ClassInfo | undefined {
  return CLASSES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

/** The 18 standard 5e skills, mapped to the ability score that governs them. */
export const SKILLS_BY_ABILITY: Record<string, AbilityName> = {
  Athletics: "strength",
  Acrobatics: "dexterity",
  "Sleight of Hand": "dexterity",
  Stealth: "dexterity",
  Arcana: "intelligence",
  History: "intelligence",
  Investigation: "intelligence",
  Nature: "intelligence",
  Religion: "intelligence",
  "Animal Handling": "wisdom",
  Insight: "wisdom",
  Medicine: "wisdom",
  Perception: "wisdom",
  Survival: "wisdom",
  Deception: "charisma",
  Intimidation: "charisma",
  Performance: "charisma",
  Persuasion: "charisma",
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}
