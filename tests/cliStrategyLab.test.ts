import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI strategy lab", () => {
  it("prints strategy-lab JSON for forced Owner11 draft experiments", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "strategy:lab",
        "--",
        "--runs=1",
        "--seed-prefix=cli-strategy-lab-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      mode: string;
      options: {
        runsPerScenario: number;
        seedPrefix: string;
      };
      leaderboard: {
        key: string;
        averageCamRank: number;
      }[];
      scenarios: {
        key: string;
        label: string;
        camForcedStart: {
          budgetRemaining: number;
          maxBid: number;
        };
      }[];
    };

    expect(report.mode).toBe("strategy-lab");
    expect(report.options).toMatchObject({
      runsPerScenario: 1,
      seedPrefix: "cli-strategy-lab-test",
    });
    expect(report.leaderboard.map(row => row.key)).toEqual(expect.arrayContaining([
      "puka-75",
      "puka-80",
      "chase-70",
      "value-wr-cook",
    ]));
    expect(report.leaderboard.every(row => row.averageCamRank >= 1 && row.averageCamRank <= 14)).toBe(true);
    expect(report.scenarios.find(scenario => scenario.key === "puka-75")).toMatchObject({
      label: "Puka $75",
      camForcedStart: {
        budgetRemaining: 75,
        maxBid: 62,
      },
    });
  }, 30000);

  it("prints markdown strategy-lab rankings for fast review", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "strategy:lab",
        "--",
        "--runs=1",
        "--format=markdown",
        "--seed-prefix=cli-strategy-lab-markdown-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );

    expect(stdout).toContain("# Primary Team Strategy Lab");
    expect(stdout).toContain("## Leaderboard");
    expect(stdout).toContain("| Puka $75 |");
    expect(stdout).toContain("Budget after forced start");
  }, 30000);

  it("can run a custom forced Owner11 path instead of the default lab scenarios", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "strategy:lab",
        "--",
        "--runs=1",
        "--label=Puka plus Walker",
        "--strategy=three-rb",
        "--force=Puka Nacua:75,Kenneth Walker III:36",
        "--seed-prefix=cli-strategy-lab-custom-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      scenarios: {
        key: string;
        label: string;
        strategyKey: string;
        forcedSales: {
          owner: string;
          player: string;
          price: number;
        }[];
        camForcedStart: {
          budgetRemaining: number;
          maxBid: number;
        };
      }[];
    };

    expect(report.scenarios).toHaveLength(1);
    expect(report.scenarios[0]).toMatchObject({
      key: "custom",
      label: "Puka plus Walker",
      strategyKey: "three-rb",
      forcedSales: [
        { owner: "Owner11", player: "Puka Nacua", price: 75 },
        { owner: "Owner11", player: "Kenneth Walker III", price: 36 },
      ],
      camForcedStart: {
        budgetRemaining: 39,
        maxBid: 27,
      },
    });
  }, 30000);

  it("accepts repeated force flags for multi-player Owner11 strategy paths", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "strategy:lab",
        "--",
        "--runs=1",
        "--label=Puka plus Walker",
        "--strategy=three-rb",
        "--force=Puka Nacua:75",
        "--force=Kenneth Walker III:36",
        "--seed-prefix=cli-strategy-lab-repeated-force-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      scenarios: {
        forcedSales: {
          owner: string;
          player: string;
          price: number;
        }[];
        camForcedStart: {
          budgetRemaining: number;
          maxBid: number;
        };
      }[];
    };

    expect(report.scenarios[0]?.forcedSales).toEqual([
      { owner: "Owner11", player: "Puka Nacua", price: 75 },
      { owner: "Owner11", player: "Kenneth Walker III", price: 36 },
    ]);
    expect(report.scenarios[0]?.camForcedStart).toMatchObject({
      budgetRemaining: 39,
      maxBid: 27,
    });
  }, 30000);

  it("can run a custom capped-target Owner11 path without forcing the target", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "strategy:lab",
        "--",
        "--runs=1",
        "--label=Puka cap",
        "--strategy=balanced",
        "--target=Puka Nacua:1",
        "--seed-prefix=cli-strategy-lab-target-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      scenarios: {
        forcedSales: unknown[];
        targetMaxBids: {
          owner: string;
          player: string;
          maxBid: number;
        }[];
        targetOutcomes: {
          player: string;
          maxBid: number;
          draftedByCamCount: number;
          draftedByCamRate: number;
        }[];
      }[];
    };

    expect(report.scenarios[0]?.forcedSales).toEqual([]);
    expect(report.scenarios[0]?.targetMaxBids).toEqual([
      { owner: "Owner11", player: "Puka Nacua", maxBid: 1 },
    ]);
    expect(report.scenarios[0]?.targetOutcomes).toEqual([
      expect.objectContaining({
        player: "Puka Nacua",
        maxBid: 1,
        draftedByCamCount: 0,
        draftedByCamRate: 0,
      }),
    ]);
  }, 30000);

  it("generates build-around price sweeps from the CLI", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "strategy:lab",
        "--",
        "--runs=1",
        "--strategy=three-rb",
        "--build-around=Omarion Hampton:46-50:2",
        "--target=Zay Flowers:31",
        "--seed-prefix=cli-strategy-lab-build-around-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 30 * 1024 * 1024,
      },
    );
    const report = JSON.parse(stdout) as {
      options: {
        runsPerScenario: number;
        seedPrefix: string;
      };
      scenarios: {
        key: string;
        label: string;
        forcedSales: {
          owner: string;
          player: string;
          price: number;
        }[];
        targetMaxBids: {
          owner: string;
          player: string;
          maxBid: number;
        }[];
        camForcedStart: {
          budgetRemaining: number;
          maxBid: number;
        };
      }[];
    };

    expect(report.options).toMatchObject({
      runsPerScenario: 1,
      seedPrefix: "cli-strategy-lab-build-around-test",
    });
    expect(report.scenarios.map(scenario => scenario.key)).toEqual([
      "build-around-omarion-hampton-46",
      "build-around-omarion-hampton-48",
      "build-around-omarion-hampton-50",
    ]);
    expect(report.scenarios.map(scenario => scenario.label)).toEqual([
      "Build around Omarion Hampton $46",
      "Build around Omarion Hampton $48",
      "Build around Omarion Hampton $50",
    ]);
    expect(report.scenarios.map(scenario => scenario.forcedSales)).toEqual([
      [{ owner: "Owner11", player: "Omarion Hampton", price: 46 }],
      [{ owner: "Owner11", player: "Omarion Hampton", price: 48 }],
      [{ owner: "Owner11", player: "Omarion Hampton", price: 50 }],
    ]);
    expect(report.scenarios.every(scenario =>
      scenario.targetMaxBids.some(target => target.player === "Zay Flowers" && target.maxBid === 31),
    )).toBe(true);
    expect(report.scenarios[0]?.camForcedStart.budgetRemaining).toBe(104);
    expect(report.scenarios[2]?.camForcedStart.budgetRemaining).toBe(100);
  }, 30000);
});
