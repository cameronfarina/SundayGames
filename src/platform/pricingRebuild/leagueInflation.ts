import type { HistoricalSaleRecord } from "../historicalImports.js";
import {
  flatPricedPositions,
  maximumManualInflationMultiplier,
  minimumCountedSaleDollars,
  minimumManualInflationMultiplier,
} from "./constants.js";
import type {
  CreateLeagueCalibratedPricingSnapshotsInput,
  LeagueInflationResult,
} from "./contracts.js";
import { isPositiveInteger } from "./helpers.js";

const countedSale = (
  record: HistoricalSaleRecord,
  leagueId: string,
  currentSeasonYear: number,
): boolean => record.leagueId === leagueId
  && record.acquisitionType === "auction"
  && !record.keeper
  && !flatPricedPositions.has(record.position)
  && (!Number.isFinite(currentSeasonYear) || record.seasonYear <= currentSeasonYear)
  && Number.isFinite(record.priceDollars)
  && record.priceDollars >= minimumCountedSaleDollars
  && record.publicPriceDollars !== undefined
  && record.publicPriceDollars > 0;

export const countedInflationSales = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly HistoricalSaleRecord[] => input.historicalSaleRecords.filter(record =>
  countedSale(record, input.leagueId, Number(input.seasonYear)));

const rounded = (value: number): number => Math.round(value * 100) / 100;

const unavailable = (
  leagueDollars: number,
  publicDollars: number,
): LeagueInflationResult => ({
  multiplier: 1,
  source: "unavailable",
  countedSaleCount: 0,
  leagueDollars,
  publicDollars,
});

export const leagueInflationFor = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): LeagueInflationResult => {
  const sales = countedInflationSales(input);
  const leagueDollars = sales.reduce((total, sale) => total + sale.priceDollars, 0);
  const publicDollars = sales.reduce(
    (total, sale) => total + (sale.publicPriceDollars ?? 0),
    0,
  );
  if (sales.length > 0 && publicDollars > 0) {
    return {
      multiplier: rounded(leagueDollars / publicDollars),
      source: "history",
      countedSaleCount: sales.length,
      leagueDollars,
      publicDollars,
    };
  }

  // A typed-in percentage is what a commissioner believes about a league that
  // has imported nothing yet. Real sales always outrank a belief, so this is
  // only reached once history has failed to produce a number.
  const manual = input.manualInflationMultiplier;
  if (
    manual !== undefined
    && Number.isFinite(manual)
    && manual >= minimumManualInflationMultiplier
    && manual <= maximumManualInflationMultiplier
  ) {
    return {
      multiplier: rounded(manual),
      source: "manual",
      countedSaleCount: 0,
      leagueDollars: 0,
      publicDollars: 0,
    };
  }

  const publicBoardDollars = input.baselinePrices.reduce(
    (total, price) => total + (flatPricedPositions.has(price.position) ? 0 : price.price),
    0,
  );
  // Scaling to the money in the room only means something when the board holds
  // enough players to fill the room.
  if (
    !isPositiveInteger(input.currentTeamCount)
    || !isPositiveInteger(input.currentAuctionBudget)
    || !isPositiveInteger(input.currentRosterSize)
    || input.baselinePrices.length < input.currentTeamCount * input.currentRosterSize
    || publicBoardDollars <= 0
  ) return unavailable(0, publicBoardDollars);

  const leagueMoney = input.currentTeamCount * input.currentAuctionBudget;
  return {
    multiplier: rounded(leagueMoney / publicBoardDollars),
    source: "budget",
    countedSaleCount: 0,
    leagueDollars: leagueMoney,
    publicDollars: publicBoardDollars,
  };
};
