import type { HistoricalSaleRecord } from "../historicalImports.js";
import type {
  GenericAuctionMockAiTendency,
  GenericAuctionMockPlayer,
} from "../genericAuctionMockEngine.js";

// An owner's appetite for studs, relative to what a typical available stud
// costs on this board. Clamped so one wild season cannot produce a team that
// never bids or always doubles the market.
const minimumPremiumBidMultiplier = 0.4;
const maximumPremiumBidMultiplier = 1.3;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  const lower = sorted[middle - 1] ?? upper;
  return sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
};

const typicalStudPriceFor = (
  players: readonly GenericAuctionMockPlayer[],
  keptPlayerIds: ReadonlySet<string>,
  teamCount: number,
): number | undefined => {
  const availableValues = players
    .filter(player => !keptPlayerIds.has(player.id))
    .map(player => player.expectedPrice)
    .sort((left, right) => right - left)
    .slice(0, teamCount);
  return availableValues.length === 0 ? undefined : median(availableValues);
};

const medianYearlyTopBuyFor = (sales: readonly HistoricalSaleRecord[]): number | undefined => {
  const topByYear = new Map<number, number>();
  for (const sale of sales) {
    const current = topByYear.get(sale.seasonYear) ?? 0;
    if (sale.priceDollars > current) topByYear.set(sale.seasonYear, sale.priceDollars);
  }
  return topByYear.size === 0 ? undefined : median([...topByYear.values()]);
};

export const ownerDraftingTendenciesFor = (input: {
  leagueId: string;
  teams: readonly { id: string; ownerId: string }[];
  players: readonly GenericAuctionMockPlayer[];
  keptPlayerIds: ReadonlySet<string>;
  historicalSaleRecords: readonly HistoricalSaleRecord[];
}): ReadonlyMap<string, GenericAuctionMockAiTendency> => {
  const tendencies = new Map<string, GenericAuctionMockAiTendency>();
  const typicalStudPrice = typicalStudPriceFor(input.players, input.keptPlayerIds, input.teams.length);
  if (typicalStudPrice === undefined || typicalStudPrice <= 0) return tendencies;
  const auctionSales = input.historicalSaleRecords.filter(sale =>
    sale.leagueId === input.leagueId && !sale.keeper && sale.acquisitionType === "auction"
  );
  for (const team of input.teams) {
    const topBuy = medianYearlyTopBuyFor(auctionSales.filter(sale => sale.ownerId === team.ownerId));
    if (topBuy === undefined) continue;
    tendencies.set(team.id, {
      premiumBidMultiplier: Math.min(
        maximumPremiumBidMultiplier,
        Math.max(minimumPremiumBidMultiplier, topBuy / typicalStudPrice),
      ),
    });
  }
  return tendencies;
};
