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
  paletteKey: (typeof PALETTE_KEYS)[number] | null;
  tone: string;
  /** Which flavor pack this story belongs to — drives which genre-specific
   * guidance the story engine folds into the prompt (src/server/storyEngine/
   * genreFlavor.ts). Defaults to "fantasy" for every existing adventure. */
  genre: "fantasy" | "star-trek";
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
    genre: "fantasy",
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
    genre: "fantasy",
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
    genre: "fantasy",
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
    genre: "fantasy",
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
    genre: "fantasy",
  },
  {
    id: "starship-wonderlight",
    title: "The Starship Wonderlight",
    blurb: "A gleaming starship on a mission to chart new stars — every day brings a new world, a new alien friend, and a new mystery.",
    worldSettingName: "The Starship Wonderlight",
    worldSettingDescription:
      "A bright, humming starship gliding between stars, its viewports full of nebulae and unfamiliar constellations — full of curious crewmates, a busy transporter room, and a holodeck for practicing before every away mission.",
    paletteKey: null,
    tone: "curious and adventurous, full of wonder at what's over the next star",
    genre: "star-trek",
  },
  {
    id: "starbase-nine",
    title: "Starbase Nine at the Edge of Charted Space",
    blurb: "A bustling space station where a hundred different alien species trade, argue, and become friends at the edge of the known galaxy.",
    worldSettingName: "Starbase Nine",
    worldSettingDescription:
      "A busy ring-shaped space station perched at the last outpost before uncharted space, its promenade full of alien merchants, diplomats, and travelers from a dozen worlds, always one docking bay away from a new arrival.",
    paletteKey: null,
    tone: "bustling and social, a puzzle-box of different alien customs to learn",
    genre: "star-trek",
  },
  {
    id: "the-shy-forest-world",
    title: "The Shy Forest World",
    blurb: "A first-contact mission to a jungle planet whose people only reveal themselves to visitors who prove they mean well.",
    worldSettingName: "Ilvara Prime",
    worldSettingDescription:
      "A misty, bioluminescent jungle world whose gentle, telepathic native people communicate through glowing plants and only show themselves to visitors who approach with patience and kindness.",
    paletteKey: null,
    tone: "gentle and curious, about earning trust rather than winning a fight",
    genre: "star-trek",
  },
  {
    id: "the-drifting-derelict",
    title: "The Drifting Derelict",
    blurb: "An abandoned generation-ship found tumbling silently through space, full of old puzzles, and maybe not as empty as it looks.",
    worldSettingName: "The Kelvara Wanderer",
    worldSettingDescription:
      "A vast, silent generation-ship found adrift after generations lost to the void, its corridors dim and creaking, its old systems full of half-solved puzzles and strange, gentle machine-minds still humming along inside.",
    paletteKey: null,
    tone: "quietly mysterious and puzzle-driven, a little spooky but never scary",
    genre: "star-trek",
  },
  {
    id: "holodeck-malfunction",
    title: "The Holodeck That Wouldn't Turn Off",
    blurb: "A glitching holodeck program traps the crew inside a story of its own making — and the only way out is to finish it.",
    worldSettingName: "Holodeck Program Seven",
    worldSettingDescription:
      "A holographic simulation stuck in a loop, its safety protocols flickering, spinning up wilder and wilder simulated worlds each time the crew tries to find the exit arch.",
    paletteKey: null,
    tone: "playful and a little surreal, a story-within-a-story",
    genre: "star-trek",
  },
];

export function findAdventure(id: string): Adventure | undefined {
  return ADVENTURES.find((a) => a.id === id);
}
