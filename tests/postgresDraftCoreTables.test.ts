import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import { draftCoreTables } from "../src/platform/postgresSchema/tables/draftCoreTables.js";

const expectedTableNames = [
  "draft_rooms",
  "draft_room_participants",
  "draft_room_events",
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
      "580d2a894d8c7b09f5c3440e66844bb7f30a92a0320b52a90f87e8dca14cd14d",
    );
  });

  it("preserves generated migration SQL text and statement ordering", () => {
    const statements = platformPostgresMigrationStatements.filter(isDraftCoreStatement);

    expect(statements).toHaveLength(8);
    expect(fingerprint(statements)).toBe(
      "5d69cf5464c961c8ce30039cd21b710f3765dd00f4c4e368e1ca71e4da370593",
    );
  });
});
