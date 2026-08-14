import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const runCli = async (...arguments_: string[]) => execFileAsync(
  "npx",
  ["tsx", "src/cli.ts", ...arguments_],
  { cwd: process.cwd() },
);

describe("CLI behavior", () => {
  it("prints usage for an unknown command without failing", async () => {
    const result = await runCli("unknown-command");

    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Usage: npm run keepers");
  });

  it("reports invalid positive integer options and exits unsuccessfully", async () => {
    await expect(runCli("smoke", "--runs=0")).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("--runs must be a positive integer."),
    });
  });

  it("reports unknown keeper scenarios and exits unsuccessfully", async () => {
    await expect(runCli("smoke", "--scenario=imaginary")).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        'Unknown keeper scenario "imaginary". Use confirmedOnly, expected, or highRetention.',
      ),
    });
  });
});
