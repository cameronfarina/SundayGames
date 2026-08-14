import type {
  MyExpertPlayer,
  MyExpertPlayerSignals,
  MyExpertTradeCandidate,
} from "./contracts.js";

type ScoredPlayer = MyExpertPlayer | MyExpertTradeCandidate;

export const signalTotal = (signals: MyExpertPlayerSignals | undefined): number =>
  (signals?.opportunityScore ?? 0) +
  (signals?.matchupScore ?? 0) +
  (signals?.usageScore ?? 0) +
  (signals?.trendScore ?? 0) -
  (signals?.injuryRisk ?? 0) -
  (signals?.weatherRisk ?? 0);

export const playerScore = (player: ScoredPlayer): number =>
  player.projectedPoints + signalTotal(player.signals);

export const playerScoreWithMatchups = (
  player: ScoredPlayer,
  matchupScores: ReadonlyMap<string, number>,
): number => playerScore(player) + (matchupScores.get(player.id) ?? 0);

export const dropScore = (
  player: MyExpertPlayer,
  matchupScores: ReadonlyMap<string, number>,
): number => {
  const positionalPenalty = player.position === "K" ? 4 : player.position === "DST" ? 2 : 0;
  return playerScoreWithMatchups(player, matchupScores) - positionalPenalty;
};

export const byScoreDesc = <PlayerType extends ScoredPlayer>(
  matchupScores: ReadonlyMap<string, number>,
) => (
  left: PlayerType,
  right: PlayerType,
): number =>
  playerScoreWithMatchups(right, matchupScores) - playerScoreWithMatchups(left, matchupScores) ||
  left.name.localeCompare(right.name);
