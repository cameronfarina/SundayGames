import {
  playerContextCategories,
  type PlayerContextCategory,
  type PlayerContextNotes,
  type PlayerContextOverride,
  type PlayerContextSignals,
} from "../../../config/playerContext.js";
import type { CsvRow } from "./contracts.js";
import { parseCsvRecords } from "./csvRecords.js";

const signalValue = (
  row: CsvRow,
  player: string,
  category: PlayerContextCategory,
): number | undefined => {
  const rawValue = row[category];
  if (rawValue === undefined || rawValue === "") return undefined;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid ${category} signal for ${player}: "${rawValue}".`);
  }
  return value;
};

const csvOverrideForRow = (row: CsvRow): PlayerContextOverride => {
  const player = row.player?.trim();
  if (!player) throw new Error("Player context CSV rows must include a player value.");
  const signals: PlayerContextSignals = {};
  const notes: PlayerContextNotes = {};

  for (const category of playerContextCategories) {
    const value = signalValue(row, player, category);
    if (value !== undefined) signals[category] = value;
    const note = row[`${category}_note`]?.trim();
    if (note) notes[category] = note;
  }
  return { player, signals, ...(Object.keys(notes).length > 0 ? { notes } : {}) };
};

export const parsePlayerContextCsv = (content: string): PlayerContextOverride[] =>
  parseCsvRecords(content).map(csvOverrideForRow);
