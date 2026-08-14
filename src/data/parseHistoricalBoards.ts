import fs from "node:fs/promises";
import path from "node:path";
import { ownerOrder, type Owner, type Position } from "../../config/league.js";
import { cleanPlayerName, normalizePlayerName } from "./normalizePlayerName.js";

export type AcquisitionType = "keeper" | "auction" | "post-draft waiver";

export interface HistoricalBoardFile {
  season: number;
  path: string;
}

export interface HistoricalAuctionRecord {
  season: number;
  owner: Owner;
  rosterRow: number;
  originalPlayerName: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  isKeeper: boolean;
  acquisitionType: AcquisitionType;
  source: string;
}

const historicalSeasons = [2023, 2024, 2025];

export const historicalBoardFiles: HistoricalBoardFile[] = historicalSeasons.map(season => ({
  season,
  path: `data/fixtures/historical/auction-${season}.synthetic.csv`,
}));

export const historicalBoardFilesForEnvironment = (
  env: NodeJS.ProcessEnv = process.env,
): HistoricalBoardFile[] => {
  const privateDirectory = env.MOCKD_HISTORICAL_BOARD_DIRECTORY?.trim();
  if (!privateDirectory) return historicalBoardFiles;

  return historicalSeasons.map(season => ({
    season,
    path: path.join(privateDirectory, `${season}-board.csv`),
  }));
};

const positionValues: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const missing2023WaiverPlaceholder: Omit<
  HistoricalAuctionRecord,
  "season" | "owner" | "source"
> = {
  rosterRow: 16,
  originalPlayerName: "Seattle Seahawks",
  normalizedPlayerName: "Seattle Seahawks",
  position: "DST",
  price: 1,
  isKeeper: false,
  acquisitionType: "post-draft waiver",
};

const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inQuotes) {
      if (character === "\"") {
        if (content[index + 1] === "\"") {
          field += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === "\"") {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (character !== "\r") field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
};

const cleanCell = (value: string | undefined): string =>
  (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const parsePrice = (value: string | undefined): number | undefined => {
  const cleaned = cleanCell(value).replace(/\$/g, "").replace(/,/g, "");
  if (!cleaned) return undefined;

  const price = Number(cleaned);
  if (!Number.isInteger(price)) throw new Error(`Invalid auction price: ${value ?? ""}`);

  return price;
};

const isPosition = (value: string): value is Position =>
  positionValues.some(position => position === value);

const normalizePosition = (value: string | undefined): Position | undefined => {
  const position = cleanCell(value).replace("DEF", "DST");
  if (!isPosition(position)) return undefined;

  return position;
};

const ownerFromHeader = (value: string, ownerPosition: number): Owner => {
  const owner = ownerOrder[ownerPosition];
  if (!owner) throw new Error(`Historical board has an unexpected owner column: ${value}`);

  const syntheticOwner = `Owner ${String(ownerPosition + 1).padStart(2, "0")}`;
  if (value !== owner && value !== syntheticOwner) {
    throw new Error(`Unknown historical board owner: ${value}`);
  }

  return owner;
};

const ownerIndex = (owner: Owner): number => ownerOrder.indexOf(owner);

const sortHistoricalRecords = (records: HistoricalAuctionRecord[]): HistoricalAuctionRecord[] =>
  [...records].sort(
    (left, right) =>
      left.season - right.season ||
      ownerIndex(left.owner) - ownerIndex(right.owner) ||
      left.rosterRow - right.rosterRow,
  );

export const parseHistoricalBoardCsv = (
  csv: string,
  board: HistoricalBoardFile,
): HistoricalAuctionRecord[] => {
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) throw new Error(`Historical board ${board.path} is empty.`);

  const ownerColumns = header
    .map((cell, index) => ({ owner: cleanCell(cell), index }))
    .filter(entry => entry.index > 0 && entry.owner)
    .map((entry, ownerPosition) => ({
      owner: ownerFromHeader(entry.owner, ownerPosition),
      index: entry.index,
    }));

  if (ownerColumns.length !== ownerOrder.length) {
    throw new Error(`Historical board ${board.path} has ${ownerColumns.length} owners; expected ${ownerOrder.length}.`);
  }

  const parsedOwners = ownerColumns.map(entry => entry.owner);
  if (parsedOwners.some((owner, index) => owner !== ownerOrder[index])) {
    throw new Error(`Historical board ${board.path} owner order does not match league configuration.`);
  }

  const records = rows.flatMap(row => {
    const rosterRow = Number(cleanCell(row[0]));
    if (!Number.isInteger(rosterRow)) return [];

    return ownerColumns.flatMap(({ owner, index }): HistoricalAuctionRecord[] => {
      const originalPlayerName = cleanPlayerName(row[index + 2] ?? "");
      if (!originalPlayerName) return [];

      const price = parsePrice(row[index]);
      const position = normalizePosition(row[index + 1]);
      if (price === undefined || !position) {
        throw new Error(`Missing price or position for ${owner} row ${rosterRow} in ${board.path}.`);
      }

      const isKeeper = rosterRow === 1;
      const acquisitionType: AcquisitionType = isKeeper ? "keeper" : "auction";

      return [{
        season: board.season,
        owner,
        rosterRow,
        originalPlayerName,
        normalizedPlayerName: normalizePlayerName(originalPlayerName),
        position,
        price,
        isKeeper,
        acquisitionType,
        source: path.basename(board.path),
      }];
    });
  });

  if (board.season === 2023) {
    const ownersMissingFinalSlot = ownerOrder.filter(owner =>
      !records.some(record => record.owner === owner && record.rosterRow === missing2023WaiverPlaceholder.rosterRow));
    if (ownersMissingFinalSlot.length > 1) {
      throw new Error(`Historical board ${board.path} is missing multiple final roster slots.`);
    }

    const missingOwner = ownersMissingFinalSlot[0];
    if (!missingOwner) return sortHistoricalRecords(records);

    const selectedNames = new Set(records.map(record => record.normalizedPlayerName));
    if (selectedNames.has(missing2023WaiverPlaceholder.normalizedPlayerName)) {
      throw new Error(`${missing2023WaiverPlaceholder.originalPlayerName} was already selected in 2023.`);
    }

    records.push({
      ...missing2023WaiverPlaceholder,
      owner: missingOwner,
      season: board.season,
      source: path.basename(board.path),
    });
  }

  return sortHistoricalRecords(records);
};

export const loadHistoricalAuctionRecords = async (
  boards: readonly HistoricalBoardFile[] = historicalBoardFilesForEnvironment(),
): Promise<HistoricalAuctionRecord[]> => {
  const records = await Promise.all(
    boards.map(async board => parseHistoricalBoardCsv(await fs.readFile(board.path, "utf8"), board)),
  );

  return sortHistoricalRecords(records.flat());
};
