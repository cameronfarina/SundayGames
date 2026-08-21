import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import { draftCoreTables } from "../src/platform/postgresSchema/tables/draftCoreTables.js";

const expectedTableNames = [
  "draft_rooms",
  "draft_room_participants",
  "draft_room_events",
  "live_draft_stream_leases",
];

const fingerprint = (value: unknown): string => createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

const isDraftCoreStatement = (statement: string): boolean => expectedTableNames.some(
  tableName => statement.startsWith(`CREATE TABLE ${tableName} (`)
    || statement.includes(` ON ${tableName} (`),
);

describe("Postgres draft-core table schema", () => {
  it("preserves the public table order and complete schema contract", () => {
    expect(draftCoreTables.map(table => table.name)).toEqual(expectedTableNames);
    expect(fingerprint(draftCoreTables)).toBe(
      "59ac3f369c702567dd8378e9aa25c0c169090400f63fa90010a7cab56bfb6cb5",
    );
  });

  it("preserves generated migration SQL text and statement ordering", () => {
    const statements = platformPostgresMigrationStatements.filter(isDraftCoreStatement);

    expect(statements).toHaveLength(11);
    expect(fingerprint(statements)).toBe(
      "481737f7285345327391c252a39d214f71619b84f1df063edef1a861441df157",
    );
  });
});
