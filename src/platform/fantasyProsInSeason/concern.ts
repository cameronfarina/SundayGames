import type {
  FantasyProsConcernBasis,
  FantasyProsInSeasonPlayer,
  FantasyProsLineupConcern,
} from "./contracts.js";

/**
 * Weekly consensus is the sharper start-sit signal, but it only exists for the
 * flex positions, so a quarterback, kicker, or defense falls back to the
 * rest-of-season rank. Whichever was used is named on the wire.
 */
const concernBases: readonly FantasyProsConcernBasis[] = ["weekly_ecr", "rest_of_season_rank"];

const rankFor = (
  player: FantasyProsInSeasonPlayer,
  basis: FantasyProsConcernBasis,
): number | undefined => basis === "weekly_ecr"
  ? player.weekly?.rankEcr
  : player.restOfSeason?.rankEcr;

const messageFor = (
  basis: FantasyProsConcernBasis,
  bench: FantasyProsInSeasonPlayer,
  start: FantasyProsInSeasonPlayer,
  rankGap: number,
): string => {
  const spots = rankGap === 1 ? "1 spot" : `${String(rankGap)} spots`;
  const horizon = basis === "weekly_ecr" ? "this week's consensus" : "the rest-of-season consensus";
  return `FantasyPros ranks ${bench.playerName} ${spots} ahead of ${start.playerName} in ${horizon}.`;
};

/**
 * The projections picked the starter; this asks the expert consensus the same
 * question independently and reports only when it disagrees.
 */
export const lineupConcernFor = (
  start: FantasyProsInSeasonPlayer,
  bench: FantasyProsInSeasonPlayer | undefined,
): FantasyProsLineupConcern | undefined => {
  if (bench === undefined) return undefined;
  for (const basis of concernBases) {
    const startRank = rankFor(start, basis);
    const benchRank = rankFor(bench, basis);
    if (startRank === undefined || benchRank === undefined) continue;
    if (benchRank >= startRank) return undefined;
    const rankGap = startRank - benchRank;
    return { basis, rankGap, message: messageFor(basis, bench, start, rankGap) };
  }
  return undefined;
};
