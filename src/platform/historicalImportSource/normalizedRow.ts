import type { NormalizedHistoricalImportRow } from "../historicalImports.js";
import {
  normalizeHistoricalPosition,
  parseAcquisitionType,
  parseIntegerCell,
  parseKeeper,
  parsePriceDollars,
} from "./cells.js";
import type {
  HistoricalImportSourceColumn,
  HistoricalImportSourceWarning,
  ParsedDelimitedRow,
} from "./contracts.js";
import { cellValue } from "./headers.js";
import { sourceWarning } from "./warnings.js";

const addInvalidValueWarnings = (
  rowNumber: number,
  values: {
    seasonYear: string;
    publicPrice: string;
    keeper: string;
    acquisitionType: string;
  },
  parsed: {
    seasonYear: number | undefined;
    publicPrice: number | undefined;
    keeper: boolean | undefined;
    acquisitionType: string | undefined;
  },
  warnings: HistoricalImportSourceWarning[],
): void => {
  if (values.seasonYear.length > 0 && parsed.seasonYear === undefined) {
    warnings.push(sourceWarning(
      "invalid_season_year",
      `Row ${rowNumber} has an invalid season year "${values.seasonYear}".`,
      rowNumber,
      "seasonYear",
    ));
  }
  if (values.publicPrice.length > 0 && parsed.publicPrice === undefined) {
    warnings.push(sourceWarning(
      "invalid_public_price",
      `Row ${rowNumber} has an invalid same-season public value "${values.publicPrice}".`,
      rowNumber,
      "publicPrice",
    ));
  }
  if (values.keeper.length > 0 && parsed.keeper === undefined) {
    warnings.push(sourceWarning(
      "invalid_keeper",
      `Row ${rowNumber} has an unrecognized keeper value "${values.keeper}".`,
      rowNumber,
      "keeper",
    ));
  }
  if (values.acquisitionType.length > 0 && parsed.acquisitionType === undefined) {
    warnings.push(sourceWarning(
      "invalid_acquisition_type",
      `Row ${rowNumber} has an unrecognized acquisition type "${values.acquisitionType}".`,
      rowNumber,
      "acquisitionType",
    ));
  }
};

export const normalizedRowFor = (
  row: ParsedDelimitedRow,
  headerMap: ReadonlyMap<HistoricalImportSourceColumn, number>,
  warnings: HistoricalImportSourceWarning[],
): NormalizedHistoricalImportRow => {
  const ownerDisplayName = cellValue(row, headerMap, "owner");
  const playerName = cellValue(row, headerMap, "player");
  const playerId = cellValue(row, headerMap, "playerId");
  const position = normalizeHistoricalPosition(cellValue(row, headerMap, "position"));
  const priceDollars = parsePriceDollars(cellValue(row, headerMap, "price"));
  const publicPrice = cellValue(row, headerMap, "publicPrice");
  const publicPriceDollars = parsePriceDollars(publicPrice);
  const seasonYearValue = cellValue(row, headerMap, "seasonYear");
  const seasonYear = parseIntegerCell(seasonYearValue);
  const keeperValue = cellValue(row, headerMap, "keeper");
  const keeper = parseKeeper(keeperValue);
  const acquisitionTypeValue = cellValue(row, headerMap, "acquisitionType");
  const acquisitionType = parseAcquisitionType(acquisitionTypeValue);

  addInvalidValueWarnings(row.rowNumber, {
    seasonYear: seasonYearValue,
    publicPrice,
    keeper: keeperValue,
    acquisitionType: acquisitionTypeValue,
  }, { seasonYear, publicPrice: publicPriceDollars, keeper, acquisitionType }, warnings);

  return {
    sourceRowNumber: row.rowNumber,
    ...(ownerDisplayName.length > 0 ? { ownerDisplayName } : {}),
    ...(playerName.length > 0 ? { playerName } : {}),
    ...(playerId.length > 0 ? { playerId } : {}),
    ...(position.length > 0 ? { position } : {}),
    ...(priceDollars === undefined ? {} : { priceDollars }),
    ...(publicPriceDollars === undefined ? {} : { publicPriceDollars }),
    ...(seasonYear === undefined ? {} : { seasonYear }),
    ...(keeper === undefined ? {} : { keeper }),
    ...(acquisitionType === undefined ? {} : { acquisitionType }),
  };
};
