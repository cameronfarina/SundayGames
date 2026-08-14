import type { MockBatch } from "../../mockBatch.js";
import type {
  HighPriceVolumeCalibration,
  OverallCalibration,
  OwnerSpendCalibration,
  PositionCountCalibration,
  PositionSpendCalibration,
  PriceTierCalibration,
} from "../contracts/calibration.js";
import type { CalibrationGates } from "../contracts/gates.js";
import type { CalibrationSummary } from "../contracts/report.js";
import { budgetRemainingGates, rosterValidityGate } from "./budgetGates.js";
import { summarizeGateStatuses } from "./gateFactory.js";
import {
  auctionSpendGate,
  highPriceFloorGates,
  highPriceMaximumGates,
  priceTierGates,
} from "./marketGates.js";
import {
  ownerSpendGates,
  positionCountGates,
  positionSpendGates,
} from "./teamGates.js";

export interface CalibrationGateInputs {
  batch: MockBatch;
  summary: CalibrationSummary;
  priceTiers: readonly PriceTierCalibration[];
  highPriceVolumes: readonly HighPriceVolumeCalibration[];
  positionCounts: readonly PositionCountCalibration[];
  positionSpend: readonly PositionSpendCalibration[];
  ownerSpend: readonly OwnerSpendCalibration[];
  overall: OverallCalibration;
}

export const summarizeGates = ({
  batch,
  summary,
  priceTiers,
  highPriceVolumes,
  positionCounts,
  positionSpend,
  ownerSpend,
  overall,
}: CalibrationGateInputs): CalibrationGates => {
  const items = [
    rosterValidityGate(batch),
    auctionSpendGate(overall),
    ...highPriceMaximumGates(highPriceVolumes),
    ...highPriceFloorGates(highPriceVolumes),
    ...priceTierGates(priceTiers),
    ...positionCountGates(positionCounts),
    ...positionSpendGates(positionSpend),
    ...ownerSpendGates(ownerSpend),
    ...budgetRemainingGates(summary.budgetRemaining),
  ];

  return {
    summary: summarizeGateStatuses(items),
    items,
  };
};
