import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import { draftStateTables } from "../src/platform/postgresSchema/tables/draftStateTables.js";

const expectedTableNames = [
  "draft_room_sales",
  "draft_room_team_states",
  "draft_room_player_states",
  "draft_room_snapshots",
];

const fingerprint = (value: unknown): string => createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

const isDraftStateStatement = (statement: string): boolean => expectedTableNames.some(
  tableName => statement.startsWith(`CREATE TABLE ${tableName} (`)
    || statement.includes(` ON ${tableName} (`),
);

describe("Postgres draft-state table schema", () => {
  it("preserves the public table order and complete schema contract", () => {
    expect(draftStateTables.map(table => table.name)).toEqual(expectedTableNames);
    expect(fingerprint(draftStateTables)).toBe(
      "777bd04d5d057c1a5ffa2aa821cadc027e5a14d8987f8394787b12af4019aa11",
    );
  });

  it("preserves generated migration SQL text and statement ordering", () => {
    const statements = platformPostgresMigrationStatements.filter(isDraftStateStatement);

    expect(statements).toHaveLength(10);
    expect(fingerprint(statements)).toBe(
      "48fd862159cd62efbd87063ee5ae87ee800876a418284ca9c2f93a36a9ea467d",
    );
  });
});
