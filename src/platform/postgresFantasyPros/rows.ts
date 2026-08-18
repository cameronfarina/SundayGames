import type {
  SaveFantasyProsPlayersInput,
  SaveFantasyProsProjectionsInput,
  SaveFantasyProsRankingsInput,
} from "../fantasyPros.js";

export const rankingRowValues = (
  input: SaveFantasyProsRankingsInput,
): readonly (readonly unknown[])[] => input.rankings.map(ranking => [
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
): readonly (readonly unknown[])[] => input.projections.map(projection => [
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
): readonly (readonly unknown[])[] => input.players.map(player => [
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
