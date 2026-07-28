import { abilityModifier, proficiencyBonus, type AbilityName } from "./dnd";
import { findClassInfo } from "./startrek";

export interface DerivedSkillsInput {
  className: string;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficiencies: string[];
}

export interface DerivedSkills {
  might: number;
  magic: number;
  cunning: number;
  heart: number;
}

/**
 * Maps the four kid-facing skills onto real 5e mechanics. There's no single
 * "correct" mapping in the brief, so the reasoning is spelled out here:
 *
 * - Might: physical strength -> Strength score, bumped by Athletics proficiency.
 * - Cunning: quick and clever -> Dexterity score, bumped by proficiency in any
 *   of the sneaky/quick-witted skills (Stealth, Sleight of Hand, Acrobatics,
 *   Investigation, Deception).
 * - Magic: a caster's spellcasting ability (Int/Wis/Cha depending on class);
 *   non-casters (Fighter, Rogue, Barbarian, Monk) fall back to Intelligence,
 *   representing puzzle-solving rather than spellcasting. Bumped by Arcana,
 *   Nature, or Religion proficiency.
 * - Heart: kindness and charm -> average of Charisma and Wisdom, bumped by
 *   Persuasion, Animal Handling, Insight, Medicine, or Performance.
 *
 * Each stat is (governing ability modifier) + (proficiency bonus if
 * proficient in a relevant skill), matching how 5e itself computes a skill
 * check modifier.
 */
const CUNNING_SKILLS = ["Stealth", "Sleight of Hand", "Acrobatics", "Investigation", "Deception"];
const MAGIC_SKILLS = ["Arcana", "Nature", "Religion"];
const HEART_SKILLS = ["Persuasion", "Animal Handling", "Insight", "Medicine", "Performance"];
const MIGHT_SKILLS = ["Athletics"];

function hasAnyProficiency(proficiencies: string[], relevant: string[]): boolean {
  const normalized = new Set(proficiencies.map((p) => p.trim().toLowerCase()));
  return relevant.some((skill) => normalized.has(skill.toLowerCase()));
}

function scoreFor(
  input: DerivedSkillsInput,
  ability: AbilityName,
  relevantSkills: string[],
): number {
  const base = abilityModifier(input[ability]);
  const bump = hasAnyProficiency(input.proficiencies, relevantSkills)
    ? proficiencyBonus(input.level)
    : 0;
  return base + bump;
}

export function deriveSkills(input: DerivedSkillsInput): DerivedSkills {
  const classInfo = findClassInfo(input.className);
  const magicAbility: AbilityName = classInfo?.spellcastingAbility ?? "intelligence";

  const heartBase = Math.round(
    (abilityModifier(input.charisma) + abilityModifier(input.wisdom)) / 2,
  );
  const heartBump = hasAnyProficiency(input.proficiencies, HEART_SKILLS)
    ? proficiencyBonus(input.level)
    : 0;

  return {
    might: scoreFor(input, "strength", MIGHT_SKILLS),
    cunning: scoreFor(input, "dexterity", CUNNING_SKILLS),
    magic: scoreFor(input, magicAbility, MAGIC_SKILLS),
    heart: heartBase + heartBump,
  };
}
