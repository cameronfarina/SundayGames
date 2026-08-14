import { normalizePlayerName } from "../../data/normalizePlayerName.js";

export const playerNewsKeyFor = (value: string): string =>
  normalizePlayerName(value).toLowerCase();

export const playerNewsSlugFor = (value: string): string =>
  playerNewsKeyFor(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "news";

export const ensureNewsSentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export const normalizedNewsDate = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return value.includes("T") ? new Date(parsed).toISOString() : value;
};

export const factFromEvidenceNote = (note: string | undefined): string => {
  if (!note) return "";
  const match = note.match(/Fact:\s*(.+?)(?:;\s*inference:|$)/i);
  return ensureNewsSentence(match?.[1] ?? note);
};

export const inferenceFromEvidenceNote = (note: string | undefined): string => {
  if (!note) return "";
  const match = note.match(/inference:\s*(.+)$/i);
  return ensureNewsSentence(match?.[1] ?? note);
};
