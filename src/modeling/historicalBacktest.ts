import { ownerOrder, positions, type Owner, type Position } from "../../config/league.js";
import type { HistoricalAuctionRecord } from "../data/parseHistoricalBoards.js";

type PositionAmounts = Record<Position, number>;
type OwnerAmounts = Record<Owner, number>;

export type HistoricalBacktestMethod = "leave-one-season-out";
export type HistoricalBacktestGateStatus = "pass" | "warn" | "fail";
export type HistoricalBacktestGateCategory =
  | "open_auction_spend"
  | "auction_player_count"
  | "high_price_volume"
  | "price_tier_count"
  | "position_count"
  | "position_spend"
  | "owner_spend";

export interface HistoricalPriceTier {
  key: "elite" | "strong" | "starter" | "depth" | "dollar";
  label: string;
  minPrice: number;
  maxPrice?: number;
}

export interface HistoricalCountSummary {
  key: string;
  label: string;
  count: number;
}

export interface HistoricalSeasonShape {
  openAuctionSpend: number;
  auctionPlayerCount: number;
  dollarPlayerCount: number;
  highPriceCounts: HistoricalCountSummary[];
  priceTierCounts: HistoricalCountSummary[];
  positionCounts: PositionAmounts;
  positionSpend: PositionAmounts;
  ownerSpend: OwnerAmounts;
}

export interface HistoricalBacktestGate {
  key: string;
  category: HistoricalBacktestGateCategory;
  label: string;
  status: HistoricalBacktestGateStatus;
  target: number;
  actual: number;
  delta: number;
  warnThreshold: number;
  failThreshold: number;
}

export interface HistoricalBacktestGateSummary {
  status: HistoricalBacktestGateStatus;
  credible: boolean;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface HistoricalBacktestGates {
  summary: HistoricalBacktestGateSummary;
  items: HistoricalBacktestGate[];
}

export interface HistoricalBacktestDeltaSummary {
  season: number;
  key: string;
  category: HistoricalBacktestGateCategory;
  label: string;
  target: number;
  actual: number;
  delta: number;
  thresholdPressure: number;
  status: HistoricalBacktestGateStatus;
}

export interface HistoricalSeasonBacktest {
  season: number;
  sourceSeasons: number[];
  actual: HistoricalSeasonShape;
  baseline: HistoricalSeasonShape;
  gates: HistoricalBacktestGates;
}

export interface HistoricalBacktestSummary extends HistoricalBacktestGateSummary {
  seasonCount: number;
  largestDeltas: HistoricalBacktestDeltaSummary[];
}

export interface HistoricalBacktestReport {
  method: HistoricalBacktestMethod;
  historicalSeasons: number[];
  summary: HistoricalBacktestSummary;
  seasonBacktests: HistoricalSeasonBacktest[];
  notes: string[];
}

type GateMode = "absolute" | "maximum";

const priceTiers = [
  { key: "elite", label: "$60+", minPrice: 60 },
  { key: "strong", label: "$40-$59", minPrice: 40, maxPrice: 59 },
  { key: "starter", label: "$20-$39", minPrice: 20, maxPrice: 39 },
  { key: "depth", label: "$2-$19", minPrice: 2, maxPrice: 19 },
  { key: "dollar", label: "$1", minPrice: 1, maxPrice: 1 },
] as const satisfies readonly HistoricalPriceTier[];

const highPriceThresholds = [70, 75, 80] as const;

const priceTierCountThresholds: Record<HistoricalPriceTier["key"], { warn: number; fail: number }> = {
  elite: { warn: 4, fail: 8 },
  strong: { warn: 5, fail: 10 },
  starter: { warn: 8, fail: 16 },
  depth: { warn: 20, fail: 40 },
  dollar: { warn: 8, fail: 14 },
};

const positionSpendThresholds: Record<Position, { warn: number; fail: number }> = {
  QB: { warn: 30, fail: 60 },
  RB: { warn: 100, fail: 220 },
  WR: { warn: 100, fail: 220 },
  TE: { warn: 35, fail: 80 },
  K: { warn: 20, fail: 45 },
  DST: { warn: 20, fail: 45 },
};

const positionCountThresholds: Record<Position, { warn: number; fail: number }> = {
  QB: { warn: 3, fail: 6 },
  RB: { warn: 8, fail: 16 },
  WR: { warn: 8, fail: 16 },
  TE: { warn: 4, fail: 8 },
  K: { warn: 3, fail: 6 },
  DST: { warn: 3, fail: 6 },
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const emptyPositionAmounts = (): PositionAmounts => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

const emptyOwnerAmounts = (): OwnerAmounts =>
  ownerOrder.reduce<OwnerAmounts>((amounts, owner) => {
    amounts[owner] = 0;
    return amounts;
  }, {} as OwnerAmounts);

const historicalSeasons = (historicalRecords: readonly HistoricalAuctionRecord[]): number[] =>
  [...new Set(historicalRecords.map(record => record.season))].sort((left, right) => left - right);

const auctionRecords = (records: readonly HistoricalAuctionRecord[]): HistoricalAuctionRecord[] =>
  records.filter(record => record.acquisitionType === "auction");

const recordsForSeason = (
  records: readonly HistoricalAuctionRecord[],
  season: number,
): HistoricalAuctionRecord[] =>
  records.filter(record => record.season === season);

const isInTier = (
  price: number,
  tier: HistoricalPriceTier,
): boolean =>
  price >= tier.minPrice && (tier.maxPrice === undefined || price <= tier.maxPrice);

const sumPrices = (records: readonly HistoricalAuctionRecord[]): number =>
  records.reduce((total, record) => total + record.price, 0);

const seasonAverage = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  valueForSeason: (seasonRecords: HistoricalAuctionRecord[]) => number,
): number =>
  roundToTwo(average(seasons.map(season => valueForSeason(recordsForSeason(records, season)))));

const highPriceCounts = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): HistoricalCountSummary[] =>
  highPriceThresholds.map(threshold => ({
    key: `${threshold}-plus`,
    label: `$${threshold}+`,
    count: seasonAverage(records, seasons, seasonRecords =>
      auctionRecords(seasonRecords).filter(record => record.price >= threshold).length,
    ),
  }));

const priceTierCounts = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): HistoricalCountSummary[] =>
  priceTiers.map(tier => ({
    key: tier.key,
    label: tier.label,
    count: seasonAverage(records, seasons, seasonRecords =>
      auctionRecords(seasonRecords).filter(record => isInTier(record.price, tier)).length,
    ),
  }));

const positionCounts = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): PositionAmounts => {
  const counts = emptyPositionAmounts();

  for (const position of positions) {
    counts[position] = seasonAverage(records, seasons, seasonRecords =>
      seasonRecords.filter(record => record.position === position).length,
    );
  }

  return counts;
};

const positionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): PositionAmounts => {
  const spend = emptyPositionAmounts();

  for (const position of positions) {
    spend[position] = seasonAverage(records, seasons, seasonRecords =>
      sumPrices(auctionRecords(seasonRecords).filter(record => record.position === position)),
    );
  }

  return spend;
};

const ownerSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): OwnerAmounts => {
  const spend = emptyOwnerAmounts();

  for (const owner of ownerOrder) {
    spend[owner] = seasonAverage(records, seasons, seasonRecords =>
      sumPrices(auctionRecords(seasonRecords).filter(record => record.owner === owner)),
    );
  }

  return spend;
};

const seasonShape = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): HistoricalSeasonShape => ({
  openAuctionSpend: seasonAverage(records, seasons, seasonRecords => sumPrices(auctionRecords(seasonRecords))),
  auctionPlayerCount: seasonAverage(records, seasons, seasonRecords => auctionRecords(seasonRecords).length),
  dollarPlayerCount: seasonAverage(
    records,
    seasons,
    seasonRecords => auctionRecords(seasonRecords).filter(record => record.price === 1).length,
  ),
  highPriceCounts: highPriceCounts(records, seasons),
  priceTierCounts: priceTierCounts(records, seasons),
  positionCounts: positionCounts(records, seasons),
  positionSpend: positionSpend(records, seasons),
  ownerSpend: ownerSpend(records, seasons),
});

const gateStatus = (
  delta: number,
  warnThreshold: number,
  failThreshold: number,
  mode: GateMode = "absolute",
): HistoricalBacktestGateStatus => {
  const magnitude = mode === "maximum" ? Math.max(0, delta) : Math.abs(delta);
  if (magnitude >= failThreshold) return "fail";
  if (magnitude >= warnThreshold) return "warn";
  return "pass";
};

const backtestGate = ({
  key,
  category,
  label,
  target,
  actual,
  warnThreshold,
  failThreshold,
  mode = "absolute",
}: Omit<HistoricalBacktestGate, "delta" | "status"> & { mode?: GateMode }): HistoricalBacktestGate => {
  const delta = roundToTwo(actual - target);

  return {
    key,
    category,
    label,
    status: gateStatus(delta, warnThreshold, failThreshold, mode),
    target,
    actual,
    delta,
    warnThreshold,
    failThreshold,
  };
};

const summarizeGateStatuses = (
  items: readonly HistoricalBacktestGate[],
): HistoricalBacktestGateSummary => {
  const failCount = items.filter(gate => gate.status === "fail").length;
  const warnCount = items.filter(gate => gate.status === "warn").length;
  const passCount = items.filter(gate => gate.status === "pass").length;
  let status: HistoricalBacktestGateStatus = "pass";

  if (failCount > 0) {
    status = "fail";
  } else if (warnCount > 0) {
    status = "warn";
  }

  return {
    status,
    credible: failCount === 0,
    gateCount: items.length,
    passCount,
    warnCount,
    failCount,
  };
};

const countFor = (
  counts: readonly HistoricalCountSummary[],
  key: string,
): number => {
  const count = counts.find(candidate => candidate.key === key);
  if (!count) throw new Error(`Missing historical count "${key}".`);
  return count.count;
};

const gatesFor = (
  actual: HistoricalSeasonShape,
  baseline: HistoricalSeasonShape,
): HistoricalBacktestGates => {
  const items = [
    backtestGate({
      key: "open-auction-spend",
      category: "open_auction_spend",
      label: "Open auction spend",
      target: baseline.openAuctionSpend,
      actual: actual.openAuctionSpend,
      warnThreshold: 75,
      failThreshold: 125,
    }),
    backtestGate({
      key: "auction-player-count",
      category: "auction_player_count",
      label: "Auction player count",
      target: baseline.auctionPlayerCount,
      actual: actual.auctionPlayerCount,
      warnThreshold: 2,
      failThreshold: 4,
    }),
    ...highPriceThresholds.map(threshold =>
      backtestGate({
        key: `high-price-volume:${threshold}-plus`,
        category: "high_price_volume",
        label: `$${threshold}+ player count`,
        target: countFor(baseline.highPriceCounts, `${threshold}-plus`),
        actual: countFor(actual.highPriceCounts, `${threshold}-plus`),
        warnThreshold: 1,
        failThreshold: 3,
      }),
    ),
    ...priceTiers.map(tier => {
      const thresholds = priceTierCountThresholds[tier.key];

      return backtestGate({
        key: `price-tier-count:${tier.key}`,
        category: "price_tier_count",
        label: tier.key === "dollar" ? "$1 player count" : `${tier.label} player count`,
        target: countFor(baseline.priceTierCounts, tier.key),
        actual: countFor(actual.priceTierCounts, tier.key),
        warnThreshold: thresholds.warn,
        failThreshold: thresholds.fail,
      });
    }),
    ...positions.map(position => {
      const thresholds = positionCountThresholds[position];

      return backtestGate({
        key: `position-count:${position}`,
        category: "position_count",
        label: `${position} roster count`,
        target: baseline.positionCounts[position],
        actual: actual.positionCounts[position],
        warnThreshold: thresholds.warn,
        failThreshold: thresholds.fail,
      });
    }),
    ...positions.map(position => {
      const thresholds = positionSpendThresholds[position];

      return backtestGate({
        key: `position-spend:${position}`,
        category: "position_spend",
        label: `${position} spend`,
        target: baseline.positionSpend[position],
        actual: actual.positionSpend[position],
        warnThreshold: thresholds.warn,
        failThreshold: thresholds.fail,
      });
    }),
    ...ownerOrder.map(owner =>
      backtestGate({
        key: `owner-spend:${owner}`,
        category: "owner_spend",
        label: `${owner} auction spend`,
        target: baseline.ownerSpend[owner] ?? 0,
        actual: actual.ownerSpend[owner] ?? 0,
        warnThreshold: 60,
        failThreshold: 160,
      }),
    ),
  ];

  return {
    summary: summarizeGateStatuses(items),
    items,
  };
};

const byAbsoluteDelta = (
  left: HistoricalBacktestDeltaSummary,
  right: HistoricalBacktestDeltaSummary,
): number =>
  gateStatusWeight(right.status) - gateStatusWeight(left.status) ||
  right.thresholdPressure - left.thresholdPressure ||
  Math.abs(right.delta) - Math.abs(left.delta) ||
  left.season - right.season ||
  left.key.localeCompare(right.key);

const gateStatusWeight = (status: HistoricalBacktestGateStatus): number => {
  if (status === "fail") return 2;
  if (status === "warn") return 1;
  return 0;
};

const thresholdPressureFor = (gate: HistoricalBacktestGate): number => {
  if (gate.warnThreshold === 0) return 0;
  return roundToTwo(Math.abs(gate.delta) / gate.warnThreshold);
};

const aggregateSummary = (
  seasonBacktests: readonly HistoricalSeasonBacktest[],
): HistoricalBacktestSummary => {
  const gateSummaries = seasonBacktests.map(backtest => backtest.gates.summary);
  const passCount = gateSummaries.reduce((total, summary) => total + summary.passCount, 0);
  const warnCount = gateSummaries.reduce((total, summary) => total + summary.warnCount, 0);
  const failCount = gateSummaries.reduce((total, summary) => total + summary.failCount, 0);
  const gateCount = gateSummaries.reduce((total, summary) => total + summary.gateCount, 0);
  let status: HistoricalBacktestGateStatus = "pass";

  if (failCount > 0) {
    status = "fail";
  } else if (warnCount > 0) {
    status = "warn";
  }

  const largestDeltas = seasonBacktests
    .flatMap(backtest =>
      backtest.gates.items.map(gate => ({
        season: backtest.season,
        key: gate.key,
        category: gate.category,
        label: gate.label,
        target: gate.target,
        actual: gate.actual,
        delta: gate.delta,
        thresholdPressure: thresholdPressureFor(gate),
        status: gate.status,
      })),
    )
    .sort(byAbsoluteDelta)
    .slice(0, 10);

  return {
    status,
    credible: failCount === 0,
    gateCount,
    passCount,
    warnCount,
    failCount,
    seasonCount: seasonBacktests.length,
    largestDeltas,
  };
};

export const buildHistoricalBacktest = (
  historicalRecords: readonly HistoricalAuctionRecord[],
): HistoricalBacktestReport => {
  const seasons = historicalSeasons(historicalRecords);
  if (seasons.length < 2) {
    throw new Error("Historical backtest requires at least two seasons.");
  }

  const seasonBacktests = seasons.map(season => {
    const sourceSeasons = seasons.filter(candidate => candidate !== season);
    const actual = seasonShape(historicalRecords, [season]);
    const baseline = seasonShape(historicalRecords, sourceSeasons);

    return {
      season,
      sourceSeasons,
      actual,
      baseline,
      gates: gatesFor(actual, baseline),
    };
  });

  return {
    method: "leave-one-season-out",
    historicalSeasons: seasons,
    summary: aggregateSummary(seasonBacktests),
    seasonBacktests,
    notes: [
      "Backtest compares historical seasons against other historical seasons only; it does not claim projection accuracy without historical projection files.",
      "Auction spend, price tiers, high-price volume, position spend, and owner spend use open-auction records; roster position counts include the normalized full board.",
      "Warnings mark historically noisy areas to review before changing model weights; failures mark economics that should not be treated as stable without more data.",
    ],
  };
};
