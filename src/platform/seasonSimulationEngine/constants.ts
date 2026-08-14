const defaultSeedPrefix = "season-simulation";
const maximumDecisionsPerRun = 10_000;
// AI pacing includes a $2 clearing cushion; the human needs one more dollar to win the next bid.
const humanClearingPriceCushionDollars = 3;

export const deterministicFraction = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_296;
};
export { defaultSeedPrefix, maximumDecisionsPerRun, humanClearingPriceCushionDollars };
