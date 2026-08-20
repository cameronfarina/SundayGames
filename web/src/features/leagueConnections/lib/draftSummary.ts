import type { SyncedLeague } from "../api/leagueConnectionsSchema";

type SyncedSettings = SyncedLeague["settings"];

const dollars = (value: number): string => `$${String(value)}`;

/**
 * Providers hand over draft settings piecemeal, so each part is named only when
 * it actually arrived rather than padded out with a guess.
 */
export const draftSummary = (settings: SyncedSettings): string | undefined => {
  if (settings.draftType === "auction") {
    return [
      "Auction",
      ...(settings.auctionBudget === undefined ? [] : [`${dollars(settings.auctionBudget)} budget`]),
      ...(settings.minimumBid === undefined ? [] : [`${dollars(settings.minimumBid)} minimum bid`]),
    ].join(" · ");
  }
  if (settings.draftType === "snake") {
    return settings.snakeRounds === undefined
      ? "Snake"
      : `Snake · ${String(settings.snakeRounds)} rounds`;
  }
  return undefined;
};

export const keeperSummary = (keeperCount: number | undefined): string | undefined => {
  if (keeperCount === undefined || keeperCount === 0) return undefined;
  return keeperCount === 1 ? "1 keeper per team" : `${String(keeperCount)} keepers per team`;
};
