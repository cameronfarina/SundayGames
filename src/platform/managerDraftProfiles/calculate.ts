import type { HistoricalSaleRecord } from "../historicalImports.js";
import { isSlotPriceSaleRecord } from "../historicalImports/slotPriceProvenance.js";
import type { GenericAuctionMockPlayer } from "../genericAuctionMockEngine.js";
import type {
  ManagerDraftProfileSnapshot,
} from "./contracts.js";
import {
  managerProfileConfidenceFor,
  managerProfileMaximumPremiumMultiplier,
  managerProfileMaximumTargetLift,
  managerProfileMinimumComparablePurchases,
  managerProfileMinimumPremiumMultiplier,
  managerProfileMinimumPurchases,
  managerProfileMinimumSeasons,
  managerProfileStarBiddingFor,
  managerProfileTargetLabelFor,
} from "./policy.js";
import {
  actualToPublicMultiplier,
  medianYearlyTopBuyFor,
  targetPositionFor,
  typicalStudPriceFor,
} from "./statistics.js";

const clampPremiumBidMultiplier = (value: number): number => Math.min(
  managerProfileMaximumPremiumMultiplier,
  Math.max(managerProfileMinimumPremiumMultiplier, value),
);

const profileFor = (input: {
  teamId: string;
  ownerSales: readonly HistoricalSaleRecord[];
  peerSales: readonly HistoricalSaleRecord[];
  typicalStudPrice: number | undefined;
}): ManagerDraftProfileSnapshot => {
  const seasonCount = new Set(input.ownerSales.map(sale => sale.seasonYear)).size;
  const comparablePurchaseCount = input.ownerSales.filter(sale =>
    sale.publicPriceDollars !== undefined && sale.publicPriceDollars > 0
  ).length;
  const sample = {
    seasonCount,
    auctionPurchaseCount: input.ownerSales.length,
    comparablePurchaseCount,
  };
  if (seasonCount < managerProfileMinimumSeasons
    || input.ownerSales.length < managerProfileMinimumPurchases) {
    return {
      teamId: input.teamId,
      status: "insufficient-history",
      sample,
      confidence: null,
      targetPosition: null,
      targetLabel: null,
      premiumVsLeagueBaselinePercent: null,
      starBidding: null,
    };
  }
  const ownerSeasonYears = new Set(input.ownerSales.map(sale => sale.seasonYear));
  const comparablePeerSales = input.peerSales.filter(sale => ownerSeasonYears.has(sale.seasonYear));
  const peerSeasonCount = new Set(comparablePeerSales.map(sale => sale.seasonYear)).size;
  const peerComparablePurchaseCount = comparablePeerSales.filter(sale =>
    sale.publicPriceDollars !== undefined && sale.publicPriceDollars > 0
  ).length;
  const hasPeerTargetEvidence = peerSeasonCount >= managerProfileMinimumSeasons
    && comparablePeerSales.length >= managerProfileMinimumPurchases;
  const target = hasPeerTargetEvidence
    ? targetPositionFor(input.ownerSales, comparablePeerSales)
    : undefined;
  const ownerTopBuy = medianYearlyTopBuyFor(input.ownerSales);
  const premiumBidMultiplier = input.typicalStudPrice === undefined
    || input.typicalStudPrice <= 0
    || ownerTopBuy === undefined
    ? 1
    : clampPremiumBidMultiplier(ownerTopBuy / input.typicalStudPrice);
  const ownerComparable = actualToPublicMultiplier(input.ownerSales);
  const leagueComparable = actualToPublicMultiplier(comparablePeerSales);
  const premiumVsLeagueBaselinePercent = comparablePurchaseCount
    < managerProfileMinimumComparablePurchases
    || peerSeasonCount < managerProfileMinimumSeasons
    || peerComparablePurchaseCount < managerProfileMinimumComparablePurchases
    || ownerComparable === undefined || leagueComparable === undefined || leagueComparable <= 0
    ? null
    : Math.round((ownerComparable / leagueComparable - 1) * 100);
  const targetMultiplier = target === undefined
    ? 1
    : Math.min(managerProfileMaximumTargetLift, target.lift);
  return {
    teamId: input.teamId,
    status: "ready",
    sample,
    confidence: managerProfileConfidenceFor(seasonCount),
    targetPosition: target?.position ?? null,
    targetLabel: managerProfileTargetLabelFor(hasPeerTargetEvidence, target?.position),
    premiumVsLeagueBaselinePercent,
    starBidding: managerProfileStarBiddingFor(premiumBidMultiplier),
    aiTendency: {
      premiumBidMultiplier,
      ...(target === undefined ? {} : {
        positionBidMultipliers: { [target.position]: targetMultiplier },
        nominationPositionWeights: { [target.position]: targetMultiplier },
      }),
    },
  };
};

export const managerDraftProfilesFor = (input: {
  leagueId: string;
  teams: readonly { id: string; ownerId: string }[];
  players: readonly GenericAuctionMockPlayer[];
  keptPlayerIds: ReadonlySet<string>;
  historicalSaleRecords: readonly HistoricalSaleRecord[];
}): readonly ManagerDraftProfileSnapshot[] => {
  const currentOwnerIds = new Set(input.teams.map(team => team.ownerId));
  const leagueSales = input.historicalSaleRecords.filter(sale =>
    sale.leagueId === input.leagueId
    && currentOwnerIds.has(sale.ownerId)
    && !sale.keeper
    && sale.acquisitionType === "auction"
    && !isSlotPriceSaleRecord(sale)
  );
  const typicalStudPrice = typicalStudPriceFor(
    input.players,
    input.keptPlayerIds,
    input.teams.length,
  );
  return input.teams.map(team => profileFor({
    teamId: team.id,
    ownerSales: leagueSales.filter(sale => sale.ownerId === team.ownerId),
    peerSales: leagueSales.filter(sale => sale.ownerId !== team.ownerId),
    typicalStudPrice,
  }));
};
