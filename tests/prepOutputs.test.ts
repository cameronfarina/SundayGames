import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import { buildBasePrices } from "../src/modeling/basePricing.js";
import { buildHistoricalCalibrationAudit } from "../src/modeling/calibrationAudit.js";
import { buildHistoricalBacktest } from "../src/modeling/historicalBacktest.js";
import { buildKeeperScenarioSensitivityReport } from "../src/modeling/keeperScenarioSensitivity.js";
import { runMockBatch } from "../src/modeling/mockBatch.js";
import { buildMockSmokeReport } from "../src/modeling/mockSmoke.js";
import type { EvidenceCoverageAudit } from "../src/modeling/playerEvidenceCoverage.js";
import type { PlayerEvidenceQueue } from "../src/modeling/playerEvidenceQueue.js";
import type { PlayerOutlierReviewQueue } from "../src/modeling/playerOutlierReviewQueue.js";
import { buildPrepOutputArtifacts, writePrepOutputArtifacts } from "../src/modeling/prepOutputs.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const evidenceQueue = {
  summary: {
    playerCount: 1,
    highPriorityCount: 1,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    categoryCounts: {
      opportunity: 1,
      defensiveAttention: 1,
    },
  },
  rows: [
    {
      priority: "high",
      rank: 11,
      player: "Drake London",
      position: "WR",
      scenarioPrice: 56,
      averageMockSalePrice: 62.67,
      saleVsScenarioPrice: 6.67,
      currentEvidenceCount: 0,
      evidenceStatus: "missing",
      flags: ["highMockPremium", "missingFactualEvidence"],
      categories: ["opportunity", "defensiveAttention"],
      researchPrompts: [
        "Opportunity: Validate role, routes/targets/touches, and whether the Weeks 1-4 projection is sustainable.",
        "Defensive attention: Check whether the player is gaining or losing true No. 1 defensive attention.",
      ],
    },
  ],
} satisfies PlayerEvidenceQueue;
const evidenceCoverageAudit = {
  summary: {
    status: "fail",
    playerCount: 1,
    coveredPlayerCount: 0,
    completeEvidenceCount: 0,
    missingEvidenceCount: 1,
    partialEvidenceCount: 0,
    highPriorityMissingCount: 1,
    evidenceRowCount: 0,
    provenanceCompleteEvidenceCount: 0,
    provenanceIncompleteEvidenceCount: 0,
    coverageRate: 0,
    completeEvidenceRate: 0,
    provenanceCompleteEvidenceRate: 1,
  },
  gates: {
    summary: {
      status: "fail",
      gateCount: 4,
      passCount: 1,
      warnCount: 0,
      failCount: 3,
    },
    items: [
      {
        key: "high-priority-missing",
        label: "High-priority missing evidence",
        status: "fail",
        target: 0,
        actual: 1,
        delta: 1,
        warnThreshold: 1,
        failThreshold: 1,
      },
      {
        key: "evidence-coverage-rate",
        label: "Evidence coverage rate",
        status: "fail",
        target: 0.8,
        actual: 0,
        delta: -0.8,
        warnThreshold: 0.8,
        failThreshold: 0.5,
      },
      {
        key: "complete-evidence-rate",
        label: "Complete evidence rate",
        status: "fail",
        target: 0.6,
        actual: 0,
        delta: -0.6,
        warnThreshold: 0.6,
        failThreshold: 0.25,
      },
      {
        key: "evidence-provenance-rate",
        label: "Evidence provenance rate",
        status: "pass",
        target: 1,
        actual: 1,
        delta: 0,
        warnThreshold: 1,
        failThreshold: 0.75,
      },
    ],
  },
  missingPlayers: [
    {
      priority: "high",
      rank: 11,
      player: "Drake London",
      position: "WR",
      scenarioPrice: 56,
      categories: ["opportunity", "defensiveAttention"],
    },
  ],
  provenanceIssues: [],
} satisfies EvidenceCoverageAudit;
const outlierQueue = {
  summary: {
    playerCount: 1,
    highPriorityCount: 1,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    reasonCounts: {
      highMockPremium: 1,
    },
  },
  rows: [
    {
      priority: "high",
      rank: 11,
      player: "Drake London",
      position: "WR",
      publicAnchorValue: 45,
      basePrice: 49,
      scenarioPrice: 56,
      averageMockSalePrice: 62.67,
      saleVsScenarioPrice: 6.67,
      minMockSalePrice: 57,
      maxMockSalePrice: 66,
      mockSaleRange: 9,
      draftedRate: 1,
      rankGap: -5,
      contextAdjustmentPercent: -0.1,
      currentEvidenceCount: 5,
      primaryReason: "highMockPremium",
      outlierReasons: [
        {
          key: "highMockPremium",
          severity: "review",
          message: "Mock sale average is $6.67 above the scenario anchor.",
          threshold: ">= $6 over scenario",
          actual: "$6.67",
        },
      ],
      thresholds: [">= $6 over scenario"],
      auditCommand: "npm run audit -- --player=\"Drake London\" --scenario=expected",
      reviewStatus: "open",
      reviewNote: "",
    },
  ],
} satisfies PlayerOutlierReviewQueue;

describe("prep output artifacts", () => {
  it("writes batch summary, calibration, and CSV draft-prep artifacts", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(projections, historicalRecords);
    const keeperScenarioSensitivity = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: 60,
    });
    const batch = runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 2,
      seedPrefix: "outputs-test",
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });
    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("Expected at least one mock run.");
    const smokeReport = buildMockSmokeReport({ run: firstRun, batch, rounds: 2 });
    const historicalBacktest = buildHistoricalBacktest(historicalRecords);
    const outputDirectory = await mkdtemp(join(tmpdir(), "mockd-prep-"));

    try {
      const artifacts = await writePrepOutputArtifacts({
        batch,
        audit,
        smokeReport,
        historicalBacktest,
        outputDirectory,
        evidenceQueue,
        evidenceCoverageAudit,
        outlierQueue,
        keeperScenarioSensitivity,
      });
      const filenames = artifacts.map(artifact => artifact.filename).sort();

      expect(filenames).toEqual([
        "calibration-gates.csv",
        "calibration-summary.csv",
        "high-price-volume-calibration.csv",
        "keeper-scenario-sensitivity.csv",
        "keeper-scenario-sensitivity.json",
        "historical-calibration-audit.json",
        "historical-backtest-gates.csv",
        "historical-backtest.json",
        "mock-smoke-first-two-rounds.csv",
        "mock-smoke.json",
        "mock-bid-diagnostics.csv",
        "mock-draft-board.csv",
        "mock-nomination-diagnostics.csv",
        "mock-room-pressure-diagnostics.csv",
        "owner-budget-trajectory.csv",
        "owner-player-exposure.csv",
        "owner-summaries.csv",
        "player-outlier-review-queue.csv",
        "player-evidence-coverage-gates.csv",
        "player-evidence-coverage.json",
        "player-evidence-queue.csv",
        "player-evidence-template.csv",
        "player-sale-ranges.csv",
        "price-tier-calibration.csv",
        "position-count-calibration.csv",
        "position-spend-calibration.csv",
        "scenario-calibration.csv",
        "mock-batch-summary.json",
      ].sort());

      const playerCsv = await readFile(join(outputDirectory, "player-sale-ranges.csv"), "utf8");
      expect(playerCsv.split("\n")[0]).toBe("name,position,drafted_count,drafted_rate,average_market_price,average_sale_price,minimum_sale_price,maximum_sale_price");

      const evidenceQueueCsv = await readFile(join(outputDirectory, "player-evidence-queue.csv"), "utf8");
      expect(evidenceQueueCsv.split("\n")[0]).toBe("priority,rank,player,position,scenario_price,average_mock_sale_price,sale_vs_scenario_price,current_evidence_count,evidence_status,flags,categories,research_prompts");
      expect(evidenceQueueCsv).toContain("high,11,Drake London,WR,56,62.67,6.67,0,missing");

      const outlierQueueCsv = await readFile(join(outputDirectory, "player-outlier-review-queue.csv"), "utf8");
      expect(outlierQueueCsv.split("\n")[0]).toBe("priority,rank,player,position,public_anchor_value,base_price,scenario_price,average_mock_sale_price,sale_vs_scenario_price,min_mock_sale_price,max_mock_sale_price,mock_sale_range,drafted_rate,rank_gap,context_adjustment_percent,current_evidence_count,primary_reason,outlier_reasons,thresholds,audit_command,review_status,review_note");
      expect(outlierQueueCsv).toContain("high,11,Drake London,WR,45,49,56,62.67,6.67,57,66,9,1,-5,-0.1,5,highMockPremium");

      const keeperSensitivityJson = JSON.parse(
        await readFile(join(outputDirectory, "keeper-scenario-sensitivity.json"), "utf8"),
      ) as { summary: { reportedPlayerCount: number; keeperRemovedCount: number; unpricedKeeperCount: number } };
      expect(keeperSensitivityJson.summary.reportedPlayerCount).toBe(60);
      expect(keeperSensitivityJson.summary.keeperRemovedCount).toBeGreaterThan(0);
      expect(keeperSensitivityJson.summary.unpricedKeeperCount).toBe(0);

      const keeperSensitivityCsv = await readFile(
        join(outputDirectory, "keeper-scenario-sensitivity.csv"),
        "utf8",
      );
      expect(keeperSensitivityCsv.split("\n")[0]).toBe("rank,player,position,base_price,confirmed_only_available,confirmed_only_price,confirmed_only_factor,expected_available,expected_price,expected_factor,high_retention_available,high_retention_price,high_retention_factor,price_spread,expected_vs_confirmed_delta,high_retention_vs_expected_delta,keeper_removed,keeper_removal_scenarios,keeper_removal_changed,availability_changed,unavailable_scenarios,unavailable_reasons");
      expect(keeperSensitivityCsv).toContain("expected/highRetention: Owner04 assumed keeper at $42");
      expect(keeperSensitivityCsv).toContain("Mark Andrews");

      const evidenceTemplateCsv = await readFile(join(outputDirectory, "player-evidence-template.csv"), "utf8");
      expect(evidenceTemplateCsv.split("\n")[0]).toBe("player,category,score,confidence,source,note,provider,source_date,source_quality,priority,rank,position,scenario_price,average_mock_sale_price,sale_vs_scenario_price,evidence_status,flags,research_prompt");
      expect(evidenceTemplateCsv).toContain("Drake London,opportunity,,,");

      const evidenceCoverageJson = JSON.parse(
        await readFile(join(outputDirectory, "player-evidence-coverage.json"), "utf8"),
      ) as EvidenceCoverageAudit;
      expect(evidenceCoverageJson.summary.status).toBe("fail");

      const evidenceCoverageGatesCsv = await readFile(
        join(outputDirectory, "player-evidence-coverage-gates.csv"),
        "utf8",
      );
      expect(evidenceCoverageGatesCsv.split("\n")[0]).toBe("key,label,status,target,actual,delta,warn_threshold,fail_threshold");
      expect(evidenceCoverageGatesCsv).toContain("high-priority-missing,High-priority missing evidence,fail");
      expect(evidenceCoverageGatesCsv).toContain("evidence-provenance-rate,Evidence provenance rate");

      const draftBoardCsv = await readFile(join(outputDirectory, "mock-draft-board.csv"), "utf8");
      const draftBoardLines = draftBoardCsv.trim().split("\n");
      expect(draftBoardLines[0]).toBe("seed,scenario,pick,nominator,winner,player,position,anchor_price,sale_price,budget_after_pick,roster_slots_after_pick,top_bid_1_owner,top_bid_1_amount,top_bid_1_uncapped,top_bid_2_owner,top_bid_2_amount,top_bid_2_uncapped,top_bid_3_owner,top_bid_3_amount,top_bid_3_uncapped");
      expect(draftBoardLines).toHaveLength(batch.runs.reduce((count, run) => count + run.pickCount, 0) + 1);
      expect(draftBoardLines[1]).toContain(",expected,1,");

      const bidDiagnosticsCsv = await readFile(join(outputDirectory, "mock-bid-diagnostics.csv"), "utf8");
      const bidDiagnosticsLines = bidDiagnosticsCsv.trim().split("\n");
      const bidDiagnosticsHeader = bidDiagnosticsLines[0] ?? "";
      expect(bidDiagnosticsHeader).toBe("seed,scenario,pick,nominator,winner,player,position,anchor_price,sale_price,bid_rank,bid_owner,bid_amount,bid_uncapped,bid_max,bid_capped_by_max,owner_demand_multiplier,roster_need_multiplier,scarcity_multiplier,behavior_aggression_multiplier,behavior_scarcity_multiplier,build_style_multiplier,replacement_patience_multiplier,endgame_pressure_multiplier,room_pressure_multiplier,competition_pressure_multiplier,budget_pacing_multiplier,bid_variance_multiplier,top_end_damping_multiplier,position_overbid_damping_multiplier,context_penalty_damping_multiplier,second_bid_amount,reserve_price,nominator_opening_bid,uncapped_sale_price,top_end_guarded_price,sale_price_basis,top_driver_1,top_driver_1_multiplier,top_driver_2,top_driver_2_multiplier,top_driver_3,top_driver_3_multiplier");
      expect(bidDiagnosticsLines).toHaveLength(
        batch.runs.reduce(
          (count, run) => count + run.picks.reduce((pickCount, pick) => pickCount + pick.topBids.length, 0),
          0,
        ) + 1,
      );
      expect(bidDiagnosticsLines[1]).toContain(",expected,1,");
      expect(bidDiagnosticsLines[1]?.split(",")).toHaveLength(bidDiagnosticsHeader.split(",").length);

      const nominationDiagnosticsCsv = await readFile(
        join(outputDirectory, "mock-nomination-diagnostics.csv"),
        "utf8",
      );
      const nominationDiagnosticsLines = nominationDiagnosticsCsv.trim().split("\n");
      expect(nominationDiagnosticsLines[0]).toBe("seed,scenario,pick,nominator,selected_player,selected_position,candidate_count,candidate_rank,candidate_player,candidate_position,market_price,projection_total,total_score,market_price_score,projection_score,owner_need_score,opponent_need_score,affordability_score,scarcity_score,flush_money_score,tie_break_score,market_price_contribution,projection_contribution,owner_need_contribution,opponent_need_contribution,affordability_contribution,scarcity_contribution,flush_money_contribution,tie_break_contribution");
      expect(nominationDiagnosticsLines).toHaveLength(
        batch.runs.reduce(
          (count, run) => count + run.picks.reduce(
            (pickCount, pick) => pickCount + pick.nominationDiagnostics.topCandidates.length,
            0,
          ),
          0,
        ) + 1,
      );
      expect(nominationDiagnosticsLines[1]).toContain(",expected,1,");

      const roomPressureDiagnosticsCsv = await readFile(
        join(outputDirectory, "mock-room-pressure-diagnostics.csv"),
        "utf8",
      );
      const roomPressureDiagnosticsLines = roomPressureDiagnosticsCsv.trim().split("\n");
      expect(roomPressureDiagnosticsLines[0]).toBe("seed,scenario,pick,nominator,winner,player,position,anchor_price,sale_price,legal_bidder_count,bidders_at_or_above_reserve,bidders_at_or_above_anchor,bidders_at_or_above_sale_price,cash_heavy_bidder_count,max_bidder_max_bid,median_bidder_max_bid,average_bidder_max_bid,winning_owner_max_bid,winning_owner_budget_remaining_before,winning_owner_budget_per_roster_slot_before");
      expect(roomPressureDiagnosticsLines).toHaveLength(
        batch.runs.reduce((count, run) => count + run.pickCount, 0) + 1,
      );
      expect(roomPressureDiagnosticsLines[1]).toContain(",expected,1,");

      const ownerBudgetTrajectoryCsv = await readFile(
        join(outputDirectory, "owner-budget-trajectory.csv"),
        "utf8",
      );
      const ownerBudgetTrajectoryLines = ownerBudgetTrajectoryCsv.trim().split("\n");
      expect(ownerBudgetTrajectoryLines[0]).toBe("seed,scenario,pick,event,owner,nominator,winner,player,position,market_price,sale_price,spent,initial_spend,auction_spend,budget_remaining,roster_slots_remaining,max_bid,roster_size,budget_per_roster_slot,qb_count,rb_count,wr_count,te_count,k_count,dst_count");
      expect(ownerBudgetTrajectoryLines).toHaveLength(
        batch.runs.reduce((count, run) => count + (run.pickCount + 1) * run.rosters.length, 0) + 1,
      );
      expect(ownerBudgetTrajectoryLines[1]).toContain(",expected,0,initial,");
      expect(ownerBudgetTrajectoryCsv).toContain(",after_pick,");

      const smokeJson = JSON.parse(
        await readFile(join(outputDirectory, "mock-smoke.json"), "utf8"),
      ) as { seed: string; firstTwoRounds: unknown[]; warnings: unknown[] };
      expect(smokeJson.seed).toBe(firstRun.seed);
      expect(smokeJson.firstTwoRounds).toHaveLength(smokeReport.firstTwoRounds.length);
      expect(smokeJson.warnings).toEqual(smokeReport.warnings);

      const firstTwoRoundsCsv = await readFile(join(outputDirectory, "mock-smoke-first-two-rounds.csv"), "utf8");
      expect(firstTwoRoundsCsv.split("\n")[0]).toBe("pick,round,nominator,winner,player,position,anchor_price,sale_price,sale_vs_anchor,budget_after_pick,roster_slots_after_pick");
      expect(firstTwoRoundsCsv.trim().split("\n")).toHaveLength(smokeReport.firstTwoRounds.length + 1);

      const calibrationSummaryCsv = await readFile(join(outputDirectory, "calibration-summary.csv"), "utf8");
      expect(calibrationSummaryCsv.split("\n")[0]).toBe("category,key,label,target,actual,delta");
      expect(calibrationSummaryCsv).toContain("position_count");
      expect(calibrationSummaryCsv).toContain("owner_spend");

      const calibrationGatesCsv = await readFile(join(outputDirectory, "calibration-gates.csv"), "utf8");
      expect(calibrationGatesCsv.split("\n")[0]).toBe("key,category,label,status,mode,target,actual,delta,warn_threshold,fail_threshold");
      expect(calibrationGatesCsv).toContain("high-price-volume:80-plus,high_price_volume,$80+ player count,pass,maximum");
      expect(calibrationGatesCsv).toContain("high-price-volume-floor:80-plus,high_price_volume,$80+ player count floor,pass,minimum");
      expect(calibrationGatesCsv).toContain("price-tier-count:dollar,price_tier_count,$1 player count,");

      const highPriceVolumeCsv = await readFile(join(outputDirectory, "high-price-volume-calibration.csv"), "utf8");
      expect(highPriceVolumeCsv.split("\n")[0]).toBe("threshold,historical_average_count,historical_max_count,mock_average_count,mock_max_count,average_count_delta,max_count_delta");
      expect(highPriceVolumeCsv).toContain("80,0.33,1,");

      const positionCountCsv = await readFile(join(outputDirectory, "position-count-calibration.csv"), "utf8");
      expect(positionCountCsv.split("\n")[0]).toBe("position,historical_average_count,mock_average_count,delta");
      expect(positionCountCsv).toContain("QB,22.33,");

      const positionSpendCsv = await readFile(join(outputDirectory, "position-spend-calibration.csv"), "utf8");
      expect(positionSpendCsv.split("\n")[0]).toBe("position,historical_average_spend,scenario_average_spend_target,mock_average_spend,historical_delta,scenario_delta");

      const scenarioCsv = await readFile(join(outputDirectory, "scenario-calibration.csv"), "utf8");
      expect(scenarioCsv.split("\n")[0]).toBe("scenario,label,run_count,invalid_roster_count,average_pick_count,scenario_open_auction_dollars,mock_auction_spend,scenario_spend_delta,league_average_budget_remaining,max_owner_average_budget_remaining");
      expect(scenarioCsv).toContain("expected,Expected,2,0,");

      const calibrationJson = JSON.parse(
        await readFile(join(outputDirectory, "historical-calibration-audit.json"), "utf8"),
      ) as { runCount: number; gates: { summary: { status: string; credible: boolean } } };
      expect(calibrationJson.runCount).toBe(2);
      expect(["pass", "warn", "fail"]).toContain(calibrationJson.gates.summary.status);
      expect(calibrationJson.gates.summary.credible).toBe(true);

      const backtestJson = JSON.parse(
        await readFile(join(outputDirectory, "historical-backtest.json"), "utf8"),
      ) as { method: string; summary: { gateCount: number } };
      expect(backtestJson).toMatchObject({
        method: "leave-one-season-out",
        summary: {
          gateCount: historicalBacktest.summary.gateCount,
        },
      });

      const backtestGatesCsv = await readFile(join(outputDirectory, "historical-backtest-gates.csv"), "utf8");
      expect(backtestGatesCsv.split("\n")[0]).toBe("season,source_seasons,key,category,label,status,target,actual,delta,warn_threshold,fail_threshold");
      expect(backtestGatesCsv.trim().split("\n")).toHaveLength(historicalBacktest.summary.gateCount + 1);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }, 15000);

  it("keeps smoke and backtest artifacts optional for callers that only need legacy prep files", async () => {
    const artifacts = buildPrepOutputArtifacts({
      batch: {
        options: {
          scenarioKeys: ["expected"],
          runsPerScenario: 0,
          seedPrefix: "minimal",
        },
        runs: [],
        summary: {
          runCount: 0,
          scenarios: [],
          players: [],
          owners: [],
          ownerPlayerExposure: [],
        },
      },
      audit: {
        runCount: 0,
        historicalSeasons: [],
        summary: {
          runCount: 0,
          scenarioKeys: ["expected"],
          runsPerScenario: 0,
          largestPriceTierCountDeltas: [],
          largestPositionCountDeltas: [],
          largestPositionSpendDeltas: [],
          largestOwnerSpendDeltas: [],
          budgetRemaining: {
            leagueAverageBudgetRemaining: 0,
            ownersWithAverageBudgetRemaining: [],
          },
        },
        priceTiers: [],
        highPriceVolumes: [],
        positionCounts: [],
        positionSpend: [],
        ownerSpend: [],
        scenarios: [],
        overall: {
          historicalAverageAuctionSpend: 0,
          scenarioAverageOpenAuctionDollars: 0,
          mockAverageAuctionSpend: 0,
          auctionSpendDelta: 0,
          scenarioAuctionSpendDelta: 0,
          historicalAverageDollarPlayers: 0,
          mockAverageDollarPlayers: 0,
          dollarPlayerDelta: 0,
        },
        gates: {
          summary: {
            status: "pass",
            credible: true,
            gateCount: 0,
            passCount: 0,
            warnCount: 0,
            failCount: 0,
          },
          items: [],
        },
      },
      outputDirectory: "unused",
    });
    const filenames = artifacts.map(artifact => artifact.filename);

    expect(filenames).toContain("mock-batch-summary.json");
    expect(filenames).toContain("historical-calibration-audit.json");
    expect(filenames).toContain("mock-nomination-diagnostics.csv");
    expect(filenames).toContain("owner-budget-trajectory.csv");
    expect(filenames).not.toContain("keeper-scenario-sensitivity.json");
    expect(filenames).not.toContain("keeper-scenario-sensitivity.csv");
    expect(filenames).not.toContain("mock-smoke.json");
    expect(filenames).not.toContain("mock-smoke-first-two-rounds.csv");
    expect(filenames).not.toContain("historical-backtest.json");
    expect(filenames).not.toContain("historical-backtest-gates.csv");
  });
});
