import type { PlayerNewsItem } from "./feedContracts.js";

const sortableTime = (item: PlayerNewsItem): number => {
  const parsed = Date.parse(item.sourceDate ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

export const newestPlayerNewsFirst = (items: readonly PlayerNewsItem[]): PlayerNewsItem[] =>
  items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) =>
      sortableTime(right.item) - sortableTime(left.item)
      || left.originalIndex - right.originalIndex,
    )
    .map(({ item }) => item);
