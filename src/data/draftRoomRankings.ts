import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { positions, type Position } from "../../config/league.js";
import { normalizePlayerName } from "./normalizePlayerName.js";

export type DraftRoomRankingScoring = "standard" | "half-ppr" | "ppr" | "unknown";
export type DraftRoomRankingProvider = "espn" | "sleeper" | "yahoo" | "cbs";

export interface DraftRoomRanking {
  sourceId: string;
  sourceLabel: string;
  scoring: DraftRoomRankingScoring;
  name: string;
  normalizedName: string;
  team: string;
  position: Position;
  providerRanks: Partial<Record<DraftRoomRankingProvider, number>>;
  byeWeek?: number;
  adpRank?: number;
  fantasyProsRank?: number;
  platformRank?: number;
  platformGapVsFantasyPros?: number;
  landmineScore?: number;
  round?: number;
  pick?: number;
}

export const defaultDraftRoomRankingPath =
  "data/raw/fantasy-draft-rankings-2026/average-half-ppr.tsv";

const sourceIdForPath = (path: string): string =>
  basename(path, ".tsv");

const titleize = (value: string): string =>
  value
    .split("-")
    .map(part => (part === "ppr" || part === "cbs") ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const sourceLabelFor = (sourceId: string): string =>
  titleize(sourceId);

const scoringFor = (sourceId: string): DraftRoomRankingScoring => {
  if (sourceId.includes("half")) return "half-ppr";
  if (sourceId.includes("ppr")) return "ppr";
  if (sourceId.includes("standard")) return "standard";
  return "unknown";
};

const trimmedCells = (line: string): string[] => {
  const cells = line.split("\t").map(cell => cell.trim());
  while (cells[0] === "") cells.shift();
  return cells;
};

const numericValue = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const positionValue = (value: string | undefined): Position | undefined => {
  const position = value?.trim();
  return positions.find(candidate => candidate === position);
};

const rowValue = (
  row: ReadonlyMap<string, string>,
  ...headers: readonly string[]
): string | undefined => {
  for (const header of headers) {
    const value = row.get(header);
    if (value !== undefined) return value;
  }
  return undefined;
};

const rowNumber = (
  row: ReadonlyMap<string, string>,
  ...headers: readonly string[]
): number | undefined =>
  numericValue(rowValue(row, ...headers));

const providerRanksFor = (
  row: ReadonlyMap<string, string>,
): Partial<Record<DraftRoomRankingProvider, number>> => {
  const providerRanks: Partial<Record<DraftRoomRankingProvider, number>> = {};
  const espn = rowNumber(row, "ESPN", "ESPN Half", "ESPN PPR", "ESPN Std");
  const sleeper = rowNumber(row, "Sleeper ADP", "Sleeper Half", "Sleeper PPR", "Sleeper Std");
  const yahoo = rowNumber(row, "YahooXRank", "Y Half", "Y PPR", "Y Std");
  const cbs = rowNumber(row, "CBS");

  if (espn !== undefined) providerRanks.espn = espn;
  if (sleeper !== undefined) providerRanks.sleeper = sleeper;
  if (yahoo !== undefined) providerRanks.yahoo = yahoo;
  if (cbs !== undefined) providerRanks.cbs = cbs;
  return providerRanks;
};

const platformRankFor = (
  row: ReadonlyMap<string, string>,
  providerRanks: Partial<Record<DraftRoomRankingProvider, number>>,
): number | undefined =>
  rowNumber(row, "Average") ??
  providerRanks.espn ??
  providerRanks.sleeper ??
  providerRanks.yahoo ??
  providerRanks.cbs;

const platformGapFor = (
  row: ReadonlyMap<string, string>,
): number | undefined =>
  rowNumber(row, "AVGvFP", "ESPNvFP", "SleepvFP", "Yahoo!vFP", "CBSvFP");

const rowMapFor = (
  headers: readonly string[],
  line: string,
): ReadonlyMap<string, string> => {
  const values = trimmedCells(line);
  return new Map(headers.map((header, index) => [header, values[index] ?? ""]));
};

export const parseDraftRoomRankings = (
  raw: string,
  sourceId = "draft-room-rankings",
): DraftRoomRanking[] => {
  const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);
  const headerLine = lines[0];
  if (!headerLine) return [];

  const headers = trimmedCells(headerLine);
  return lines.slice(1).flatMap(line => {
    const row = rowMapFor(headers, line);
    const name = rowValue(row, "Name")?.trim();
    const position = positionValue(rowValue(row, "Pos"));
    if (!name || !position) return [];

    const providerRanks = providerRanksFor(row);
    const byeWeek = rowNumber(row, "BYE");
    const adpRank = rowNumber(row, "ADP");
    const fantasyProsRank = rowNumber(row, "FantasyPros");
    const platformRank = platformRankFor(row, providerRanks);
    const platformGapVsFantasyPros = platformGapFor(row);
    const landmineScore = rowNumber(row, "Landmine");
    const round = rowNumber(row, "Round");
    const pick = rowNumber(row, "Pick");
    const ranking: DraftRoomRanking = {
      sourceId,
      sourceLabel: sourceLabelFor(sourceId),
      scoring: scoringFor(sourceId),
      name,
      normalizedName: normalizePlayerName(name),
      team: rowValue(row, "Team")?.trim() ?? "",
      position,
      providerRanks,
      ...(byeWeek === undefined ? {} : { byeWeek }),
      ...(adpRank === undefined ? {} : { adpRank }),
      ...(fantasyProsRank === undefined ? {} : { fantasyProsRank }),
      ...(platformRank === undefined ? {} : { platformRank }),
      ...(platformGapVsFantasyPros === undefined ? {} : { platformGapVsFantasyPros }),
      ...(landmineScore === undefined ? {} : { landmineScore }),
      ...(round === undefined ? {} : { round }),
      ...(pick === undefined ? {} : { pick }),
    };

    return [ranking];
  });
};

export const loadDraftRoomRankings = async (path: string): Promise<DraftRoomRanking[]> =>
  parseDraftRoomRankings(await readFile(path, "utf8"), sourceIdForPath(path));

export const draftRoomRankingsByName = (
  rankings: readonly DraftRoomRanking[],
): ReadonlyMap<string, DraftRoomRanking> =>
  new Map(rankings.map(ranking => [ranking.normalizedName, ranking]));
