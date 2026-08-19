import {
  espnPpr300AuctionBaseline2026,
  espnPpr300AuctionBaselineValueFor,
  type EspnPpr300AuctionBaselineValue,
} from "../../data/espnPpr300AuctionBaseline2026.js";

// The published board runs out of money long before it runs out of players, and
// a sale is only worth comparing against a value someone actually put a dollar
// on. Storage agrees: the historical sale row rejects a public value of zero.
const publicValue = (auctionValue: number): number | undefined =>
  auctionValue > 0 ? auctionValue : undefined;

export const publicPriceForPlayerName = (
  playerName: string,
  position: string,
): number | undefined => {
  const entry = espnPpr300AuctionBaselineValueFor(playerName);
  if (entry === undefined || entry.position !== position) return undefined;
  return publicValue(entry.auctionValue);
};

const baselineByPositionRank = new Map<string, EspnPpr300AuctionBaselineValue>(
  espnPpr300AuctionBaseline2026.map(player =>
    [`${player.position}${String(player.positionRank)}`, player]),
);

/**
 * Turns "RB1" into what the published board pays its best running back. Only
 * the 2026 board exists, and it is joined against every imported season on
 * purpose: the multiplier divides league dollars by published dollars, so both
 * sides move together when the board is reweighted and only the shape of the
 * position ranking has to hold from one year to the next.
 */
export const publicPriceForSlot = (
  position: string,
  positionRank: number,
): number | undefined => {
  const entry = baselineByPositionRank.get(`${position}${String(positionRank)}`);
  return entry === undefined ? undefined : publicValue(entry.auctionValue);
};
