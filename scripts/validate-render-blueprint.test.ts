import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const runValidator = (arguments_: string[] = []) =>
  spawnSync(
    "npm",
    ["run", "--silent", "platform:render:validate", "--", ...arguments_],
    { cwd: process.cwd(), encoding: "utf8" },
  );

describe("Render Blueprint validation command", () => {
  it("validates the repository blueprint with the pinned schema by default", () => {
    const result = runValidator();

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("render.yaml is valid");
  });

  it("rejects a malformed blueprint passed with an alternate schema and path", () => {
    const result = runValidator([
      "scripts/render-blueprint.schema.json",
      "tests/fixtures/render/malformed-render.yaml",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Invalid Render Blueprint");
  });
});
