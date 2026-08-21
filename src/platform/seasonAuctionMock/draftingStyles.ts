import type { HistoricalSaleRecord } from "../historicalImports/saleContracts.js";
import type { GenericAuctionMockAiTendency, GenericAuctionMockPlayer } from "../genericAuctionMockEngine.js";
import {
  medianYearlyTopBuyFor,
  typicalStudPriceFor,
} from "../managerDraftProfiles/statistics.js";

const minimumPremiumBidMultiplier = 0.4;
const maximumPremiumBidMultiplier = 1.3;

export const ownerDraftingTendenciesFor = (input: {
  leagueId: string;
  teams: readonly { id: string; ownerId: string }[];
  players: readonly GenericAuctionMockPlayer[];
  keptPlayerIds: ReadonlySet<string>;
  historicalSaleRecords: readonly HistoricalSaleRecord[];
}): ReadonlyMap<string, GenericAuctionMockAiTendency> => {
  const tendencies = new Map<string, GenericAuctionMockAiTendency>();
  const typicalStudPrice = typicalStudPriceFor(
    input.players,
    input.keptPlayerIds,
    input.teams.length,
  );
  if (typicalStudPrice === undefined || typicalStudPrice <= 0) return tendencies;
  const sales = input.historicalSaleRecords.filter(sale =>
    sale.leagueId === input.leagueId && !sale.keeper && sale.acquisitionType === "auction"
  );
  for (const team of input.teams) {
    const topBuy = medianYearlyTopBuyFor(sales.filter(sale => sale.ownerId === team.ownerId));
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
