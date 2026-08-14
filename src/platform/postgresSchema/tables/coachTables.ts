import { createdAtColumn, jsonbArrayDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const coachTables: readonly PostgresTableDefinition[] = [
  {
    name: "coach_conversations",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "title", type: "text" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    foreignKeys: [
      {
        name: "coach_conversations_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "coach_conversations_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "coach_conversations_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "coach_conversations_private_owner_idx", columns: ["user_id", "league_season_id", "updated_at"] },
      { name: "coach_conversations_league_user_idx", columns: ["league_id", "user_id"] },
    ],
  },
  {
    name: "coach_messages",
    columns: [
      { name: "id", type: "text" },
      { name: "conversation_id", type: "text" },
      { name: "role", type: "text" },
      { name: "content", type: "text" },
      { name: "context_refs_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "tool_calls_json", type: "jsonb", default: jsonbArrayDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "coach_messages_role_check", expression: "role IN ('user', 'assistant', 'system', 'tool')" },
    ],
    foreignKeys: [
      {
        name: "coach_messages_conversation_id_fkey",
        columns: ["conversation_id"],
        references: { table: "coach_conversations", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "coach_messages_conversation_created_at_idx", columns: ["conversation_id", "created_at"] },
    ],
  },
];
