import type {
  OwnerSpendCalibration,
  PositionCountCalibration,
  PositionSpendCalibration,
} from "../contracts/calibration.js";
import type { CalibrationGate } from "../contracts/gates.js";
import { calibrationGate } from "./gateFactory.js";
import {
  positionCountThresholds,
  positionSpendThresholds,
} from "./thresholds.js";

export const positionCountGates = (
  calibrations: readonly PositionCountCalibration[],
): CalibrationGate[] =>
  calibrations.map(position => {
    const thresholds = positionCountThresholds[position.position];

    return calibrationGate({
      key: `position-count:${position.position}`,
      category: "position_count",
      label: `${position.position} roster count`,
      target: position.historicalAverageCount,
      actual: position.mockAverageCount,
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
    });
  });

export const positionSpendGates = (
  calibrations: readonly PositionSpendCalibration[],
): CalibrationGate[] =>
  calibrations.map(position => {
    const thresholds = positionSpendThresholds[position.position];

    return calibrationGate({
      key: `position-spend:${position.position}`,
      category: "position_spend",
      label: `${position.position} spend`,
      target: position.scenarioAverageSpendTarget,
      actual: position.mockAverageSpend,
      warnThreshold: thresholds.warn,
      failThreshold: thresholds.fail,
    });
  });

export const ownerSpendGates = (
  calibrations: readonly OwnerSpendCalibration[],
): CalibrationGate[] =>
  calibrations.map(owner =>
    calibrationGate({
      key: `owner-spend:${owner.owner}`,
      category: "owner_spend",
      label: `${owner.owner} scenario auction spend`,
      target: owner.scenarioAverageOpenAuctionBudget,
      actual: owner.mockAverageAuctionSpend,
      warnThreshold: 10,
      failThreshold: 20,
    }),
  );
