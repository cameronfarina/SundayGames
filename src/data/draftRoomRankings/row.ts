import { positions, type Position } from "../../../config/league.js";
import { normalizePlayerName } from "../normalizePlayerName.js";
import type {
  DraftRoomRanking,
  DraftRoomRankingProvider,
  DraftRoomRankingScoring,
} from "./contracts.js";
import { rowNumber, rowValue, tabularRowFor } from "./tabularRow.js";

interface DraftRoomRankingSource {
  sourceId: string;
  sourceLabel: string;
  scoring: DraftRoomRankingScoring;
}

const positionValue = (value: string | undefined): Position | undefined => {
  const position = value?.trim();
  return positions.find(candidate => candidate === position);
};

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

export const draftRoomRankingFor = (
  headers: readonly string[],
  line: string,
  source: DraftRoomRankingSource,
): DraftRoomRanking | undefined => {
  const row = tabularRowFor(headers, line);
  const name = rowValue(row, "Name")?.trim();
  const position = positionValue(rowValue(row, "Pos"));
  if (!name || !position) return undefined;

  const providerRanks = providerRanksFor(row);
  const byeWeek = rowNumber(row, "BYE");
  const adpRank = rowNumber(row, "ADP");
  const fantasyProsRank = rowNumber(row, "FantasyPros");
  const platformRank = platformRankFor(row, providerRanks);
  const platformGapVsFantasyPros = rowNumber(
    row,
    "AVGvFP",
    "ESPNvFP",
    "SleepvFP",
    "Yahoo!vFP",
    "CBSvFP",
  );
  const landmineScore = rowNumber(row, "Landmine");
  const round = rowNumber(row, "Round");
  const pick = rowNumber(row, "Pick");
  return {
    ...source,
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
};
