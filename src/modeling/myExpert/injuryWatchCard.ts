import type { MyExpertAdviceCard, MyExpertNewsSignal, MyExpertPlayer } from "./contracts.js";
import { slugFor } from "./formatting.js";
import { priorityForNews } from "./priorities.js";

export const injuryWatchCardFor = (
  roster: readonly MyExpertPlayer[],
  news: readonly MyExpertNewsSignal[],
): MyExpertAdviceCard | undefined => {
  const rosterById = new Map(roster.map(player => [player.id, player]));
  const injuryNews = news
    .filter(item => item.impact === "negative" || item.impact === "watch")
    .flatMap(item => {
      const player = rosterById.get(item.playerId);
      return player ? [{ item, player }] : [];
    })
    .sort((left, right) =>
      (right.item.severity ?? 0) - (left.item.severity ?? 0) ||
      left.player.name.localeCompare(right.player.name)
    )[0];
  if (!injuryNews) return undefined;

  return {
    id: `injury-watch-${slugFor(injuryNews.player.name)}`,
    type: "injury-watch",
    title: `Watch ${injuryNews.player.name} injury status`,
    priority: priorityForNews(injuryNews.item),
    playerIds: [injuryNews.player.id],
    action: { kind: "recommendation", readOnly: true, label: "Review injury plan" },
    summary: injuryNews.item.headline,
    reasons: [
      `${injuryNews.player.name} is on your roster, so the news should affect contingency planning before any move is submitted manually.`,
    ],
  };
};
