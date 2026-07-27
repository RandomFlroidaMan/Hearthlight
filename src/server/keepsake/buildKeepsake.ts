import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readImageBytes } from "@/server/art/imageStore";
import type { Campaign, Character, Item, Scene, WorldSetting } from "@/generated/prisma/client";

/**
 * Compiles a finished (or in-progress) campaign into a printable storybook
 * PDF — cover, one page per scene, an earned-items page, and a closing
 * page. This gets exactly what the story screen gets: prose, choice text,
 * and art. Never DM notes, DCs, skill names, or roll numbers — a keepsake
 * of the story, not the game mechanics, matching the same content boundary
 * StoryScreenView has held since Phase 4.
 */

// US Letter landscape at 72dpi — matches the scene art's own 16:9 aspect
// ratio (SIZES.scene in artDirection.ts) closely enough that images fill
// most of the frame without heavy letterboxing.
const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN = 48;
const IMAGE_TOP_GAP = 24;
// Fixed reserved height for prose on every scene page, regardless of image
// size — prose length varies a lot in practice (reading-age-3 beats can be
// many very short one-line sentences), so the font size below is chosen
// dynamically per scene to fit this zone rather than assuming a line count.
const TEXT_ZONE_HEIGHT = 230;
const IMAGE_ZONE_HEIGHT = PAGE_HEIGHT - TEXT_ZONE_HEIGHT - IMAGE_TOP_GAP;
const TEXT_CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Candidate prose sizes, largest first — descending until the wrapped
 * text fits the available height, so long prose shrinks gracefully instead
 * of running off the bottom of the page. */
const PROSE_SIZE_CANDIDATES = [15, 14, 13, 12, 11, 10, 9];

const INK = rgb(0.15, 0.1, 0.05);
const INK_SOFT = rgb(0.4, 0.32, 0.22);

const FONTS_DIR = path.join(process.cwd(), "src", "server", "keepsake", "fonts");

async function loadFonts(pdfDoc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  pdfDoc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "ComicNeue-Regular.woff2")),
    readFile(path.join(FONTS_DIR, "ComicNeue-Bold.woff2")),
  ]);
  const [regular, bold] = await Promise.all([pdfDoc.embedFont(regularBytes), pdfDoc.embedFont(boldBytes)]);
  return { regular, bold };
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  opts: { font: PDFFont; size: number; y: number; color?: ReturnType<typeof rgb> },
): void {
  const width = opts.font.widthOfTextAtSize(text, opts.size);
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.color ?? INK,
  });
}

/** How many lines `text` occupies when drawn at `size` wrapped to
 * `maxWidth` — mirrors pdf-lib's own drawText wrapping (hard breaks on
 * `\n`, then greedy word-wrap) closely enough to size-pick against. */
export function wrapLineCount(font: PDFFont, text: string, size: number, maxWidth: number): number {
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines += 1;
      continue;
    }
    let lineWidth = 0;
    let linesForParagraph = 1;
    for (const word of words) {
      const wordWidth = font.widthOfTextAtSize(`${word} `, size);
      if (lineWidth + wordWidth > maxWidth && lineWidth > 0) {
        linesForParagraph += 1;
        lineWidth = wordWidth;
      } else {
        lineWidth += wordWidth;
      }
    }
    lines += linesForParagraph;
  }
  return lines;
}

/** Picks the largest candidate size whose wrapped text fits within
 * `availableHeight`, falling back to the smallest candidate (rather than
 * throwing) if even that doesn't fit — a readable-but-tight page beats a
 * crash or silently clipped text. */
export function pickProseSize(
  font: PDFFont,
  text: string,
  maxWidth: number,
  availableHeight: number,
): { size: number; lineHeight: number } {
  for (const size of PROSE_SIZE_CANDIDATES) {
    const lineHeight = size + 4;
    const lines = wrapLineCount(font, text, size, maxWidth);
    if (lines * lineHeight <= availableHeight) {
      return { size, lineHeight };
    }
  }
  const size = PROSE_SIZE_CANDIDATES[PROSE_SIZE_CANDIDATES.length - 1];
  return { size, lineHeight: size + 3 };
}

/** Embeds a PNG and scales it to fit inside `box` without distortion,
 * centered within it. Generated art (portraits and scenes) is always PNG,
 * per imageStore.ts. */
async function drawImageFit(
  pdfDoc: PDFDocument,
  page: PDFPage,
  imageBytes: Buffer,
  box: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const image = await pdfDoc.embedPng(imageBytes);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, {
    x: box.x + (box.width - w) / 2,
    y: box.y + (box.height - h) / 2,
    width: w,
    height: h,
  });
}

export type KeepsakeCampaign = Campaign & {
  character: Character;
  worldSetting: WorldSetting;
  /** Must be ordered ascending by `order`. */
  scenes: Scene[];
  items: Item[];
};

export async function buildKeepsake(campaign: KeepsakeCampaign): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const { regular, bold } = await loadFonts(pdfDoc);
  const heroName = campaign.character.displayName ?? campaign.character.name;

  // --- Cover page ---
  const cover = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  if (campaign.character.portraitPath) {
    const portraitBytes = await readImageBytes(campaign.character.portraitPath);
    const size = 260;
    await drawImageFit(pdfDoc, cover, portraitBytes, {
      x: (PAGE_WIDTH - size) / 2,
      y: PAGE_HEIGHT - size - 90,
      width: size,
      height: size,
    });
  }
  drawCenteredText(cover, heroName, { font: bold, size: 32, y: PAGE_HEIGHT - 470 });
  drawCenteredText(cover, `An adventure in ${campaign.worldSetting.name}`, {
    font: regular,
    size: 18,
    y: PAGE_HEIGHT - 500,
  });
  drawCenteredText(cover, new Date(campaign.createdAt).toLocaleDateString(), {
    font: regular,
    size: 11,
    y: 48,
    color: INK_SOFT,
  });

  // --- One page per scene ---
  const TEXT_TOP_PADDING = 20;
  const CHOICE_TEXT_HEIGHT = 24;
  const BOTTOM_PADDING = 16;

  for (const scene of campaign.scenes) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (scene.imagePath) {
      const bytes = await readImageBytes(scene.imagePath);
      await drawImageFit(pdfDoc, page, bytes, {
        x: MARGIN,
        y: TEXT_ZONE_HEIGHT,
        width: PAGE_WIDTH - MARGIN * 2,
        height: IMAGE_ZONE_HEIGHT,
      });
    }

    let textY = TEXT_ZONE_HEIGHT - TEXT_TOP_PADDING;
    let proseAvailableHeight = TEXT_ZONE_HEIGHT - TEXT_TOP_PADDING - BOTTOM_PADDING;
    if (scene.choiceText) {
      page.drawText(`→ ${scene.choiceText}`, {
        x: MARGIN,
        y: textY,
        size: 12,
        font: regular,
        color: INK_SOFT,
        maxWidth: TEXT_CONTENT_WIDTH,
      });
      textY -= CHOICE_TEXT_HEIGHT;
      proseAvailableHeight -= CHOICE_TEXT_HEIGHT;
    }

    const { size, lineHeight } = pickProseSize(regular, scene.prose, TEXT_CONTENT_WIDTH, proseAvailableHeight);
    page.drawText(scene.prose, {
      x: MARGIN,
      y: textY,
      size,
      font: regular,
      color: INK,
      maxWidth: TEXT_CONTENT_WIDTH,
      lineHeight,
    });
  }

  // --- Items page (only if anything was earned) ---
  if (campaign.items.length > 0) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawCenteredText(page, "Treasures Found", { font: bold, size: 26, y: PAGE_HEIGHT - 90 });
    let y = PAGE_HEIGHT - 150;
    for (const item of campaign.items) {
      page.drawText(item.name, { x: MARGIN, y, size: 16, font: bold, color: INK });
      y -= 22;
      if (item.description) {
        page.drawText(item.description, {
          x: MARGIN,
          y,
          size: 13,
          font: regular,
          color: INK_SOFT,
          maxWidth: PAGE_WIDTH - MARGIN * 2,
          lineHeight: 16,
        });
        y -= 38;
      } else {
        y -= 16;
      }
    }
  }

  // --- Closing page ---
  const closing = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawCenteredText(closing, "The End", { font: bold, size: 40, y: PAGE_HEIGHT / 2 + 40 });
  drawCenteredText(closing, `${heroName}'s adventure, remembered forever.`, {
    font: regular,
    size: 16,
    y: PAGE_HEIGHT / 2 - 10,
  });
  drawCenteredText(closing, `Created with Hearthlight · ${new Date().toLocaleDateString()}`, {
    font: regular,
    size: 10,
    y: 40,
    color: INK_SOFT,
  });

  return pdfDoc.save();
}
