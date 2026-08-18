import type {
  FantasyProsPlayer,
  FantasyProsProjection,
  FantasyProsProjectionPosition,
  FantasyProsProjectionSet,
  FantasyProsRanking,
  FantasyProsRankingSet,
  FantasyProsRankingType,
  FantasyProsScoring,
} from "./contracts.js";
import {
  isRecord,
  optionalInteger,
  optionalNumber,
  optionalText,
  recordArray,
  textArray,
  textValue,
} from "./values.js";

const playersOf = (payload: unknown): readonly Record<string, unknown>[] =>
  isRecord(payload) ? recordArray(payload.players) : [];

const rankingFrom = (raw: Record<string, unknown>): FantasyProsRanking | undefined => {
  const playerId = optionalInteger(raw.player_id);
  const playerName = textValue(raw.player_name);
  const rankEcr = optionalInteger(raw.rank_ecr);
  if (playerId === undefined || playerName.length === 0 || rankEcr === undefined) return undefined;

  return {
    playerId,
    playerName,
    position: textValue(raw.player_position_id),
    teamAbbreviation: optionalText(raw.player_team_id),
    yahooId: optionalText(raw.player_yahoo_id),
    rankEcr,
    rankMin: optionalInteger(raw.rank_min),
    rankMax: optionalInteger(raw.rank_max),
    rankAverage: optionalNumber(raw.rank_ave),
    rankStandardDeviation: optionalNumber(raw.rank_std),
    tier: optionalInteger(raw.tier),
    positionRank: optionalText(raw.pos_rank),
    byeWeek: optionalInteger(raw.player_bye_week),
    ecrDelta: optionalNumber(raw.player_ecr_delta),
    ownedAverage: optionalNumber(raw.player_owned_avg),
    ownedEspn: optionalNumber(raw.player_owned_espn),
    ownedYahoo: optionalNumber(raw.player_owned_yahoo),
  };
};

export const parseFantasyProsRankings = (
  payload: unknown,
  request: { type: FantasyProsRankingType; scoring: FantasyProsScoring; week: number },
): FantasyProsRankingSet => ({
  type: request.type,
  scoring: request.scoring,
  week: (isRecord(payload) ? optionalInteger(payload.week) : undefined) ?? request.week,
  rankings: playersOf(payload).flatMap(raw => {
    const ranking = rankingFrom(raw);
    return ranking === undefined ? [] : [ranking];
  }),
});

const projectionFrom = (raw: Record<string, unknown>): FantasyProsProjection | undefined => {
  const playerId = optionalInteger(raw.fpid);
  const playerName = textValue(raw.name);
  if (playerId === undefined || playerName.length === 0) return undefined;
  const stats = isRecord(raw.stats) ? raw.stats : {};

  return {
    playerId,
    playerName,
    position: textValue(raw.position_id),
    teamAbbreviation: optionalText(raw.team_id),
    points: optionalNumber(stats.points),
    pointsPpr: optionalNumber(stats.points_ppr),
    passingYards: optionalNumber(stats.pass_yds),
    passingTouchdowns: optionalNumber(stats.pass_tds),
    interceptions: optionalNumber(stats.pass_ints),
    rushingYards: optionalNumber(stats.rush_yds),
    rushingTouchdowns: optionalNumber(stats.rush_tds),
    receptions: optionalNumber(stats.rec_rec),
    receivingYards: optionalNumber(stats.rec_yds),
    receivingTouchdowns: optionalNumber(stats.rec_tds),
  };
};

export const parseFantasyProsProjections = (
  payload: unknown,
  request: { position: FantasyProsProjectionPosition; week: number },
): FantasyProsProjectionSet => ({
  position: request.position,
  week: (isRecord(payload) ? optionalInteger(payload.week) : undefined) ?? request.week,
  projections: playersOf(payload).flatMap(raw => {
    const projection = projectionFrom(raw);
    return projection === undefined ? [] : [projection];
  }),
});

const playerFrom = (raw: Record<string, unknown>): FantasyProsPlayer | undefined => {
  const playerId = optionalInteger(raw.player_id);
  const playerName = textValue(raw.player_name);
  if (playerId === undefined || playerName.length === 0) return undefined;
  const position = textValue(raw.position_id);
  const positions = textArray(raw.positions);

  return {
    playerId,
    playerName,
    firstName: optionalText(raw.first_name),
    lastName: optionalText(raw.last_name),
    shortName: optionalText(raw.short_name),
    position,
    positions: positions.length === 0 && position.length > 0 ? [position] : positions,
    teamAbbreviation: optionalText(raw.team_id),
    sportsDataId: optionalText(raw.sportsdata_player_id),
  };
};

export const parseFantasyProsPlayers = (payload: unknown): readonly FantasyProsPlayer[] =>
  playersOf(payload).flatMap(raw => {
    const player = playerFrom(raw);
    return player === undefined ? [] : [player];
  });
