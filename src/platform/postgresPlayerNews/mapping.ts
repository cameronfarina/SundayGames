import type { PlayerNewsStoredItem } from "../playerNews.js";
import type { PlayerNewsRow } from "./contracts.js";
import { jsonStringArrayFromDb } from "./json.js";

const isoStringFrom = (value: Date | string): string =>
  typeof value === "string" ? value : value.toISOString();

export const itemFromRow = (row: PlayerNewsRow): PlayerNewsStoredItem => ({
  id: row.id,
  provider: row.provider,
  providerItemId: row.provider_item_id,
  ...(row.canonical_url === null ? {} : { canonicalUrl: row.canonical_url }),
  ...(row.player_name === null ? {} : { playerName: row.player_name }),
  title: row.title,
  summary: row.summary,
  ...(row.published_at === null ? {} : { publishedAt: isoStringFrom(row.published_at) }),
  fetchedAt: isoStringFrom(row.fetched_at),
  tags: jsonStringArrayFromDb(row.tags_json),
});
