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
      "76d7df50726c4c3cbe3e1fed21bc383cac7fad894d2a1f8344a3c32f37801860",
    );
  });

  it("preserves generated migration SQL text and statement ordering", () => {
    const statements = platformPostgresMigrationStatements.filter(isLeagueStatement);

    expect(statements).toHaveLength(11);
    expect(fingerprint(statements)).toBe(
      "93811a56be5b2e97ae9cd098aa9a10deafbd51b89aa2f69b8559b0e7e2b7c79e",
    );
  });
});
