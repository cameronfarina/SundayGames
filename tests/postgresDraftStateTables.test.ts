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
      "e26196364a675179f3331878b1f263a60c2c37761cba2fef286b3a08e89599a6",
    );
  });

  it("preserves generated migration SQL text and statement ordering", () => {
    const statements = platformPostgresMigrationStatements.filter(isDraftStateStatement);

    expect(statements).toHaveLength(10);
    expect(fingerprint(statements)).toBe(
      "6fec3156a7928ddaf25f34ec253a6bddfcce8ef0aad8a06eefa8ef575aec961f",
    );
  });
});
