import type { DraftPlanPlayer, DraftPlanPriceBand } from "./contracts.js";

export const playerSummary = (player: DraftPlanPlayer): string =>
  `${player.position} ${player.name} $${player.price}`;

export const joinedPlayerSummaries = (players: readonly DraftPlanPlayer[]): string =>
  players.map(playerSummary).join("; ");

export const priceBandText = (
  band: Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice">,
): string => `$${band.minimumPrice}-$${band.maximumPrice}`;

export const priceWindowText = (minimumPrice: number, maximumPrice: number): string =>
  `$${minimumPrice}-$${maximumPrice}`;
