import { ownerOrder, positions, type Owner, type Position } from "../../config/league.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";

const profilePositions = ["QB", "RB", "WR", "TE"] as const satisfies readonly Position[];
const specialTeamsPositions = ["K", "DST"] as const satisfies readonly Position[];
const oneDecimal = 10;
const concentrationScale = 100;
const maximumRepresentativeSpecialTeamsPrice = 10;

export type HistoricalWeights = Record<number, number>;

export interface OwnerProfile {
  owner: Owner;
  openAuctionSpend: Record<(typeof profilePositions)[number], number>;
  rosterCounts: Record<Position, number>;
  normalSpecialTeamsSpend: number;
  topTwoConcentration: number;
  oneDollarPlayerCount: number;
  averageKeeperCost: number;
  profileLabel: string;
}

export interface LeagueOpenAuctionSpendTargets {
  byPosition: Record<Position, number>;
  total: number;
}

export const defaultHistoricalWeights: HistoricalWeights = {
  2023: 0.2,
  2024: 0.3,
  2025: 0.5,
};

const roundToOneDecimal = (value: number): number =>
  Math.round((value + Number.EPSILON) * oneDecimal) / oneDecimal;

const isSpecialTeamsPosition = (position: Position): position is "K" | "DST" =>
  specialTeamsPositions.some(specialTeamsPosition => specialTeamsPosition === position);

const weightedSum = (
  records: readonly HistoricalAuctionRecord[],
  weights: HistoricalWeights,
  valueForSeason: (seasonRecords: HistoricalAuctionRecord[]) => number,
): number =>
  Object.entries(weights).reduce((total, [season, weight]) => {
    const seasonRecords = records.filter(record => record.season === Number(season));
    return total + weight * valueForSeason(seasonRecords);
  }, 0);

const auctionRecords = (records: readonly HistoricalAuctionRecord[]): HistoricalAuctionRecord[] =>
  records.filter(record => record.acquisitionType === "auction");

const visibleRosterRecords = (records: readonly HistoricalAuctionRecord[]): HistoricalAuctionRecord[] =>
  records.filter(record => record.acquisitionType !== "post-draft waiver");

const spendForPosition = (
  records: readonly HistoricalAuctionRecord[],
  position: Position,
): number =>
  records
    .filter(record => record.position === position)
    .reduce((total, record) => total + record.price, 0);

const rosterCountForPosition = (
  records: readonly HistoricalAuctionRecord[],
  position: Position,
): number =>
  records.filter(record => record.position === position).length;

const normalSpecialTeamsSpend = (records: readonly HistoricalAuctionRecord[]): number =>
  auctionRecords(records)
    .filter(record => isSpecialTeamsPosition(record.position))
    .filter(record => record.price <= maximumRepresentativeSpecialTeamsPrice)
    .reduce((total, record) => total + record.price, 0);

const topTwoConcentration = (records: readonly HistoricalAuctionRecord[]): number => {
  const visibleRecords = visibleRosterRecords(records);
  const totalSpend = visibleRecords.reduce((total, record) => total + record.price, 0);
  if (totalSpend === 0) return 0;

  const topTwoSpend = visibleRecords
    .map(record => record.price)
    .sort((left, right) => right - left)
    .slice(0, 2)
    .reduce((total, price) => total + price, 0);

  return (topTwoSpend / totalSpend) * concentrationScale;
};

const oneDollarPlayerCount = (records: readonly HistoricalAuctionRecord[]): number =>
  records.filter(record => record.price === 1).length;

const keeperCost = (records: readonly HistoricalAuctionRecord[]): number =>
  records
    .filter(record => record.isKeeper)
    .reduce((total, record) => total + record.price, 0);

const describeProfile = (profile: Omit<OwnerProfile, "profileLabel">): string => {
  const { QB, RB, WR, TE } = profile.openAuctionSpend;

  if (profile.averageKeeperCost >= 40) return "expensive-keeper dependent";
  if (QB <= 4 && WR >= 100) return "extreme wait-on-QB, WR-heavy";
  if (QB >= 28 && TE >= 28) return "balanced premium QB/TE";
  if (WR >= 135 && profile.topTwoConcentration >= 60) return "extreme WR stars and scrubs";
  if (WR >= 120 && RB <= 45) return "extreme WR concentration";
  if (WR >= 120 && profile.topTwoConcentration >= 58) return "WR stars and scrubs";
  if (RB >= 115 && profile.topTwoConcentration >= 58) return "RB stars and scrubs";
  if (RB >= 105 && profile.topTwoConcentration >= 50) return "concentrated RB-heavy";
  if (RB >= 100) return "deep RB-heavy";
  if (RB >= 90 && QB >= 20) return "RB concentration plus paid QB";
  if (RB >= 80 && TE >= 24 && QB >= 18) return "RB plus premium TE/QB";
  if (WR >= 85 && TE >= 18) return "flexible WR-leaning hybrid";
  if (QB <= 9 && WR >= 85) return "low-QB, slight WR lean";
  if (WR >= 85) return "balanced with WR preference";

  return "balanced";
};

const emptyProfileSpend = (): OwnerProfile["openAuctionSpend"] => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
});

const emptyRosterCounts = (): OwnerProfile["rosterCounts"] => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const buildOwnerProfiles = (
  records: readonly HistoricalAuctionRecord[],
  weights: HistoricalWeights = defaultHistoricalWeights,
): OwnerProfile[] =>
  ownerOrder.map(owner => {
    const ownerRecords = records.filter(record => record.owner === owner);
    const openAuctionSpend = emptyProfileSpend();
    const rosterCounts = emptyRosterCounts();

    for (const position of profilePositions) {
      openAuctionSpend[position] = roundToOneDecimal(
        weightedSum(ownerRecords, weights, seasonRecords =>
          spendForPosition(auctionRecords(seasonRecords), position),
        ),
      );
    }
    for (const position of positions) {
      rosterCounts[position] = roundToOneDecimal(
        weightedSum(ownerRecords, weights, seasonRecords =>
          rosterCountForPosition(seasonRecords, position),
        ),
      );
    }

    const profileWithoutLabel = {
      owner,
      openAuctionSpend,
      rosterCounts,
      normalSpecialTeamsSpend: roundToOneDecimal(
        weightedSum(ownerRecords, weights, seasonRecords =>
          normalSpecialTeamsSpend(seasonRecords),
        ),
      ),
      topTwoConcentration: roundToOneDecimal(
        weightedSum(ownerRecords, weights, seasonRecords =>
          topTwoConcentration(seasonRecords),
        ),
      ),
      oneDollarPlayerCount: roundToOneDecimal(
        weightedSum(ownerRecords, weights, seasonRecords =>
          oneDollarPlayerCount(seasonRecords),
        ),
      ),
      averageKeeperCost: roundToOneDecimal(
        weightedSum(ownerRecords, weights, seasonRecords =>
          keeperCost(seasonRecords),
        ),
      ),
    };

    return {
      ...profileWithoutLabel,
      profileLabel: describeProfile(profileWithoutLabel),
    };
  });

export const buildLeagueOpenAuctionSpendTargets = (
  records: readonly HistoricalAuctionRecord[],
  weights: HistoricalWeights = defaultHistoricalWeights,
): LeagueOpenAuctionSpendTargets => {
  const byPosition: Record<Position, number> = {
    QB: 0,
    RB: 0,
    WR: 0,
    TE: 0,
    K: 0,
    DST: 0,
  };

  for (const position of profilePositions) {
    byPosition[position] = roundToOneDecimal(
      weightedSum(records, weights, seasonRecords =>
        spendForPosition(auctionRecords(seasonRecords), position),
      ),
    );
  }

  const combinedSpecialTeamsSpend = roundToOneDecimal(
    weightedSum(records, weights, seasonRecords =>
      normalSpecialTeamsSpend(seasonRecords),
    ),
  );
  const balancedSpecialTeamsSpend = roundToOneDecimal(combinedSpecialTeamsSpend / specialTeamsPositions.length);

  byPosition.K = balancedSpecialTeamsSpend;
  byPosition.DST = balancedSpecialTeamsSpend;

  return {
    byPosition,
    total: roundToOneDecimal(Object.values(byPosition).reduce((total, spend) => total + spend, 0)),
  };
};
