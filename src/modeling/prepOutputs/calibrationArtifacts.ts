import {
  highPriceVolumeCalibrationCsv,
  positionCountCalibrationCsv,
  positionSpendCalibrationCsv,
  priceTierCalibrationCsv,
  scenarioCalibrationCsv,
} from "./calibrationTablesCsv.js";
import { csvArtifact } from "./csv.js";
import type { BuildPrepOutputArtifactsOptions, PrepOutputContent } from "./types.js";

export const calibrationArtifacts = (
  options: BuildPrepOutputArtifactsOptions,
): PrepOutputContent[] => [
  { filename: "price-tier-calibration.csv", content: csvArtifact(priceTierCalibrationCsv(options.audit)) },
  { filename: "high-price-volume-calibration.csv", content: csvArtifact(highPriceVolumeCalibrationCsv(options.audit)) },
  { filename: "position-count-calibration.csv", content: csvArtifact(positionCountCalibrationCsv(options.audit)) },
  { filename: "position-spend-calibration.csv", content: csvArtifact(positionSpendCalibrationCsv(options.audit)) },
  { filename: "scenario-calibration.csv", content: csvArtifact(scenarioCalibrationCsv(options.audit)) },
];
