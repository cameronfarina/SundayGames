import { normalizePlayerName } from "../../data/normalizePlayerName.js";

const suffixPattern = /\b(?:jr|sr|ii|iii|iv)\.?$/i;

export const normalizeSearchText = (value: string): string =>
  normalizePlayerName(value)
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const cleanMention = (value: string): string =>
  value
    .replace(/[’‘]/g, "'")
    .replace(/\betc\.?\b/gi, "")
    .replace(/^[\s,.:;()[\]-]+|[\s,.:;()[\]-]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

export const nameWithoutSuffix = (name: string): string =>
  name.replace(suffixPattern, "").trim();

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const aliasPattern = (alias: string): RegExp => {
  const pattern = alias
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");

  return new RegExp(`(^|[^a-z0-9'])(${pattern})(?=$|[^a-z0-9'])`, "i");
};
