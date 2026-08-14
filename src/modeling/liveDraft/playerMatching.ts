import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { lastSearchToken, searchKeyFor } from "./playerMetadata.js";

interface PlayerMatch {
  record: LiveDraftPlayerRecord;
  score: number;
}

const playerMatchScore = (record: LiveDraftPlayerRecord, playerText: string): number => {
  const query = searchKeyFor(playerText);
  const name = searchKeyFor(record.name);
  const lastToken = lastSearchToken(record.name);
  const tokens = name.split(" ");

  if (!query) return 0;
  if (name === query) return 100;
  if (lastToken === query) return 90;
  if (tokens.some(token => token === query)) return 80;
  if (name.includes(query)) return 60;
  return 0;
};

const ambiguousMatchesFor = (
  matches: readonly PlayerMatch[],
  best: PlayerMatch,
  query: string,
): readonly PlayerMatch[] => {
  const tiedMatches = matches.filter(match => match.score === best.score);
  const closeSingleTokenMatches = query.split(" ").length === 1
    ? matches.filter(match => match.score >= 80 && best.score - match.score <= 10)
    : [];
  return tiedMatches.length > 1 ? tiedMatches : closeSingleTokenMatches;
};

export const resolvePlayer = (
  playerText: string,
  records: readonly LiveDraftPlayerRecord[],
): LiveDraftPlayerRecord => {
  const query = searchKeyFor(playerText);
  const matches = records
    .map(record => ({ record, score: playerMatchScore(record, playerText) }))
    .filter(match => match.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || right.record.expectedPrice - left.record.expectedPrice
      || right.record.weeks1To4 - left.record.weeks1To4
      || left.record.name.localeCompare(right.record.name));
  const best = matches[0];
  if (!best) throw new Error(`Unknown player "${playerText}".`);

  const ambiguousMatches = ambiguousMatchesFor(matches, best, query);
  if (ambiguousMatches.length > 1) {
    const names = ambiguousMatches.slice(0, 6).map(match => match.record.name).join(", ");
    throw new Error(`Ambiguous player "${playerText}". Matches: ${names}.`);
  }
  return best.record;
};
