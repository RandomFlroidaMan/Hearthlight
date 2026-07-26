import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { parseFormFieldPdf } from "../formFieldParser";

/**
 * There's no real D&D Beyond / WotC PDF export available to test against in
 * this environment, so this builds a synthetic fillable PDF using the same
 * field names the parser looks for, and round-trips it. This proves the
 * AcroForm-reading mechanism itself works; it does NOT prove the field-name
 * guesses match every real-world export — that only gets verified when a
 * real sheet is uploaded through the confirmation screen.
 */
async function buildSyntheticSheet(fields: Record<string, string>): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([400, 400]);
  const form = pdfDoc.getForm();

  let y = 380;
  for (const [name, value] of Object.entries(fields)) {
    const field = form.createTextField(name);
    field.setText(value);
    field.addToPage(page, { x: 10, y, width: 200, height: 14 });
    y -= 16;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

describe("parseFormFieldPdf", () => {
  it("extracts a fully filled-in synthetic sheet with no warnings about missing core fields", async () => {
    const buffer = await buildSyntheticSheet({
      CharacterName: "Quinn",
      Race: "Halfling",
      ClassLevel: "Rogue 3",
      Background: "Urchin",
      PersonalityTraits: "Brave and giggly",
      STRscore: "10",
      DEXscore: "16",
      CONscore: "12",
      INTscore: "12",
      WISscore: "10",
      CHAscore: "12",
      ProficienciesLang: "Stealth, Sleight of Hand, Common",
      Equipment: "Dagger, Thieves tools",
    });

    const result = await parseFormFieldPdf(buffer);

    expect(result.data.name).toBe("Quinn");
    expect(result.data.race).toBe("Halfling");
    expect(result.data.className).toBe("Rogue");
    expect(result.data.level).toBe(3);
    expect(result.data.background).toBe("Urchin");
    expect(result.data.strength).toBe(10);
    expect(result.data.dexterity).toBe(16);
    expect(result.data.proficiencies).toEqual(["Stealth", "Sleight of Hand", "Common"]);
    expect(result.data.equipment).toEqual(["Dagger", "Thieves tools"]);
    expect(result.warnings).toEqual([]);
  });

  it("defaults missing ability scores to 10 and warns about it instead of crashing", async () => {
    const buffer = await buildSyntheticSheet({
      CharacterName: "Quinn",
      Race: "Halfling",
      ClassLevel: "Rogue 1",
    });

    const result = await parseFormFieldPdf(buffer);

    expect(result.data.strength).toBe(10);
    expect(result.warnings.some((w) => w.includes("Strength"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("Charisma"))).toBe(true);
  });

  it("warns rather than throwing when the name field is entirely absent", async () => {
    const buffer = await buildSyntheticSheet({
      Race: "Elf",
    });

    const result = await parseFormFieldPdf(buffer);

    expect(result.data.name).toBe("");
    expect(result.warnings.some((w) => w.includes("name"))).toBe(true);
  });
});
