import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { keepers, type KeeperDeclaration } from "../config/keepers.js";
import {
  customWeightsPlayerContextConfig,
  factualPlayerContextCategories,
  type FactualPlayerContextCategory,
} from "../config/playerContext.js";
import { parsePlayerContextEvidenceCsv } from "../src/data/playerContextEvidenceImports.js";
import { loadPlayerContextEvidenceOverrides } from "../src/data/playerContextEvidenceImports.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { mergePlayerContextOverrides } from "../src/data/playerContextImports.js";
import { defaultPricingConfig } from "../src/modeling/basePricing.js";
import { buildPlayerEvidenceCoverageAudit } from "../src/modeling/playerEvidenceCoverage.js";
import { buildPlayerEvidenceQueue } from "../src/modeling/playerEvidenceQueue.js";
import { buildTopPlayerSanityReport } from "../src/modeling/topPlayerSanity.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const evidencePath = "data/raw/player-evidence-2026-initial.csv";
const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const evidenceCoverageKeepers: readonly KeeperDeclaration[] = [
  ...keepers,
  {
    owner: "Owner01",
    player: "Jaxon Smith-Njigba",
    position: "WR",
    priorCost: 1,
    newCost: 2,
    status: "confirmed",
  },
  {
    owner: "Owner02",
    player: "Bucky Irving",
    position: "RB",
    priorCost: 1,
    newCost: 2,
    status: "confirmed",
  },
];

describe("initial 2026 player evidence data", () => {
  it("covers every current top evidence-queue player with sourced factual categories", async () => {
    const rows = parsePlayerContextEvidenceCsv(await readFile(evidencePath, "utf8"));
    const duplicateKeys = rows.map(row => `${row.player}|${row.category}`);
    expect(new Set(duplicateKeys).size).toBe(duplicateKeys.length);

    const pricingConfig = {
      ...defaultPricingConfig,
      playerContext: {
        ...customWeightsPlayerContextConfig,
        overrides: mergePlayerContextOverrides(
          customWeightsPlayerContextConfig.overrides,
          await loadPlayerContextEvidenceOverrides(evidencePath),
        ),
      },
    };
    const queue = buildPlayerEvidenceQueue(buildTopPlayerSanityReport({
      projections: await loadEspnWeeksOneToFour(projectionPath),
      historicalRecords: await loadHistoricalAuctionRecords(),
      keepers: evidenceCoverageKeepers,
      scenarioKey: "expected",
      limit: 38,
      runs: 2,
      seedPrefix: "initial-evidence-coverage",
      pricingConfig,
    }));
    const audit = buildPlayerEvidenceCoverageAudit(queue);

    expect(audit.summary).toMatchObject({
      status: "pass",
      highPriorityMissingCount: 0,
      missingEvidenceCount: 0,
    });

    for (const { player } of queue.rows) {
      const playerRows = rows.filter(row => row.player === player);
      const coveredCategories = new Set<FactualPlayerContextCategory>(
        playerRows.map(row => row.category),
      );

      expect(playerRows.length, player).toBe(factualPlayerContextCategories.length);
      expect([...coveredCategories].sort(), player).toEqual([...factualPlayerContextCategories].sort());
      expect(playerRows.every(row => row.source?.startsWith("https://")), player).toBe(true);
      expect(playerRows.every(row => row.note && row.note.length >= 24), player).toBe(true);
      expect(playerRows.every(row => row.score >= -2 && row.score <= 2), player).toBe(true);
      expect(playerRows.every(row => row.confidence >= 0 && row.confidence <= 1), player).toBe(true);
    }
  }, 15000);
});
