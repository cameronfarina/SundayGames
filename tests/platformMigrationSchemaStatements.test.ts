import { describe, expect, it } from "vitest";
import { migrationStatementStartingWith } from
  "../src/platform/platformMigrations/schemaStatements.js";

describe("platform migration schema statement lookup", () => {
  it("fails clearly when a derived migration loses its canonical schema statement", () => {
    expect(() => migrationStatementStartingWith("CREATE TABLE missing_platform_table"))
      .toThrow("Missing platform schema statement for CREATE TABLE missing_platform_table.");
  });
});
