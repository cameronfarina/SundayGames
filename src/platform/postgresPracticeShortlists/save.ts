import { randomUUID } from "node:crypto";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import {
  practiceShortlistName,
  type PracticeShortlistItem,
  type SavePracticeShortlistItemInput,
} from "../practiceShortlists.js";
import type { PracticeShortlistRow } from "./contracts.js";
import { firstRow, itemFromRow } from "./mapping.js";
import {
  insertItemSql,
  insertListSql,
  selectActiveListSql,
  selectExistingItemSql,
  selectItemsSql,
  updateItemSql,
} from "./sql.js";

const listIdFor = async (
  client: PostgresQueryClient,
  input: SavePracticeShortlistItemInput,
  now: Date,
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    selectActiveListSql,
    [input.userId, input.seasonId, practiceShortlistName],
  );
  const existingId = firstRow(result)?.id;
  if (existingId !== undefined) return existingId;
  const listId = `targets_${randomUUID()}`;
  await client.query(insertListSql, [
    listId, input.leagueId, input.seasonId, input.userId, practiceShortlistName, now,
  ]);
  return listId;
};

const itemIdFor = async (
  client: PostgresQueryClient,
  listId: string,
  input: SavePracticeShortlistItemInput,
  now: Date,
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    selectExistingItemSql,
    [listId, input.playerName.trim()],
  );
  const existingId = firstRow(result)?.id;
  const values = [
    input.playerName.trim(), input.position.trim().toUpperCase(), input.maxBid ?? null,
  ];
  if (existingId !== undefined) {
    await client.query(updateItemSql, [existingId, ...values, now]);
    return existingId;
  }
  const priorityResult = await client.query<{ next_priority: number | string }>(
    "SELECT COALESCE(MAX(priority), 0) + 1 AS next_priority FROM target_list_items WHERE target_list_id = $1",
    [listId],
  );
  const priority = Number(firstRow(priorityResult)?.next_priority ?? 1);
  const itemId = `target_${randomUUID()}`;
  await client.query(insertItemSql, [itemId, listId, ...values, priority, now]);
  return itemId;
};

export const savePracticeShortlistItem = async (
  client: PostgresQueryClient,
  input: SavePracticeShortlistItemInput,
  now: Date,
): Promise<PracticeShortlistItem> => {
  const listId = await listIdFor(client, input, now);
  const itemId = await itemIdFor(client, listId, input, now);
  const result = await client.query<PracticeShortlistRow>(
    `${selectItemsSql} WHERE i.id = $1 AND l.user_id = $2`,
    [itemId, input.userId],
  );
  const saved = firstRow(result);
  if (saved === undefined) throw new Error("Saved Practice shortlist item was not found.");
  return itemFromRow(saved);
};
