import type { PALETTE_KEYS } from "./worldSettingPalettes";

/**
 * The "pick a story" library — prebuilt adventure premises so a family can
 * start playing immediately instead of building a World Setting from
 * scratch every time. Selecting one auto-creates (or reuses) a matching
 * WorldSetting row; nothing here is itself persisted to the database.
 */
export interface Adventure {
  id: string;
  title: string;
  blurb: string;
  worldSettingName: string;
  worldSettingDescription: string;
  paletteKey: (typeof PALETTE_KEYS)[number];
  tone: string;
}

export const ADVENTURES: Adventure[] = [
  {
    id: "wandering-bog",
    title: "The Wandering Bog",
    blurb: "A whole town balanced on the back of a giant, slow-wandering turtle, drifting wherever it pleases.",
    worldSettingName: "The Wandering Bog",
    worldSettingDescription:
      "A cozy town of stilted wooden houses and lantern-strung bridges, all built on the broad, moss-covered shell of an enormous, gentle turtle that wanders wherever it likes through misty wetlands.",
    paletteKey: "forest",
    tone: "cozy and curious, with a slow, wandering pace",
  },
  {
    id: "lighthouse-at-the-edge",
    title: "The Lighthouse at the Edge of the Map",
    blurb: "A lighthouse keeper's lantern doesn't just warn ships away — it lights the path to somewhere new every night.",
    worldSettingName: "The Edge-of-the-Map Lighthouse",
    worldSettingDescription:
      "A tall, weathered lighthouse on a rocky point where the coastline just stops — beyond it, the sea glows faintly and leads to a new, small island every night the lamp is lit.",
    paletteKey: "coast",
    tone: "salty and adventurous, a new little discovery each visit",
  },
  {
    id: "cloudpeak-market",
    title: "The Cloudpeak Sky-Market",
    blurb: "A floating mountain market where merchants ride friendly wind-drakes between stalls stacked on the clouds.",
    worldSettingName: "Cloudpeak Sky-Market",
    worldSettingDescription:
      "A bustling market built across floating mountain peaks and rope bridges above the clouds, where friendly wind-drakes carry goods (and passengers) between stalls selling impossible things.",
    paletteKey: "mountain",
    tone: "bright, bustling, and a little dizzying in a fun way",
  },
  {
    id: "lantern-hollow",
    title: "Lantern Hollow",
    blurb: "A moonlit village where every house grows its own lantern-fruit tree to light the night.",
    worldSettingName: "Lantern Hollow",
    worldSettingDescription:
      "A small village nestled in a hollow beneath old trees, each yard growing its own glowing lantern-fruit that lights up after dusk, drawing fireflies and soft night creatures out to play.",
    paletteKey: "night",
    tone: "quiet, warm, and gently magical",
  },
  {
    id: "greatroot-hollow",
    title: "Greatroot Hollow",
    blurb: "A whole kingdom of tunnels and treehouses built into the roots of one impossibly enormous tree.",
    worldSettingName: "Greatroot Hollow",
    worldSettingDescription:
      "A sprawling network of tunnels, rope ladders, and treehouse rooms built into and around the roots and trunk of one single, impossibly enormous ancient tree, home to dozens of small forest folk.",
    paletteKey: "forest",
    tone: "warm and homey, full of little neighbors and hidden rooms",
  },
];

export function findAdventure(id: string): Adventure | undefined {
  return ADVENTURES.find((a) => a.id === id);
}
