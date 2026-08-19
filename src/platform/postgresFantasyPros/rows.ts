import type {
  SaveFantasyProsPlayersInput,
  SaveFantasyProsProjectionsInput,
  SaveFantasyProsRankingsInput,
} from "../fantasyPros.js";

/**
 * Postgres refuses an upsert whose batch names the same conflict key twice
 * ("ON CONFLICT DO UPDATE command cannot affect row a second time"), while an
 * in-memory Map just overwrites. Collapse duplicates first so both stores
 * agree and a repeated player cannot fail a whole dataset.
 */
const lastByPlayerId = <TValue extends { playerId: number }>(
  values: readonly TValue[],
): readonly TValue[] =>
  [...new Map(values.map(value => [value.playerId, value])).values()];

export const rankingRowValues = (
  input: SaveFantasyProsRankingsInput,
): readonly (readonly unknown[])[] => lastByPlayerId(input.rankings).map(ranking => [
  input.rankingType,
  input.scoring,
  input.week,
  ranking.playerId,
  ranking.playerName,
  ranking.position,
  ranking.teamAbbreviation ?? null,
  ranking.yahooId ?? null,
  ranking.rankEcr,
  ranking.rankMin ?? null,
  ranking.rankMax ?? null,
  ranking.rankAverage ?? null,
  ranking.rankStandardDeviation ?? null,
  ranking.tier ?? null,
  ranking.positionRank ?? null,
  ranking.byeWeek ?? null,
  ranking.ecrDelta ?? null,
  ranking.ownedAverage ?? null,
  ranking.ownedEspn ?? null,
  ranking.ownedYahoo ?? null,
  input.fetchedAt,
]);

export const projectionRowValues = (
  input: SaveFantasyProsProjectionsInput,
): readonly (readonly unknown[])[] => lastByPlayerId(input.projections).map(projection => [
  input.week,
  projection.playerId,
  projection.playerName,
  projection.position,
  projection.teamAbbreviation ?? null,
  projection.points ?? null,
  projection.pointsPpr ?? null,
  projection.passingYards ?? null,
  projection.passingTouchdowns ?? null,
  projection.interceptions ?? null,
  projection.rushingYards ?? null,
  projection.rushingTouchdowns ?? null,
  projection.receptions ?? null,
  projection.receivingYards ?? null,
  projection.receivingTouchdowns ?? null,
  input.fetchedAt,
]);

export const playerRowValues = (
  input: SaveFantasyProsPlayersInput,
): readonly (readonly unknown[])[] => lastByPlayerId(input.players).map(player => [
  player.playerId,
  player.playerName,
  player.firstName ?? null,
  player.lastName ?? null,
  player.shortName ?? null,
  player.position,
  JSON.stringify(player.positions),
  player.teamAbbreviation ?? null,
  player.sportsDataId ?? null,
  input.fetchedAt,
]);
