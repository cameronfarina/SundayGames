export const cleanPlayerName = (value: string): string =>
  value
    .replace(/,?\s*\bwhere\s+i(?:'m|m| am)?\s*$/i, "")
    .replace(/\bwhere\s+i(?:'m| am)?\s*$/i, "")
    .replace(/\bwhere\s*$/i, "")
    .replace(/\bi(?:'m|m| am)?\s*$/i, "")
    .replace(/\bfor\s*$/i, "")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

export const normalizedScriptText = (raw: string): string =>
  raw.replace(/[’‘]/g, "'");

export const runsPerScenarioFrom = (raw: string): number | undefined => {
  const match = /\b(?:run|running)\s+(\d+)\s+mocks?\b/i.exec(raw) ??
    /^\s*(\d+)\s+mocks?\b/i.exec(raw);
  if (!match) return undefined;

  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : undefined;
};

export const scriptParts = (raw: string): string[] =>
  raw
    .split(/[\n;]+/)
    .map(part => part.trim())
    .filter(Boolean);

export const withoutRunPrefix = (raw: string): string =>
  raw.replace(/\b(?:run|running)\s+\d+\s+mocks?\s+(?:where\s+)?/i, "").trim();
