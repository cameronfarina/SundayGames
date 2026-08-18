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

// Reporters credit each other in the wire copy: a trailing "..., Name of Outlet
// reports." or a leading "Name of Outlet reports that ...". The feed already
// says where every item came from, so the credit is noise in a draft room.
const trailingCredit = /,\s+[^,]{3,80}?\s+reports?\.?\s*$/iu;
const trailingSourced = /,\s+(?:per|according to)\s+[^,]{3,80}?\.?\s*$/iu;
const leadingCredit =
  /^[A-Z][^,.]{2,60}?\s+of\s+[^,.]{2,60}?\s+(?:reports?|predicts|says|notes|writes|adds)\s+that\s+/u;

export const withoutSourceCredit = (value: string): string => {
  const withoutTrailing = value.replace(trailingCredit, ".").replace(trailingSourced, ".");
  const withoutLeading = withoutTrailing.replace(leadingCredit, "");
  const restored = withoutLeading === withoutTrailing
    ? withoutLeading
    : withoutLeading.charAt(0).toUpperCase() + withoutLeading.slice(1);
  return restored.trim();
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
