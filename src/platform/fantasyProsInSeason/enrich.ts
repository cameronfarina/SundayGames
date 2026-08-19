import type { FantasyProsStoredRanking } from "../fantasyPros.js";
import type { FantasyProsInSeasonPlayer, FantasyProsRankView } from "./contracts.js";
import type { FantasyProsInSeasonDataset } from "./dataset.js";
import { fantasyProsNewsFor, type FantasyProsPlayerNewsIndex } from "./news.js";
import type { FantasyProsRosterCandidate } from "./roster.js";

/**
 * Weekly rankings carry no tier and no ECR movement; only the rest-of-season
 * set does. A missing field is left off rather than sent as a zero.
 */
const rankView = (
  ranking: FantasyProsStoredRanking | undefined,
): FantasyProsRankView | undefined => ranking === undefined ? undefined : {
  rankEcr: ranking.rankEcr,
  positionRank: ranking.positionRank,
  tier: ranking.tier,
  rankMin: ranking.rankMin,
  rankMax: ranking.rankMax,
  rankStandardDeviation: ranking.rankStandardDeviation,
  ecrDelta: ranking.ecrDelta,
};

export const enrichRosterCandidate = (
  candidate: FantasyProsRosterCandidate,
  dataset: FantasyProsInSeasonDataset,
  news: FantasyProsPlayerNewsIndex,
): FantasyProsInSeasonPlayer => {
  const match = dataset.index.find({
    name: candidate.name,
    position: candidate.position,
    teamAbbreviation: candidate.teamAbbreviation,
  });
  const base: FantasyProsInSeasonPlayer = {
    playerId: candidate.playerId,
    playerName: candidate.name,
    position: candidate.position,
    teamAbbreviation: candidate.teamAbbreviation,
    byeWeek: candidate.byeWeek,
  };
  if (match === undefined) return base;

  const weekly = dataset.weeklyRankings.get(match.playerId);
  const restOfSeason = dataset.restOfSeasonRankings.get(match.playerId);
  return {
    ...base,
    teamAbbreviation: candidate.teamAbbreviation ?? match.teamAbbreviation,
    byeWeek: candidate.byeWeek ?? weekly?.byeWeek ?? restOfSeason?.byeWeek,
    fantasyProsPlayerId: match.playerId,
    weekly: rankView(weekly),
    restOfSeason: rankView(restOfSeason),
    weeklyProjectedPoints: dataset.weeklyProjections.get(match.playerId)?.pointsPpr,
    restOfSeasonProjectedPoints: dataset.restOfSeasonProjections.get(match.playerId)?.pointsPpr,
    news: fantasyProsNewsFor(news, match.playerId),
  };
};
