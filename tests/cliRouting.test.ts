import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli/runCli.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CLI routing", () => {
  it("executes every production command through the typed router", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-routing-"));
    const evidencePath = join(directory, "evidence.csv");
    await writeFile(evidencePath, [
      "player,category,score,confidence,source,note",
      "Drake London,opportunity,1,1,targets,Strong volume",
    ].join("\n"));
    const outputDirectory = join(directory, "outputs");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const common = ["--no-default-evidence"];
    const commands: string[][] = [
      ["keepers"],
      ["profiles"],
      ["rankings"],
      ["prices", ...common],
      ["scenarios", ...common],
      ["scenarios-sensitivity", "--limit=1", ...common],
      ["scenarios-sensitivity", "--limit=1", "--format=csv", ...common],
      ["validate"],
      ["audit", "--player=Drake London", "--runs=1", ...common],
      ["sanity", "--limit=1", "--runs=1", ...common],
      ["evidence-queue", "--limit=1", "--runs=1", ...common],
      ["evidence-queue", "--limit=1", "--runs=1", "--format=csv", ...common],
      ["outliers-queue", "--limit=1", "--runs=1", ...common],
      ["outliers-queue", "--limit=1", "--runs=1", "--format=csv", ...common],
      ["evidence-template", "--limit=1", "--runs=1", ...common],
      ["evidence-adapt", `--input=${evidencePath}`, "--format=json"],
      ["evidence-adapt", `--input=${evidencePath}`],
      ["evidence-coverage", "--limit=1", "--runs=1", ...common],
      ["evidence-coverage", "--limit=1", "--runs=1", "--format=csv", ...common],
      ["mock", "--seed=cli-routing", ...common],
      ["mocks", "--runs=1", "--seed-prefix=cli-routing", ...common],
      ["strategy-lab", "--runs=1", "--force=Puka Nacua:75", ...common],
      [
        "strategy-lab",
        "--runs=1",
        "--format=markdown",
        "--force=Puka Nacua:75",
        ...common,
      ],
      ["teams", "--runs=1", "--limit=1", "--seed-prefix=cli-routing", ...common],
      [
        "teams",
        "--runs=1",
        "--limit=1",
        "--format=markdown",
        "--seed-prefix=cli-routing-markdown",
        ...common,
      ],
      [
        "teams",
        "--runs=1",
        "--limit=1",
        "--format=csv",
        "--seed-prefix=cli-routing-csv",
        ...common,
      ],
      [
        "draft-ready",
        "--runs=1",
        "--qa-runs=1",
        "--limit=1",
        "--min-matches=1",
        "--seed-prefix=cli-routing",
        ...common,
      ],
      ["smoke", "--runs=1", "--seed=cli-routing", ...common],
      ["calibration", "--runs=1", "--seed-prefix=cli-routing", ...common],
      ["backtest"],
      ["qa", "--runs=1", "--seed-prefix=cli-routing", ...common],
      [
        "qa",
        "--runs=1",
        "--seed-prefix=cli-routing-artifacts",
        `--out=${join(directory, "qa")}`,
        ...common,
      ],
      ["outputs", "--runs=1", `--out=${outputDirectory}`, ...common],
      ["unknown-command"],
    ];

    for (const arguments_ of commands) {
      const exitCode = await runCli(arguments_);
      expect(
        exitCode === undefined || exitCode === 0 || exitCode === 1,
        arguments_.join(" "),
      ).toBe(true);
    }
    expect(log.mock.calls.length).toBeGreaterThanOrEqual(commands.length);
  }, 120_000);
});
