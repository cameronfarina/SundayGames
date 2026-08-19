import type { FantasyProsStoredPlayer, FantasyProsStoredRanking } from "../fantasyPros.js";
import {
  emptyFantasyProsPlayerNewsIndex,
  fantasyProsNewsFor,
  type FantasyProsPlayerNewsIndex,
} from "../fantasyProsInSeason.js";
import { buildFantasyProsPlayerIndex } from "../fantasyProsMatching.js";
import type {
  BuildFantasyProsDraftAdvisoryInput,
  FantasyProsAdvisoryInjury,
  FantasyProsAdvisoryPlayer,
  FantasyProsDraftAdvisory,
  FantasyProsRankMomentum,
} from "./contracts.js";

// FantasyPros reports a positive delta when the consensus moved a player up the
// board, so a riser's rank number falls as the delta grows. That sign is
// inferred from observed payloads rather than documented, which is why it lives
// here alone: correcting it is a one-line change.
const momentumFor = (ecrDelta: number | undefined): FantasyProsRankMomentum => {
  if (ecrDelta === undefined || ecrDelta === 0) return "steady";
  return ecrDelta > 0 ? "rising" : "falling";
};

// A ranking row already carries every identifier the match needs, so the
// 8,525-row player catalog stays unread: a player absent from the rankings has
// no advisory data to show either way.
const playerRecordFor = (ranking: FantasyProsStoredRanking): FantasyProsStoredPlayer => ({
  playerId: ranking.playerId,
  playerName: ranking.playerName,
  position: ranking.position,
  positions: [ranking.position],
  teamAbbreviation: ranking.teamAbbreviation,
  fetchedAt: ranking.fetchedAt,
});

/**
 * Rest-of-season ranks are requested as week 0 and FantasyPros echoes that 0
 * back onto every row, so a stored ranking's week is a request parameter rather
 * than a fact about the ranks. Ranks that belong to no single week report no
 * week at all, which is what a reader of this advisory can actually use.
 */
const realWeek = (week: number | undefined): number | undefined =>
  week === undefined || week < 1 ? undefined : week;

// A report that is not about a player's health belongs on the news page, not on
// a bid clock, so only the injury-flagged ones reach the board.
const injuryFor = (
  news: FantasyProsPlayerNewsIndex,
  ranking: FantasyProsStoredRanking,
): FantasyProsAdvisoryInjury | undefined => {
  const report = fantasyProsNewsFor(news, ranking.playerId);
  if (report?.injury !== true) return undefined;
  return { headline: report.headline, publishedAt: report.publishedAt };
};

export const buildFantasyProsDraftAdvisory = (
  input: BuildFantasyProsDraftAdvisoryInput,
): FantasyProsDraftAdvisory => {
  const index = buildFantasyProsPlayerIndex({
    players: input.rankings.map(playerRecordFor),
    rankings: input.rankings,
  });
  const news = input.news ?? emptyFantasyProsPlayerNewsIndex();
  const players: FantasyProsAdvisoryPlayer[] = [];
  for (const candidate of input.candidates) {
    const ranking = index.find(candidate)?.ranking;
    if (ranking === undefined) continue;
    players.push({
      normalizedPlayerName: candidate.normalizedPlayerName,
      rankEcr: ranking.rankEcr,
      tier: ranking.tier,
      positionRank: ranking.positionRank,
      momentum: momentumFor(ranking.ecrDelta),
      ecrDelta: ranking.ecrDelta,
      injury: injuryFor(news, ranking),
    });
  }
  const [first] = input.rankings;
  return { basis: input.basis, week: realWeek(first?.week), players };
};
