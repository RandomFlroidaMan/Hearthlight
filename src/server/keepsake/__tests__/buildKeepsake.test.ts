import "@/server/sheets/pdfWorkerSetup";
import { describe, expect, it } from "vitest";
import { PDFParse } from "pdf-parse";
import { PDFDocument } from "pdf-lib";
import { PDFDocument as PDFDocumentForFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildKeepsake, pickProseSize, wrapLineCount, type KeepsakeCampaign } from "../buildKeepsake";

const SECRET_DM_NOTE = "SECRET_DM_ONLY_NOTE_should_never_appear_in_keepsake";

function fakeCampaign(overrides: Partial<KeepsakeCampaign> = {}): KeepsakeCampaign {
  const now = new Date();
  return {
    id: "camp-1",
    characterId: "char-1",
    worldSettingId: "world-1",
    roomCode: "TEST",
    act: "resolution",
    tone: null,
    digestSummary: null,
    unresolvedThreads: [],
    npcsMet: [],
    status: "ended",
    createdAt: now,
    updatedAt: now,
    character: {
      id: "char-1",
      name: "Quinn",
      displayName: "Quinn the Brave",
      race: "Halfling",
      className: "Rogue",
      level: 1,
      strength: 10,
      dexterity: 14,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 12,
      proficiencies: [],
      equipment: [],
      spells: [],
      background: null,
      personality: null,
      appearance: null,
      readingAge: 5,
      portraitPath: null,
      sourceSheet: null,
      createdAt: now,
      updatedAt: now,
    },
    worldSetting: {
      id: "world-1",
      name: "The Wandering Bog",
      description: "A bog town on a giant turtle's back.",
      paletteKey: null,
      referenceImages: [],
      lastSceneImage: null,
      createdAt: now,
      updatedAt: now,
    },
    scenes: [
      {
        id: "scene-1",
        campaignId: "camp-1",
        order: 1,
        act: "setup",
        prose: "Quinn stood on Mossback Turtle, ready for adventure.",
        imagePath: null,
        imagePrompt: null,
        dmNotes: SECRET_DM_NOTE,
        choices: [],
        rollResult: null,
        ambientTrack: "village",
        narrationPath: null,
        choiceText: null,
        isEnding: false,
        createdAt: now,
      },
      {
        id: "scene-2",
        campaignId: "camp-1",
        order: 2,
        act: "resolution",
        prose: "Everyone gathered together as the light turned golden.",
        imagePath: null,
        imagePrompt: null,
        dmNotes: SECRET_DM_NOTE,
        choices: [],
        rollResult: { skill: "heart", dc: 12, raw: 15, modifier: 2, total: 17, success: true },
        ambientTrack: "village",
        narrationPath: null,
        choiceText: "Wave goodbye to every new friend",
        isEnding: true,
        createdAt: now,
      },
    ],
    items: [{ id: "item-1", campaignId: "camp-1", name: "Mossy Trinket", description: "A small lucky charm.", imagePath: null, earnedAtScene: 2, createdAt: now }],
    ...overrides,
  };
}

async function extractText(bytes: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(bytes) });
  const result = await parser.getText();
  return result.text;
}

describe("buildKeepsake", () => {
  it("produces one page for the cover, one per scene, an items page, and a closing page", async () => {
    const bytes = await buildKeepsake(fakeCampaign());
    const doc = await PDFDocument.load(bytes);
    // cover + 2 scenes + items + closing
    expect(doc.getPageCount()).toBe(5);
  });

  it("omits the items page when nothing was earned", async () => {
    const bytes = await buildKeepsake(fakeCampaign({ items: [] }));
    const doc = await PDFDocument.load(bytes);
    // cover + 2 scenes + closing, no items page
    expect(doc.getPageCount()).toBe(4);
  });

  it("includes character name, world setting, scene prose, and choice text", async () => {
    const bytes = await buildKeepsake(fakeCampaign());
    const text = await extractText(bytes);
    expect(text).toContain("Quinn the Brave");
    expect(text).toContain("The Wandering Bog");
    expect(text).toContain("Mossback Turtle");
    expect(text).toContain("Wave goodbye to every new friend");
    expect(text).toContain("Mossy Trinket");
  });

  it("never leaks DM notes or roll mechanics into the output", async () => {
    const bytes = await buildKeepsake(fakeCampaign());
    const text = await extractText(bytes);
    expect(text).not.toContain(SECRET_DM_NOTE);
    expect(text).not.toContain("DC");
    expect(text).not.toMatch(/\bheart\b/i);
  });

  it("highlights a natural 20 without leaking DC or skill name", async () => {
    const campaign = fakeCampaign();
    campaign.scenes[1].rollResult = {
      skill: "heart",
      dc: 12,
      raw: 20,
      modifier: 2,
      total: 22,
      success: true,
      isNatural20: true,
      isNatural1: false,
    };
    const bytes = await buildKeepsake(campaign);
    const text = await extractText(bytes);
    expect(text).toContain("perfect roll");
    expect(text).not.toContain("DC");
    expect(text).not.toMatch(/\bheart\b/i);
  });

  it("highlights a natural 1 with a gentler note", async () => {
    const campaign = fakeCampaign();
    campaign.scenes[1].rollResult = {
      skill: "might",
      dc: 8,
      raw: 1,
      modifier: 1,
      total: 2,
      success: false,
      isNatural20: false,
      isNatural1: true,
    };
    const bytes = await buildKeepsake(campaign);
    const text = await extractText(bytes);
    expect(text).toContain("wobbly roll");
  });

  it("adds no highlight for an ordinary roll", async () => {
    const bytes = await buildKeepsake(fakeCampaign());
    const text = await extractText(bytes);
    expect(text).not.toContain("perfect roll");
    expect(text).not.toContain("wobbly roll");
  });
});

describe("pickProseSize", () => {
  // Regression test: a real generated keepsake once ran prose off the
  // bottom of the page because the font size was fixed regardless of line
  // count. Reading-age-3 beats in particular can be many short one-line
  // sentences (9-10 lines is common), well beyond the "2-4 sentences" the
  // story engine's prompt asks for but doesn't strictly enforce.
  async function embedTestFont() {
    const pdfDoc = await PDFDocumentForFonts.create();
    pdfDoc.registerFontkit(fontkit);
    const bytes = await readFile(
      path.join(process.cwd(), "src/server/keepsake/fonts/ComicNeue-Regular.woff2"),
    );
    return pdfDoc.embedFont(bytes);
  }

  const MAX_WIDTH = 792 - 48 * 2;
  const AVAILABLE_HEIGHT = 230 - 20 - 16;

  it("chosen size always fits the available height, across a range of realistic prose lengths", async () => {
    const font = await embedTestFont();
    const shortProse = "Quinn stood on Mossback Turtle.\nThe turtle was big and green.";
    const manyShortLines = Array.from({ length: 10 }, (_, i) => `Line number ${i + 1} of the story.`).join("\n");
    const oneVeryLongSentence =
      "Quinn and the bubble imp and the pink slime and the blue frog all wandered together down the winding mossy path toward the glowing lantern in the distance, giggling the whole way.";

    for (const prose of [shortProse, manyShortLines, oneVeryLongSentence]) {
      const { size, lineHeight } = pickProseSize(font, prose, MAX_WIDTH, AVAILABLE_HEIGHT);
      const lines = wrapLineCount(font, prose, size, MAX_WIDTH);
      expect(lines * lineHeight).toBeLessThanOrEqual(AVAILABLE_HEIGHT + 1); // +1 for float rounding
    }
  });

  it("uses the largest candidate size for short prose", async () => {
    const font = await embedTestFont();
    const { size } = pickProseSize(font, "A short line.", MAX_WIDTH, AVAILABLE_HEIGHT);
    expect(size).toBe(15);
  });

  it("shrinks below the default size for the many-short-lines case that previously overflowed", async () => {
    const font = await embedTestFont();
    // 194pt available at the default 19pt line height fits ~10 lines — 12
    // is enough to force a smaller size, matching the real overflow this
    // regression test guards against.
    const manyShortLines = Array.from({ length: 12 }, (_, i) => `Short line ${i + 1} here now.`).join("\n");
    const { size } = pickProseSize(font, manyShortLines, MAX_WIDTH, AVAILABLE_HEIGHT);
    expect(size).toBeLessThan(15);
  });
});
