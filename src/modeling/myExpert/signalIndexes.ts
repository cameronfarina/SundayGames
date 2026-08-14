import {
  defaultNegativeNewsSeverity,
  defaultPositiveNewsSeverity,
  defaultWatchNewsSeverity,
} from "./constants.js";
import type { MyExpertMatchupSignal, MyExpertNewsSignal } from "./contracts.js";

export const matchupScoresFor = (
  currentWeek: number,
  matchups: readonly MyExpertMatchupSignal[],
): ReadonlyMap<string, number> => {
  const scores = new Map<string, number>();
  for (const matchup of matchups.filter(item => item.week === currentWeek)) {
    scores.set(matchup.playerId, (scores.get(matchup.playerId) ?? 0) + matchup.score);
  }
  return scores;
};

export const matchupSignalsByPlayerFor = (
  currentWeek: number,
  matchups: readonly MyExpertMatchupSignal[],
): ReadonlyMap<string, readonly MyExpertMatchupSignal[]> => {
  const signalsByPlayer = new Map<string, MyExpertMatchupSignal[]>();
  for (const matchup of matchups.filter(item => item.week === currentWeek)) {
    const signals = signalsByPlayer.get(matchup.playerId) ?? [];
    signals.push(matchup);
    signalsByPlayer.set(matchup.playerId, signals);
  }
  for (const signals of signalsByPlayer.values()) {
    signals.sort((left, right) =>
      right.score - left.score ||
      (left.label ?? "").localeCompare(right.label ?? "") ||
      (left.opponent ?? "").localeCompare(right.opponent ?? "")
    );
  }
  return signalsByPlayer;
};

export const newsByPlayerFor = (
  news: readonly MyExpertNewsSignal[],
): ReadonlyMap<string, readonly MyExpertNewsSignal[]> => {
  const newsByPlayer = new Map<string, MyExpertNewsSignal[]>();
  for (const item of news) {
    const playerNews = newsByPlayer.get(item.playerId) ?? [];
    playerNews.push(item);
    newsByPlayer.set(item.playerId, playerNews);
  }
  for (const playerNews of newsByPlayer.values()) {
    playerNews.sort((left, right) =>
      (right.severity ?? 0) - (left.severity ?? 0) || left.headline.localeCompare(right.headline)
    );
  }
  return newsByPlayer;
};

export const newsSeverityFor = (news: MyExpertNewsSignal): number => {
  if (news.severity !== undefined) return news.severity;
  if (news.impact === "positive") return defaultPositiveNewsSeverity;
  if (news.impact === "watch") return defaultWatchNewsSeverity;
  return defaultNegativeNewsSeverity;
};

const newsAdjustmentFor = (news: MyExpertNewsSignal): number =>
  news.impact === "positive" ? newsSeverityFor(news) : -newsSeverityFor(news);

export const newsAdjustmentTotal = (news: readonly MyExpertNewsSignal[]): number =>
  news.reduce((total, item) => total + newsAdjustmentFor(item), 0);
