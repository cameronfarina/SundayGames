import type { Position } from "../../../config/league.js";
import type {
  HistoricalAcquisitionType,
  HistoricalImportBatchStatus,
} from "../historicalImports.js";

export const historicalImportBatchStatus = (value: string): HistoricalImportBatchStatus => {
  switch (value) {
    case "previewed":
    case "blocked":
    case "committed":
    case "superseded":
      return value;
    default:
      throw new Error(`Invalid historical import batch status: ${value}`);
  }
};

export const historicalPosition = (value: string): Position => {
  switch (value) {
    case "QB":
    case "RB":
    case "WR":
    case "TE":
    case "K":
    case "DST":
      return value;
    default:
      throw new Error(`Invalid historical sale position: ${value}`);
  }
};

export const historicalAcquisitionType = (value: string): HistoricalAcquisitionType => {
  switch (value) {
    case "auction":
    case "keeper":
      return value;
    default:
      throw new Error(`Invalid historical acquisition type: ${value}`);
  }
};
