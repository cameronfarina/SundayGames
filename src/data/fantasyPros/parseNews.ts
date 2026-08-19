import type { FantasyProsNewsItem } from "./newsContracts.js";
import {
  isRecord,
  optionalInteger,
  optionalText,
  recordArray,
  textArray,
  textValue,
} from "./values.js";

// FantasyPros stamps news as "2026-08-18 20:14:37" with no zone marker, and the
// value is UTC. Left alone, Date.parse would read it as local time.
const newsTimestamp = (value: unknown): string | undefined => {
  const text = textValue(value);
  if (text.length === 0) return undefined;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text)
    ? text
    : `${text.replace(" ", "T")}Z`;
  const parsed = Date.parse(zoned);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
};

const newsItemFrom = (raw: Record<string, unknown>): FantasyProsNewsItem | undefined => {
  const itemId = optionalInteger(raw.id);
  const title = textValue(raw.title);
  const createdAt = newsTimestamp(raw.created);
  if (itemId === undefined || title.length === 0 || createdAt === undefined) return undefined;

  return {
    itemId,
    createdAt,
    title,
    description: textValue(raw.desc),
    playerId: optionalInteger(raw.player_id),
    teamAbbreviation: optionalText(raw.team_id),
    author: optionalText(raw.author),
    impact: optionalText(raw.impact),
    categories: textArray(raw.categories),
    link: optionalText(raw.link),
  };
};

export const rawNewsRecordCount = (payload: unknown): number =>
  (isRecord(payload) ? recordArray(payload.items) : []).length;

export const parseFantasyProsNews = (payload: unknown): readonly FantasyProsNewsItem[] =>
  (isRecord(payload) ? recordArray(payload.items) : []).flatMap(raw => {
    const item = newsItemFrom(raw);
    return item === undefined ? [] : [item];
  });
