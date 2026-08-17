import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { platformPostgresMigrationStatements } from "../src/platform/postgresSchema.js";
import { leagueTables } from "../src/platform/postgresSchema/tables/leagueTables.js";

const expectedTableNames = [
  "leagues",
  "league_memberships",
  "league_seasons",
  "fantasy_teams",
  "roster_rule_sets",
];

const fingerprint = (value: unknown): string => createHash("sha256")
  .update(JSON.stringify(value))
  .digest("hex");

const isLeagueStatement = (statement: string): boolean => expectedTableNames.some(
  tableName => statement.startsWith(`CREATE TABLE ${tableName} (`)
    || statement.includes(` ON ${tableName} (`),
);

describe("Postgres league table schema", () => {
  it("preserves the public table order and complete schema contract", () => {
    expect(leagueTables.map(table => table.name)).toEqual(expectedTableNames);
    expect(fingerprint(leagueTables)).toBe(
      "1b74be79087fcd5f42362d7803ccd47a0107b649e95115ddb6575a014a600717",
    );
  });

  it("preserves generated migration SQL text and statement ordering", () => {
    const statements = platformPostgresMigrationStatements.filter(isLeagueStatement);

    expect(statements).toHaveLength(12);
    expect(fingerprint(statements)).toBe(
      "70ca3edb41ec5d52a5767e537c310e2d9dd4ff5cb4d338792a1434d0c5fff41d",
    );
  });
});
