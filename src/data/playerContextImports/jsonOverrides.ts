import type {
  PlayerContextNotes,
  PlayerContextOverride,
  PlayerContextSignals,
} from "../../../config/playerContext.js";
import { isPlayerContextCategory } from "./categories.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const overrideValues = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.overrides)) return parsed.overrides;
  throw new Error("Player context JSON must be an override array or an object with an overrides array.");
};

const signalsFor = (value: unknown, player: string): PlayerContextSignals => {
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

const notesFor = (value: unknown, player: string): PlayerContextNotes | undefined => {
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

const overrideFor = (value: unknown): PlayerContextOverride => {
  if (!isRecord(value)) throw new Error("Player context overrides must be objects.");
  const player = value.player;
  if (typeof player !== "string" || !player.trim()) {
    throw new Error("Player context overrides must include a player string.");
  }
  const notes = notesFor(value.notes, player);
  return {
    player: player.trim(),
    signals: signalsFor(value.signals, player),
    ...(notes ? { notes } : {}),
  };
};

export const parsePlayerContextJson = (content: string): PlayerContextOverride[] => {
  const parsed: unknown = JSON.parse(content);
  return overrideValues(parsed).map(overrideFor);
};
