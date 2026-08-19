import type { RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import { playerNewsKeyFor } from "./normalization.js";

// Two desks writing up the same practice report land minutes apart, but a
// morning note and its evening follow-up are different news. Six hours splits
// those cases without needing to understand either headline.
const duplicateWindowMs = 6 * 60 * 60 * 1000;
const titleOverlapThreshold = 0.5;
const shortWordLength = 2;

const itemTimeMs = (item: RawPlayerNewsItem): number =>
  Date.parse(item.publishedAt ?? item.fetchedAt);

// The player's own name is in every headline for that player, so counting it
// would make unrelated updates look alike.
const titleWords = (item: RawPlayerNewsItem, playerKey: string): ReadonlySet<string> => {
  const playerWords = new Set(playerKey.split(" "));
  return new Set(playerNewsKeyFor(item.title)
    .split(" ")
    .filter(word => word.length > shortWordLength && !playerWords.has(word)));
};

const wordOverlap = (left: ReadonlySet<string>, right: ReadonlySet<string>): number => {
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / union.size;
};

const reportsSameEvent = (
  left: RawPlayerNewsItem,
  right: RawPlayerNewsItem,
  playerKey: string,
): boolean => {
  const leftTime = itemTimeMs(left);
  const rightTime = itemTimeMs(right);
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
  if (Math.abs(leftTime - rightTime) > duplicateWindowMs) return false;
  return wordOverlap(titleWords(left, playerKey), titleWords(right, playerKey))
    >= titleOverlapThreshold;
};

/**
 * Collapses the same event reported by two providers. Only across providers: a
 * single desk publishing twice about one player is following its own story, and
 * dropping the second report would lose the update.
 */
export const withoutDuplicateReports = (
  items: readonly RawPlayerNewsItem[],
): RawPlayerNewsItem[] => {
  const kept: RawPlayerNewsItem[] = [];

  for (const item of items) {
    const playerKey = playerNewsKeyFor(item.playerName ?? "");
    if (playerKey === "") {
      // An item attributed to no player cannot be matched against another.
      kept.push(item);
      continue;
    }

    const duplicateIndex = kept.findIndex(candidate =>
      candidate.provider !== item.provider
      && playerNewsKeyFor(candidate.playerName ?? "") === playerKey
      && reportsSameEvent(candidate, item, playerKey));

    if (duplicateIndex === -1) {
      kept.push(item);
      continue;
    }
    // FantasyPros carries the categories and the analyst take, so it wins the
    // tie and keeps the position the earlier item already held.
    if (item.provider === "fantasypros") kept[duplicateIndex] = item;
  }

  return kept;
};
