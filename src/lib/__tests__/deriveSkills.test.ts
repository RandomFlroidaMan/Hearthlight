import { describe, expect, it } from "vitest";
import { deriveSkills } from "../deriveSkills";

describe("deriveSkills", () => {
  it("computes Might from Strength and rewards Athletics proficiency", () => {
    const base = deriveSkills({
      className: "Fighter",
      level: 1,
      strength: 16,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      proficiencies: [],
    });
    expect(base.might).toBe(3); // STR 16 -> +3 modifier, no proficiency bump

    const withAthletics = deriveSkills({
      className: "Fighter",
      level: 1,
      strength: 16,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      proficiencies: ["Athletics"],
    });
    expect(withAthletics.might).toBe(5); // +3 modifier + 2 proficiency bonus at level 1
  });

  it("uses the class's spellcasting ability for Magic, and falls back to Intelligence for non-casters", () => {
    const wizard = deriveSkills({
      className: "Wizard",
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
      proficiencies: [],
    });
    expect(wizard.magic).toBe(4); // INT 18 -> +4, Wizard casts off INT

    const bard = deriveSkills({
      className: "Bard",
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 18,
      proficiencies: [],
    });
    expect(bard.magic).toBe(4); // Bard casts off CHA, not INT

    const rogue = deriveSkills({
      className: "Rogue",
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 14,
      wisdom: 10,
      charisma: 10,
      proficiencies: [],
    });
    expect(rogue.magic).toBe(2); // non-caster falls back to INT
  });

  it("averages Charisma and Wisdom for Heart", () => {
    const result = deriveSkills({
      className: "Cleric",
      level: 1,
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 16, // +3
      charisma: 12, // +1
      proficiencies: [],
    });
    expect(result.heart).toBe(2); // round((3 + 1) / 2)
  });

  it("scales the proficiency bump with level", () => {
    const level5 = deriveSkills({
      className: "Rogue",
      level: 5,
      strength: 10,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      proficiencies: ["Stealth"],
    });
    expect(level5.cunning).toBe(5); // DEX 14 -> +2, level 5 proficiency bonus +3
  });
});
