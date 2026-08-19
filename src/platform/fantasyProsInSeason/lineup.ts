import type { PostDraftProjection, PostDraftStarterSlot } from "../postDraftTeamAnalysis.js";
import { selectStarters } from "../postDraftTeamAnalysis.js";
import { lineupConcernFor } from "./concern.js";
import type {
  FantasyProsInSeasonPlayer,
  FantasyProsLineup,
  FantasyProsLineupBasis,
  FantasyProsLineupSlot,
} from "./contracts.js";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export interface FantasyProsLineupInput {
  teamId: string;
  ownerId: string;
  players: readonly FantasyProsInSeasonPlayer[];
  starterSlots: readonly PostDraftStarterSlot[];
}

const pointsFor = (
  player: FantasyProsInSeasonPlayer,
  basis: FantasyProsLineupBasis,
): number | undefined => basis === "weekly_projection"
  ? player.weeklyProjectedPoints
  : player.restOfSeasonProjectedPoints;

const projectionMap = (
  players: readonly FantasyProsInSeasonPlayer[],
  basis: FantasyProsLineupBasis,
): ReadonlyMap<string, PostDraftProjection> => new Map(players.flatMap(player => {
  const points = pointsFor(player, basis);
  return points === undefined ? [] : [[player.playerId, {
    playerId: player.playerId,
    playerName: player.playerName,
    position: player.position,
    seasonProjectedPoints: points,
  }]];
}));

const bestBench = (
  input: FantasyProsLineupInput,
  slot: PostDraftStarterSlot,
  basis: FantasyProsLineupBasis,
  startedPlayerIds: ReadonlySet<string>,
): FantasyProsInSeasonPlayer | undefined => input.players
  .filter(player => !startedPlayerIds.has(player.playerId)
    && slot.eligiblePositions.includes(player.position)
    && pointsFor(player, basis) !== undefined)
  .sort((left, right) =>
    (pointsFor(right, basis) ?? 0) - (pointsFor(left, basis) ?? 0)
    || left.playerId.localeCompare(right.playerId))[0];

/**
 * The two projection horizons are never blended, because weekly points and
 * rest-of-season points are not the same unit. Weekly wins when FantasyPros
 * has published it for anyone on the roster.
 */
const basisFor = (players: readonly FantasyProsInSeasonPlayer[]): FantasyProsLineupBasis =>
  players.some(player => player.weeklyProjectedPoints !== undefined)
    ? "weekly_projection"
    : "rest_of_season_projection";

export const buildFantasyProsLineup = (
  input: FantasyProsLineupInput,
): FantasyProsLineup | undefined => {
  const basis = basisFor(input.players);
  const projections = projectionMap(input.players, basis);
  if (projections.size === 0 || input.starterSlots.length === 0) return undefined;

  const selection = selectStarters(
    { teamId: input.teamId, ownerId: input.ownerId, players: input.players },
    projections,
    input.starterSlots,
  );
  const startedPlayerIds = new Set(selection.lineup.map(starter => starter.playerId));
  const playersById = new Map(input.players.map(player => [player.playerId, player]));

  const slots = selection.lineup.flatMap<FantasyProsLineupSlot>(starter => {
    const slot = input.starterSlots.find(candidate => candidate.slot === starter.slot);
    const start = playersById.get(starter.playerId);
    if (slot === undefined || start === undefined) return [];
    const bench = bestBench(input, slot, basis, startedPlayerIds);
    const startPoints = pointsFor(start, basis);
    const benchPoints = bench === undefined ? undefined : pointsFor(bench, basis);
    return [{
      slot: slot.slot,
      eligiblePositions: slot.eligiblePositions,
      start,
      bench,
      pointEdge: startPoints === undefined || benchPoints === undefined
        ? undefined
        : roundToTwo(startPoints - benchPoints),
      concern: lineupConcernFor(start, bench),
    }];
  });

  return slots.length === 0 ? undefined : { basis, slots };
};
