import { editDistance, maximumFuzzyDistanceFor } from "./textDistance.js";

const genericIdentityTokens = new Set([
  "draft",
  "league",
  "manager",
  "new",
  "old",
  "owner",
  "team",
  "the",
]);

export const normalizeIdentityLabel = (value: string | undefined): string =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[\u0027\u2019]s\b/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

export const identityLabelsFuzzilyMatch = (source: string, candidate: string): boolean => {
  if (source.length < 3 || candidate.length < 3) return false;

  const sourceTokens = source.split(" ");
  const candidateTokens = candidate.split(" ");
  const shorterTokens = sourceTokens.length <= candidateTokens.length ? sourceTokens : candidateTokens;
  const longerTokens = sourceTokens.length <= candidateTokens.length ? candidateTokens : sourceTokens;
  const meaningfulShorterTokens = shorterTokens.filter(token => !genericIdentityTokens.has(token));
  if (
    meaningfulShorterTokens.length > 0
    && meaningfulShorterTokens.every(token => longerTokens.includes(token))
  ) return true;

  const longestLength = Math.max(source.length, candidate.length);
  const distance = editDistance(source, candidate);
  return distance <= maximumFuzzyDistanceFor(longestLength) && distance / longestLength <= 0.2;
};
