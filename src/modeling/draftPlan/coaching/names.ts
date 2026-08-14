import type { DraftPlanPlayer } from "../contracts.js";

export const lockedNamesForBlueprint = (
  players: readonly DraftPlanPlayer[],
  candidateCount: number,
): string[] => {
  const firstPlayer = players[0];
  if (!firstPlayer || firstPlayer.market || players.length !== candidateCount) return [];
  const locked = players.every(player =>
    player.name === firstPlayer.name &&
    player.price === firstPlayer.price &&
    !player.market
  );
  return locked ? [firstPlayer.name] : [];
};

export const targetNamesForBlueprint = (
  players: readonly DraftPlanPlayer[],
  lockedNames: readonly string[],
): string[] => {
  const lockedNameSet = new Set(lockedNames);
  const summaries = new Map<
    string,
    { name: string; count: number; weeks1To4: number; price: number }
  >();

  for (const player of players) {
    if (lockedNameSet.has(player.name)) continue;
    const summary = summaries.get(player.name) ?? {
      name: player.name,
      count: 0,
      weeks1To4: 0,
      price: 0,
    };
    summary.count += 1;
    summary.weeks1To4 += player.weeks1To4;
    summary.price += player.price;
    summaries.set(player.name, summary);
  }

  return [...summaries.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        (right.weeks1To4 / right.count) - (left.weeks1To4 / left.count) ||
        (right.price / right.count) - (left.price / left.count) ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 5)
    .map(summary => summary.name);
};
