import type { Beat } from "@/server/storyEngine/beatSchema";

/**
 * One hand-authored, safe beat per act — used only if 3 real generation
 * attempts all fail content policy. These are generic (not tailored to the
 * specific character/setting) on purpose: they exist purely so a failure
 * never reaches the screen, not to be a great beat. Each one is checked
 * against its own validator in the test suite, so this file can't silently
 * rot into something that would itself fail validation.
 */
export const FALLBACK_BEATS: Record<string, Beat> = {
  setup: {
    prose:
      "The path ahead curls into golden light. Somewhere close, something small and curious is watching from the leaves.",
    choices: [
      {
        text: "Follow the path",
        skill: null,
        dc: null,
        successHint: "The path opens into a peaceful clearing.",
        failureHint: null,
      },
      {
        text: "Call out a friendly hello",
        skill: "heart",
        dc: 8,
        successHint: "A shy little creature peeks out and waves back.",
        failureHint: "No answer yet, but the leaves rustle happily.",
      },
    ],
    dmNotes: "Gentle opener. Either choice leads somewhere pleasant next.",
    imagePrompt: "A sunlit path curling into a peaceful clearing, something small and curious peeking from the leaves.",
    ambientTrack: "forest",
    itemReward: null,
    isEnding: false,
  },
  journey: {
    prose:
      "A friendly little creature hops alongside, leading the way toward a soft glow in the distance.",
    choices: [
      {
        text: "Follow the glow together",
        skill: null,
        dc: null,
        successHint: "The glow turns out to be warm and welcoming.",
        failureHint: null,
      },
      {
        text: "Offer a snack to the new friend",
        skill: "heart",
        dc: 9,
        successHint: "The little creature happily leads the way as thanks.",
        failureHint: "It's too shy for snacks yet, but it still leads the way.",
      },
    ],
    dmNotes: "Low-stakes bonding beat. Keep it warm.",
    imagePrompt: "A small friendly creature leading the way toward a warm distant glow.",
    ambientTrack: "forest",
    itemReward: null,
    isEnding: false,
  },
  complication: {
    prose:
      "A wobbly little slime blocks the way, blinking and bouncing in place. It doesn't look like it wants to move.",
    choices: [
      {
        text: "Tickle it out of the way",
        skill: "cunning",
        dc: 10,
        successHint: "It giggles and bounces off, clearing the path.",
        failureHint: "It just wobbles happily and stays put — try something else next time.",
      },
      {
        text: "Offer it a shiny pebble",
        skill: "heart",
        dc: 10,
        successHint: "Delighted, it rolls aside to let you through.",
        failureHint: "It sniffs the pebble but doesn't budge yet.",
      },
    ],
    dmNotes: "Slimes are always harmless and a little silly. Any outcome here is safe and low-stakes.",
    imagePrompt: "A wobbly, harmless slime blocking a path, blinking and bouncing playfully.",
    ambientTrack: "forest",
    itemReward: null,
    isEnding: false,
  },
  climax: {
    prose:
      "At the top of the hill sits a big, mossy troll, arms crossed, guarding a chest. It looks more lonely than fierce.",
    choices: [
      {
        text: "Tell it a silly joke",
        skill: "heart",
        dc: 11,
        successHint: "The troll laughs so hard it forgets to guard anything, and waves you over to the chest.",
        failureHint: "It doesn't laugh, but it does smile a little and listens to another try.",
      },
      {
        text: "Offer to keep it company",
        skill: "cunning",
        dc: 11,
        successHint: "It brightens up at the company and happily shares what's in the chest.",
        failureHint: "It's still a bit shy, but seems glad someone stopped to talk.",
      },
    ],
    dmNotes: "The troll is lonely, not dangerous. Every outcome should end warmly.",
    imagePrompt: "A big mossy troll guarding a treasure chest, looking lonely rather than fierce.",
    ambientTrack: "danger",
    itemReward: { name: "Mossy Trinket", description: "A small charm the troll was keeping safe." },
    isEnding: false,
  },
  resolution: {
    prose:
      "Everyone gathers together as the light turns golden. It's time to head home, happy and a little sleepy.",
    choices: [
      {
        text: "Wave goodbye to every new friend",
        skill: null,
        dc: null,
        successHint: "Everyone waves back, promising to see you again soon.",
        failureHint: null,
      },
      {
        text: "Sing a little song about the day",
        skill: null,
        dc: null,
        successHint: "Everyone hums along as the adventure comes to a cozy close.",
        failureHint: null,
      },
    ],
    dmNotes: "Closing beat. Either choice ends the session warmly — say their name here.",
    imagePrompt: "A warm golden-hour farewell scene with friendly companions waving goodbye.",
    ambientTrack: "village",
    itemReward: null,
    isEnding: true,
  },
};
