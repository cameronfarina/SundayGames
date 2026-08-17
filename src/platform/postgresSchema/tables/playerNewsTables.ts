import { createdAtColumn, jsonbArrayDefault } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const playerNewsTables: readonly PostgresTableDefinition[] = [
  {
    name: "player_news_items",
    columns: [
      { name: "id", type: "text" },
      { name: "provider", type: "text" },
      { name: "provider_item_id", type: "text" },
      { name: "canonical_url", type: "text", nullable: true },
      { name: "player_name", type: "text", nullable: true },
      { name: "title", type: "text" },
      { name: "summary", type: "text" },
      { name: "published_at", type: "timestamptz", nullable: true },
      { name: "fetched_at", type: "timestamptz" },
      { name: "tags_json", type: "jsonb", default: jsonbArrayDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    indexes: [
      {
        name: "player_news_items_provider_item_key",
        columns: ["provider", "provider_item_id"],
        unique: true,
      },
      { name: "player_news_items_published_at_idx", columns: ["published_at"] },
    ],
  },
];
