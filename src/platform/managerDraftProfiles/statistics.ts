import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { GenericAuctionMockPlayer } from "../genericAuctionMockEngine.js";
import type { ManagerDraftProfileTargetPosition } from "./contracts.js";
import { managerProfileMinimumTargetLift } from "./policy.js";

export const median = (values: readonly number[]): number | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? upper;
  return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
};

export const typicalStudPriceFor = (
  players: readonly GenericAuctionMockPlayer[],
  keptPlayerIds: ReadonlySet<string>,
  teamCount: number,
): number | undefined => median(players
  .filter(player => !keptPlayerIds.has(player.id))
  .map(player => player.expectedPrice)
  .sort((left, right) => right - left)
  .slice(0, teamCount));

export const medianYearlyTopBuyFor = (
  sales: readonly HistoricalSaleRecord[],
): number | undefined => {
  const topByYear = new Map<number, number>();
  for (const sale of sales) {
    topByYear.set(sale.seasonYear, Math.max(
      sale.priceDollars,
      topByYear.get(sale.seasonYear) ?? 0,
    ));
  }
  return median([...topByYear.values()]);
};

const targetPositions: readonly ManagerDraftProfileTargetPosition[] = ["QB", "RB", "WR", "TE"];

export const targetPositionFor = (
  ownerSales: readonly HistoricalSaleRecord[],
  leagueSales: readonly HistoricalSaleRecord[],
): { position: ManagerDraftProfileTargetPosition; lift: number } | undefined => {
  const years = [...new Set(ownerSales.map(sale => sale.seasonYear))];
  const lifts = targetPositions.map(position => {
    const yearly = years.flatMap(year => {
      const ownerYear = ownerSales.filter(sale => sale.seasonYear === year);
      const leagueYear = leagueSales.filter(sale => sale.seasonYear === year);
      const ownerTotal = ownerYear.reduce((total, sale) => total + sale.priceDollars, 0);
      const leagueTotal = leagueYear.reduce((total, sale) => total + sale.priceDollars, 0);
      if (ownerTotal <= 0 || leagueTotal <= 0) return [];
      const ownerShare = ownerYear
        .filter(sale => sale.position === position)
        .reduce((total, sale) => total + sale.priceDollars, 0) / ownerTotal;
      const leagueShare = leagueYear
        .filter(sale => sale.position === position)
        .reduce((total, sale) => total + sale.priceDollars, 0) / leagueTotal;
      return leagueShare <= 0 ? [] : [ownerShare / leagueShare];
    });
    return { position, lift: median(yearly) ?? 0 };
  }).sort((left, right) => right.lift - left.lift);
  const strongest = lifts[0];
  return strongest !== undefined && strongest.lift >= managerProfileMinimumTargetLift
    ? strongest
    : undefined;
};

export const actualToPublicMultiplier = (
  sales: readonly HistoricalSaleRecord[],
): number | undefined => median(sales.flatMap(sale =>
  sale.publicPriceDollars === undefined || sale.publicPriceDollars <= 0
    ? []
    : [sale.priceDollars / sale.publicPriceDollars]
));
