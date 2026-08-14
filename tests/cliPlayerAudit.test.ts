import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

describe("CLI player audit report", () => {
  it("explains one player's price bridge from anchor through mock sale behavior", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mockd-cli-audit-"));
    const evidencePath = join(directory, "evidence.csv");
    await writeFile(evidencePath, [
      "player,category,score,confidence,source,note,provider,source_date,source_quality",
      "Drake London,opportunity,1,1,targets,Target volume remains strong,FantasyPros,2026-07-15,primary",
      "Drake London,defensiveAttention,-1,0.8,coverage,More WR1 defensive attention",
      "Drake London,skillFit,-0.5,1,separation,Separation profile trims upside",
    ].join("\n"));

    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=Drake London",
        "--scenario=expected",
        "--runs=2",
        "--seed-prefix=audit-test",
        `--player-evidence=${evidencePath}`,
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      player: {
        name: string;
        position: string;
      };
      pricing: {
        rawPublicAnchorValue: number | null;
        publicAnchorValue: number;
        projectionRank: number;
        espnRank: number;
        rankGap: number;
        rankGapAdjustment: number;
        rawPrice: number;
        basePrice: number;
        contextAdjustmentPercent: number;
        contextSignals: Record<string, number>;
        contextEvidence: unknown[];
      };
      scenario: {
        key: string;
        available: boolean;
        scenarioFactor: number;
        scenarioPrice: number;
      };
      mockSale: {
        runCount: number;
        draftedCount: number;
        draftedRate: number;
        averageSalePrice: number;
        averageSaleVsScenarioPrice: number;
        minSalePrice: number;
        maxSalePrice: number;
      };
      waterfall: {
        summary: {
          anchorPrice: number;
          basePrice: number;
          scenarioPrice: number;
          averageMockSalePrice: number;
          saleVsScenarioPrice: number;
        };
        steps: {
          key: string;
          label: string;
          inputAmount: number | null;
          outputAmount: number | null;
          delta: number | null;
          factor?: number;
          note: string;
        }[];
      };
      explanation: string[];
    };

    expect(result.player).toMatchObject({
      name: "Drake London",
      position: "WR",
    });
    expect(result.pricing.publicAnchorValue).toBeGreaterThan(0);
    expect(result.pricing.rawPublicAnchorValue).toBe(result.pricing.publicAnchorValue);
    expect(result.pricing.projectionRank).toBeGreaterThan(0);
    expect(result.pricing.espnRank).toBeGreaterThan(0);
    expect(Number.isFinite(result.pricing.rankGap)).toBe(true);
    expect(result.pricing.rankGapAdjustment).toBeGreaterThan(0);
    expect(result.pricing.basePrice).toBeGreaterThan(0);
    expect(result.pricing.contextAdjustmentPercent).not.toBe(0);
    expect(result.pricing.contextSignals).toMatchObject({
      opportunity: 1,
      defensiveAttention: -0.8,
      skillFit: -0.5,
    });
    expect(result.pricing.contextEvidence).toHaveLength(3);
    expect(result.pricing.contextEvidence).toContainEqual(expect.objectContaining({
      category: "opportunity",
      provider: "FantasyPros",
      sourceDate: "2026-07-15",
      sourceQuality: "primary",
    }));
    expect(result.scenario).toMatchObject({
      key: "expected",
      available: true,
    });
    expect(result.scenario.scenarioFactor).toBeGreaterThan(1);
    expect(result.scenario.scenarioPrice).toBeGreaterThanOrEqual(result.pricing.basePrice);
    expect(result.mockSale.runCount).toBe(2);
    expect(result.mockSale.draftedCount).toBeGreaterThan(0);
    expect(result.mockSale.draftedRate).toBeGreaterThan(0);
    expect(result.mockSale.averageSalePrice).toBeGreaterThan(0);
    expect(result.mockSale.averageSaleVsScenarioPrice).toBe(
      result.mockSale.averageSalePrice - result.scenario.scenarioPrice,
    );
    expect(result.mockSale.minSalePrice).toBeLessThanOrEqual(result.mockSale.maxSalePrice);
    expect(result.waterfall.summary).toMatchObject({
      anchorPrice: result.pricing.publicAnchorValue,
      basePrice: result.pricing.basePrice,
      scenarioPrice: result.scenario.scenarioPrice,
      averageMockSalePrice: result.mockSale.averageSalePrice,
      saleVsScenarioPrice: result.mockSale.averageSaleVsScenarioPrice,
    });
    expect(result.waterfall.steps.map(step => step.key)).toEqual([
      "espn-anchor",
      "position-multiplier",
      "rank-gap-adjustment",
      "market-pressure",
      "projection-floor",
      "sustainability",
      "factual-context",
      "spend-reconciliation",
      "keeper-inflation",
      "mock-sale-average",
    ]);
    expect(result.waterfall.steps[0]).toMatchObject({
      key: "espn-anchor",
      inputAmount: 0,
      outputAmount: result.pricing.publicAnchorValue,
      delta: result.pricing.publicAnchorValue,
    });
    expect(result.waterfall.steps.find(step => step.key === "factual-context")).toMatchObject({
      outputAmount: result.pricing.rawPrice,
    });
    expect(result.waterfall.steps.find(step => step.key === "keeper-inflation")).toMatchObject({
      outputAmount: result.scenario.scenarioPrice,
    });
    expect(result.waterfall.steps.find(step => step.key === "mock-sale-average")).toMatchObject({
      outputAmount: result.mockSale.averageSalePrice,
      delta: result.mockSale.averageSaleVsScenarioPrice,
    });
    for (const step of result.waterfall.steps) {
      if (step.inputAmount === null || step.outputAmount === null || step.delta === null) continue;
      expect(step.delta, step.key).toBe(roundToTwo(step.outputAmount - step.inputAmount));
    }
    expect(result.explanation.join("\n")).toContain("ESPN");
    expect(result.explanation.join("\n")).toContain("keeper inflation");
    expect(result.explanation.join("\n")).toContain("mock sale");
  }, 15000);

  it("explains when the scenario removes a keeper from the auction pool", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=Justin Jefferson",
        "--scenario=expected",
        "--runs=1",
        "--seed-prefix=keeper-audit-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      scenario: {
        available: boolean;
        scenarioPrice: number;
        unavailableReason?: string;
      };
      mockSale: {
        draftedCount: number;
      };
      waterfall: {
        steps: {
          key: string;
          inputAmount: number | null;
          outputAmount: number | null;
          delta: number | null;
          factor?: number;
          note: string;
        }[];
      };
      explanation: string[];
    };

    expect(result.scenario).toMatchObject({
      available: false,
      scenarioPrice: 0,
      unavailableReason: "Owner04 assumed keeper at $42",
    });
    expect(result.mockSale.draftedCount).toBe(0);
    expect(result.waterfall.steps.map(step => step.key)).toContain("keeper-removal");
    expect(result.waterfall.steps.map(step => step.key)).not.toContain("keeper-inflation");
    const keeperRemovalStep = result.waterfall.steps.find(step => step.key === "keeper-removal");
    expect(keeperRemovalStep).toMatchObject({
      outputAmount: null,
      delta: null,
    });
    expect(keeperRemovalStep?.factor).toBeUndefined();
    for (const step of result.waterfall.steps) {
      if (step.inputAmount === null || step.outputAmount === null || step.delta === null) continue;
      expect(step.delta, step.key).toBe(roundToTwo(step.outputAmount - step.inputAmount));
    }
    expect(result.explanation.join("\n")).toContain("removed from the auction pool");
  });

  it("does not report available undrafted players as zero-dollar mock sales", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=Darius Slayton",
        "--scenario=confirmedOnly",
        "--runs=1",
        "--seed-prefix=undrafted-audit-test",
        "--no-default-evidence",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      scenario: {
        available: boolean;
        scenarioPrice: number;
      };
      mockSale: {
        draftedCount: number;
        averageSalePrice: number | null;
        averageSaleVsScenarioPrice: number | null;
        minSalePrice: number | null;
        maxSalePrice: number | null;
      };
      waterfall: {
        summary: {
          averageMockSalePrice: number | null;
          saleVsScenarioPrice: number | null;
        };
        steps: {
          key: string;
          outputAmount: number | null;
          delta: number | null;
          note: string;
        }[];
      };
    };

    expect(result.scenario.available).toBe(true);
    expect(result.mockSale.draftedCount).toBe(0);
    expect(result.mockSale.averageSalePrice).toBeNull();
    expect(result.mockSale.averageSaleVsScenarioPrice).toBeNull();
    expect(result.mockSale.minSalePrice).toBeNull();
    expect(result.mockSale.maxSalePrice).toBeNull();
    expect(result.waterfall.summary.averageMockSalePrice).toBeNull();
    expect(result.waterfall.summary.saleVsScenarioPrice).toBeNull();
    expect(result.waterfall.steps.find(step => step.key === "mock-sale-average")).toMatchObject({
      outputAmount: null,
      delta: null,
      note: "Not drafted in 1 mock run(s).",
    });
  }, 15000);

  it("distinguishes raw zero ESPN values from the effective model anchor", async () => {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "run",
        "--silent",
        "audit",
        "--",
        "--player=Brandon Aubrey",
        "--scenario=expected",
        "--runs=1",
        "--seed-prefix=anchor-floor-audit-test",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const result = JSON.parse(stdout) as {
      pricing: {
        rawPublicAnchorValue: number | null;
        publicAnchorValue: number;
      };
      waterfall: {
        steps: {
          key: string;
          label: string;
          note: string;
        }[];
      };
      explanation: string[];
    };
    const anchorStep = result.waterfall.steps.find(step => step.key === "espn-anchor");

    expect(result.pricing.rawPublicAnchorValue).toBe(0);
    expect(result.pricing.publicAnchorValue).toBe(1);
    expect(anchorStep).toMatchObject({
      label: "Effective ESPN auction anchor",
      note: "Raw ESPN auction value $0 is floored to the model minimum anchor of $1.",
    });
    expect(result.explanation.join("\n")).toContain(
      "Raw ESPN anchor $0 is floored to effective anchor $1",
    );
  }, 15000);
});
