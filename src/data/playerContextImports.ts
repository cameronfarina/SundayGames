import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  playerContextCategories,
  type PlayerContextCategory,
  type PlayerContextNotes,
  type PlayerContextOverride,
  type PlayerContextSignals,
} from "../../config/playerContext.js";
import { normalizePlayerName } from "./normalizePlayerName.js";

export type CsvRow = Record<string, string>;

const categorySet = new Set<string>(playerContextCategories);

const isPlayerContextCategory = (value: string): value is PlayerContextCategory =>
  categorySet.has(value);

const parseCsvRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (character === "\"" && inQuotes && nextCharacter === "\"") {
      cell += "\"";
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  if (inQuotes) throw new Error("Unterminated quoted field in player context CSV.");

  row.push(cell);
  if (row.some(value => value.trim() !== "")) rows.push(row);

  return rows;
};

export const parseCsvRecords = (content: string): CsvRow[] => {
  const rows = parseCsvRows(content);
  const headers = rows[0]?.map(header => header.trim());
  if (!headers || headers.length === 0) return [];

  return rows.slice(1).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ""])),
  );
};

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

  return {
    player,
    signals,
    ...(Object.keys(notes).length > 0 ? { notes } : {}),
  };
};

export const parsePlayerContextCsv = (content: string): PlayerContextOverride[] =>
  parseCsvRecords(content).map(csvOverrideForRow);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const jsonOverrideValues = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.overrides)) return parsed.overrides;

  throw new Error("Player context JSON must be an override array or an object with an overrides array.");
};

const parseSignals = (
  value: unknown,
  player: string,
): PlayerContextSignals => {
  if (!isRecord(value)) throw new Error(`Player context override for ${player} must include signals.`);

  const signals: PlayerContextSignals = {};
  for (const [category, rawSignal] of Object.entries(value)) {
    if (!isPlayerContextCategory(category)) continue;
    if (typeof rawSignal !== "number" || !Number.isFinite(rawSignal)) {
      throw new Error(`Invalid ${category} signal for ${player}.`);
    }
    signals[category] = rawSignal;
  }

  return signals;
};

const parseNotes = (value: unknown, player: string): PlayerContextNotes | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`Player context notes for ${player} must be an object.`);

  const notes: PlayerContextNotes = {};
  for (const [category, note] of Object.entries(value)) {
    if (!isPlayerContextCategory(category)) continue;
    if (typeof note !== "string") throw new Error(`Invalid ${category} note for ${player}.`);
    if (note.trim()) notes[category] = note.trim();
  }

  return Object.keys(notes).length > 0 ? notes : undefined;
};

const parseOverride = (value: unknown): PlayerContextOverride => {
  if (!isRecord(value)) throw new Error("Player context overrides must be objects.");

  const player = value.player;
  if (typeof player !== "string" || !player.trim()) {
    throw new Error("Player context overrides must include a player string.");
  }

  const notes = parseNotes(value.notes, player);
  return {
    player: player.trim(),
    signals: parseSignals(value.signals, player),
    ...(notes ? { notes } : {}),
  };
};

export const parsePlayerContextJson = (content: string): PlayerContextOverride[] => {
  const parsed: unknown = JSON.parse(content);
  return jsonOverrideValues(parsed).map(parseOverride);
};

export const loadPlayerContextOverrides = async (path: string): Promise<PlayerContextOverride[]> => {
  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();

  if (extension === ".csv") return parsePlayerContextCsv(content);
  if (extension === ".json") return parsePlayerContextJson(content);

  throw new Error(`Unsupported player context file extension "${extension}". Use .csv or .json.`);
};

export const mergePlayerContextOverrides = (
  baseOverrides: readonly PlayerContextOverride[],
  importedOverrides: readonly PlayerContextOverride[],
): PlayerContextOverride[] => {
  const byName = new Map<string, PlayerContextOverride>();

  for (const override of [...baseOverrides, ...importedOverrides]) {
    const key = normalizePlayerName(override.player);
    const existing = byName.get(key);
    const notes = {
      ...existing?.notes,
      ...override.notes,
    };
    const evidence = [
      ...(existing?.evidence ?? []),
      ...(override.evidence ?? []),
    ];
    const mergedOverride = {
      player: override.player,
      signals: {
        ...existing?.signals,
        ...override.signals,
      },
      ...(Object.keys(notes).length > 0 ? { notes } : {}),
      ...(evidence.length > 0 ? { evidence } : {}),
    };

    byName.set(key, mergedOverride);
  }

  return [...byName.values()];
};
