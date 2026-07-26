export const ACT_ORDER = ["setup", "journey", "complication", "climax", "resolution"] as const;
export type Act = (typeof ACT_ORDER)[number];

/**
 * How many scenes each act gets before advancing, by reading age. Younger
 * kids get a shorter arc; older kids get more room in the middle acts.
 * Not from the brief verbatim (it says "steers pacing" without giving
 * numbers) — this is a documented, tunable heuristic, not a rigid rule.
 */
const ACT_LENGTH_BY_READING_AGE: Record<number, Record<Act, number>> = {
  3: { setup: 1, journey: 1, complication: 1, climax: 1, resolution: 1 },
  5: { setup: 1, journey: 2, complication: 1, climax: 1, resolution: 1 },
  7: { setup: 1, journey: 2, complication: 2, climax: 1, resolution: 1 },
  10: { setup: 2, journey: 3, complication: 2, climax: 1, resolution: 1 },
};

function actLengths(readingAge: number): Record<Act, number> {
  return ACT_LENGTH_BY_READING_AGE[readingAge] ?? ACT_LENGTH_BY_READING_AGE[5];
}

/**
 * Given the current act and how many scenes have already happened in it,
 * decides whether the *next* scene stays in this act or advances to the
 * next one. Resolution never advances further — once there, every
 * subsequent beat stays "resolution" until the DM (or the model) ends it.
 */
export function planNextAct(
  currentAct: Act,
  scenesInCurrentAct: number,
  readingAge: number,
): Act {
  const lengths = actLengths(readingAge);
  if (scenesInCurrentAct < lengths[currentAct]) {
    return currentAct;
  }
  const currentIndex = ACT_ORDER.indexOf(currentAct);
  return ACT_ORDER[Math.min(currentIndex + 1, ACT_ORDER.length - 1)];
}
