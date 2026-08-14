import type {
  HighPriceVolumeCalibration,
  OverallCalibration,
  PriceTierCalibration,
} from "../contracts/calibration.js";
import type { CalibrationGate } from "../contracts/gates.js";
import { calibrationGate } from "./gateFactory.js";
import { priceTierCountThresholds } from "./thresholds.js";

const priceTierGateLabel = (tier: PriceTierCalibration): string =>
  tier.key === "dollar" ? "$1 player count" : `${tier.label} player count`;

const highPriceVolumeGateLabel = (
  volume: HighPriceVolumeCalibration,
): string => `$${volume.threshold}+ player count`;

export const auctionSpendGate = (overall: OverallCalibration): CalibrationGate =>
  calibrationGate({
    key: "auction-spend",
    category: "auction_spend",
    label: "Scenario open auction spend",
    target: overall.scenarioAverageOpenAuctionDollars,
    actual: overall.mockAverageAuctionSpend,
    warnThreshold: 50,
    failThreshold: 100,
  });

export const highPriceMaximumGates = (
  volumes: readonly HighPriceVolumeCalibration[],
): CalibrationGate[] =>
  volumes.map(volume =>
    calibrationGate({
      key: `high-price-volume:${volume.threshold}-plus`,
      category: "high_price_volume",
      label: highPriceVolumeGateLabel(volume),
      target: volume.historicalMaxCount,
      actual: volume.mockMaxCount,
      warnThreshold: 1,
      failThreshold: 3,
      mode: "maximum",
    }),
  );

export const highPriceFloorGates = (
  volumes: readonly HighPriceVolumeCalibration[],
): CalibrationGate[] =>
  volumes.map(volume =>
    calibrationGate({
      key: `high-price-volume-floor:${volume.threshold}-plus`,
      category: "high_price_volume",
      label: `${highPriceVolumeGateLabel(volume)} floor`,
      target: volume.historicalAverageCount,
      actual: volume.mockAverageCount,
      warnThreshold: 2,
      failThreshold: 4,
      mode: "minimum",
    }),
  );

export const priceTierGates = (
  calibrations: readonly PriceTierCalibration[],
): CalibrationGate[] =>
  calibrations.map(tier => {
    const thresholds = priceTierCountThresholds[tier.key];

    return calibrationGate({
      key: `price-tier-count:${tier.key}`,
      category: "price_tier_count",
      label: priceTierGateLabel(tier),
      target: tier.historicalAverageCount,
      actual: tier.mockAverageCount,
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
    });
  });
