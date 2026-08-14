import { keepers } from "../config/keepers.js";
import { leagueConfig, ownerOrder, primaryOwner, type Owner } from "../config/league.js";
import { keeperSummary } from "./keeperModel.js";
import { loadHistoricalAuctionRecords } from "./data/parseHistoricalBoards.js";
import {
  loadPlayerEvidenceSourceRows,
  playerContextEvidenceCsv,
  type PlayerEvidenceSourceAdapterKey,
} from "./data/playerEvidenceSourceAdapters.js";
import {
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
} from "./modeling/auctionEngine.js";
import { buildHistoricalCalibrationAudit } from "./modeling/calibrationAudit.js";
import {
  buildBasePrices,
  summarizePricePool,
  type PricingConfig,
} from "./modeling/basePricing.js";
import {
  buildDraftPlanReport,
  draftPlanReportCsv,
  draftPlanAuctionOverridesFor,
  type DraftPlanPlayer,
  type DraftPlanReport,
  type DraftPlanStrategyKey,
} from "./modeling/draftPlan.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "./modeling/keeperInflation.js";
import {
  buildKeeperScenarioSensitivityReport,
  keeperScenarioSensitivityCsv,
} from "./modeling/keeperScenarioSensitivity.js";
import { buildHistoricalBacktest } from "./modeling/historicalBacktest.js";
import {
  buildLeagueOpenAuctionSpendTargets,
  buildOwnerProfiles,
  defaultHistoricalWeights,
} from "./modeling/ownerProfiles.js";
import { runMock, runMockBatch } from "./modeling/mockBatch.js";
import { buildMockSmokeReport } from "./modeling/mockSmoke.js";
import {
  buildPlayerEvidenceCoverageAudit,
  playerEvidenceCoverageGatesCsv,
} from "./modeling/playerEvidenceCoverage.js";
import {
  buildPlayerEvidenceQueue,
  playerEvidenceQueueCsv,
  type PlayerEvidenceQueue,
} from "./modeling/playerEvidenceQueue.js";
import { playerEvidenceTemplateCsv } from "./modeling/playerEvidenceTemplate.js";
import { buildPlayerPriceAudit } from "./modeling/playerPriceAudit.js";
import {
  buildPlayerOutlierReviewQueue,
  playerOutlierReviewQueueCsv,
  type PlayerOutlierReviewQueue,
} from "./modeling/playerOutlierReviewQueue.js";
import { writePrepOutputArtifacts } from "./modeling/prepOutputs.js";
import { buildProjectionRankings } from "./modeling/projectionRankings.js";
import { buildQaReport } from "./modeling/qaReport.js";
import { buildDraftReadyReport } from "./modeling/draftReadiness.js";
import { liveDraftStrategies, type LiveDraftStrategyKey } from "./modeling/liveDraftStrategies.js";
import { type ForcedAuctionSale } from "./modeling/mockBatch.js";
import {
  buildAroundStrategyLabScenarios,
  runStrategyLab,
  strategyLabReportMarkdown,
  type StrategyLabScenario,
  type StrategyLabTargetMaxBid,
} from "./modeling/strategyLab.js";
import { buildTopPlayerSanityReport } from "./modeling/topPlayerSanity.js";
import { buildPricingConfigFromSources, playerEvidencePathFor } from "./pricingConfig.js";
import {
  defaultSeasonLongProjectionPath,
  loadCurrentProjections,
} from "./projections.js";

const command = process.argv[2];
const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const scenarioKeys = ["confirmedOnly", "expected", "highRetention"] as const;

const playerContextSummary = (config: PricingConfig, importPath?: string, evidencePath?: string) => ({
  enabled: config.playerContext.enabled,
  weights: config.playerContext.weights,
  maxAdjustment: config.playerContext.maxAdjustment,
  maxPositiveAdjustment: config.playerContext.maxPositiveAdjustment ?? config.playerContext.maxAdjustment,
  maxNegativeAdjustment: config.playerContext.maxNegativeAdjustment ?? config.playerContext.maxAdjustment,
  overrideCount: config.playerContext.overrides.length,
  ...(importPath ? { importPath } : {}),
  ...(evidencePath ? { evidencePath } : {}),
});

const countBySeason = (records: { season: number }[]): Record<number, number> =>
  records.reduce<Record<number, number>>((counts, record) => {
    counts[record.season] = (counts[record.season] ?? 0) + 1;
    return counts;
  }, {});

const optionValue = (name: string): string | undefined => {
  const option = process.argv.find(arg => arg.startsWith(`${name}=`));
  return option?.slice(name.length + 1);
};

const optionValues = (name: string): string[] =>
  process.argv
    .filter(arg => arg.startsWith(`${name}=`))
    .map(arg => arg.slice(name.length + 1));

const playerEvidencePathFromOptions = (): string | undefined => {
  const explicitEvidencePath = optionValue("--player-evidence");
  return playerEvidencePathFor({
    ...(explicitEvidencePath === undefined ? {} : { playerEvidencePath: explicitEvidencePath }),
    useDefaultEvidence: !process.argv.includes("--no-default-evidence"),
  });
};

const pricingConfigFromOptions = async (): Promise<PricingConfig> => {
  const importPath = optionValue("--player-context");
  const evidencePath = playerEvidencePathFromOptions();

  return buildPricingConfigFromSources({
    customWeights: process.argv.includes("--custom-weights"),
    ...(importPath === undefined ? {} : { playerContextPath: importPath }),
    ...(evidencePath === undefined ? {} : { playerEvidencePath: evidencePath }),
    useDefaultEvidence: !process.argv.includes("--no-default-evidence"),
  });
};

const numericOptionValue = (name: string, fallback: number): number => {
  const value = optionValue(name);
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const requiredOptionValue = (name: string): string => {
  const value = optionValue(name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const evidenceSourceAdapterOptionValue = (): PlayerEvidenceSourceAdapterKey => {
  const value = optionValue("--adapter") ?? "scored-local";
  if (value !== "scored-local") {
    throw new Error(`Unknown evidence source adapter "${value}". Use scored-local.`);
  }

  return value;
};

const scenarioOptionValue = (name = "--scenario"): (typeof scenarioKeys)[number] => {
  const value = optionValue(name) ?? "expected";
  const scenario = scenarioKeys.find(candidate => candidate === value);
  if (!scenario) {
    throw new Error(`Unknown keeper scenario "${value}". Use confirmedOnly, expected, or highRetention.`);
  }
  return scenario;
};

const scenarioListOptionValue = (): (typeof scenarioKeys)[number][] => {
  const value = optionValue("--scenarios");
  if (!value) return ["expected"];

  return value.split(",").map(key => {
    const scenario = scenarioKeys.find(candidate => candidate === key);
    if (!scenario) {
      throw new Error(`Unknown keeper scenario "${key}". Use confirmedOnly, expected, or highRetention.`);
    }
    return scenario;
  });
};

const ownerOptionValue = (): Owner => {
  const value = optionValue("--owner") ?? primaryOwner;
  const owner = ownerOrder.find(candidate => candidate === value);
  if (!owner) throw new Error(`Unknown owner "${value}". Use one of: ${ownerOrder.join(", ")}.`);
  return owner;
};

const draftPlanStrategyOptionValue = (): DraftPlanStrategyKey => {
  const value = optionValue("--strategy") ?? "three-rb";
  if (value in liveDraftStrategies) return value as DraftPlanStrategyKey;

  throw new Error(`Unknown draft plan strategy "${value}". Use balanced, three-rb, hero-rb, or wr-heavy.`);
};

const draftPlanStrategyModeOptionValue = (): "filter" | "force" => {
  const value = optionValue("--strategy-mode") ?? "force";
  if (value !== "filter" && value !== "force") {
    throw new Error(`Unknown draft plan strategy mode "${value}". Use filter or force.`);
  }
  return value;
};

const draftPlanEngineModeOptionValue = (): "fast" | "full" => {
  const value = optionValue("--engine-mode") ?? "fast";
  if (value !== "fast" && value !== "full") {
    throw new Error(`Unknown draft plan engine mode "${value}". Use fast or full.`);
  }
  return value;
};

const strategyLabStrategyOptionValue = (): LiveDraftStrategyKey => {
  const value = optionValue("--strategy") ?? "balanced";
  if (value in liveDraftStrategies) return value as LiveDraftStrategyKey;

  throw new Error(`Unknown strategy lab strategy "${value}". Use balanced, three-rb, hero-rb, or wr-heavy.`);
};

const strategyLabPlayerPriceEntriesOptionValue = (
  optionName: "--force" | "--target",
): { player: string; price: number }[] | undefined => {
  const values = optionValues(optionName);
  if (values.length === 0) return undefined;

  return values.flatMap(value => value.split(",")).map(rawEntry => {
    const separatorIndex = rawEntry.lastIndexOf(":");
    if (separatorIndex <= 0 || separatorIndex === rawEntry.length - 1) {
      throw new Error(`Invalid ${optionName} entry "${rawEntry}". Use Player Name:price.`);
    }

    const player = rawEntry.slice(0, separatorIndex).trim();
    const priceText = rawEntry.slice(separatorIndex + 1).trim().replace(/^\$/, "");
    const price = Number(priceText);
    if (!player || !Number.isInteger(price) || price < 1) {
      throw new Error(`Invalid ${optionName} entry "${rawEntry}". Use Player Name:price.`);
    }

    return { player, price };
  });
};

const strategyLabForcedSalesOptionValue = (): ForcedAuctionSale[] | undefined =>
  strategyLabPlayerPriceEntriesOptionValue("--force")
    ?.map(({ player, price }) => ({ owner: primaryOwner, player, price }));

const strategyLabTargetMaxBidsOptionValue = (): StrategyLabTargetMaxBid[] | undefined =>
  strategyLabPlayerPriceEntriesOptionValue("--target")
    ?.map(({ player, price }) => ({ owner: primaryOwner, player, maxBid: price }));

const buildAroundPricesFor = (priceSpec: string): number[] => {
  const [rangeText, stepText] = priceSpec.split(":");
  if (!rangeText) throw new Error("Build-around price list is required.");

  if (rangeText.includes("-")) {
    const [minimumText, maximumText] = rangeText.split("-");
    const minimum = Number(minimumText);
    const maximum = Number(maximumText);
    const step = stepText === undefined ? 1 : Number(stepText);

    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximum) ||
      !Number.isInteger(step) ||
      minimum < 1 ||
      maximum < minimum ||
      step < 1
    ) {
      throw new Error(`Invalid build-around range "${priceSpec}". Use min-max[:step], for example 46-52:2.`);
    }

    const prices: number[] = [];
    for (let price = minimum; price <= maximum; price += step) prices.push(price);
    return prices;
  }

  const prices = rangeText.split(",").map(priceText => Number(priceText.trim()));
  if (prices.some(price => !Number.isInteger(price) || price < 1)) {
    throw new Error(`Invalid build-around prices "${priceSpec}". Use 46,48,50 or 46-52:2.`);
  }
  return prices;
};

const strategyLabBuildAroundOptionValues = (): { player: string; prices: number[] }[] =>
  optionValues("--build-around").map(rawEntry => {
    const separatorIndex = rawEntry.indexOf(":");
    if (separatorIndex <= 0 || separatorIndex === rawEntry.length - 1) {
      throw new Error(`Invalid --build-around entry "${rawEntry}". Use Player Name:price,price or Player Name:min-max:step.`);
    }

    const player = rawEntry.slice(0, separatorIndex).trim();
    const priceSpec = rawEntry.slice(separatorIndex + 1).trim().replace(/\$/g, "");
    if (!player || !priceSpec) {
      throw new Error(`Invalid --build-around entry "${rawEntry}". Use Player Name:price,price or Player Name:min-max:step.`);
    }

    return { player, prices: buildAroundPricesFor(priceSpec) };
  });

const strategyLabScenariosFromOptions = (): StrategyLabScenario[] | undefined => {
  const forcedSales = strategyLabForcedSalesOptionValue() ?? [];
  const targetMaxBids = strategyLabTargetMaxBidsOptionValue() ?? [];
  const buildAroundEntries = strategyLabBuildAroundOptionValues();
  if (buildAroundEntries.length > 0) {
    return buildAroundEntries.flatMap(entry =>
      buildAroundStrategyLabScenarios({
        player: entry.player,
        prices: entry.prices,
        strategyKey: strategyLabStrategyOptionValue(),
        baseForcedSales: forcedSales,
        targetMaxBids,
      }),
    );
  }

  if (forcedSales.length === 0 && targetMaxBids.length === 0) return undefined;

  return [{
    key: "custom",
    label: optionValue("--label") ?? "Custom",
    question: "Custom primary-team strategy-lab path.",
    strategyKey: strategyLabStrategyOptionValue(),
    forcedSales,
    targetMaxBids,
  }];
};

const marketBandFor = (player: DraftPlanPlayer): string => {
  if (!player.market) return "";
  return `, avg $${player.market.averageSalePrice}, range $${player.market.minimumSalePrice}-$${player.market.maximumSalePrice}`;
};

const draftPlanPlayerMarkdown = (player: DraftPlanPlayer): string =>
  `${player.position} ${player.name} $${player.price}${marketBandFor(player)}`;

const draftPlanPriceBandMarkdown = (
  band: DraftPlanReport["recommendations"]["maxPriceBands"][number],
): string =>
  `${band.slot} $${band.minimumPrice}-$${band.maximumPrice}`;

const draftPlanCoachBlueprintMarkdown = (
  blueprint: DraftPlanReport["recommendations"]["strategyCoach"]["blueprint"][number],
): string => {
  const lockedNames = blueprint.lockedNames.map(name => `${name} locked`);
  const names = [...lockedNames, ...blueprint.targetNames].join(" / ");
  const fallbacks = blueprint.fallbackNames.length
    ? `; fallback ${blueprint.fallbackPriceBand}: ${blueprint.fallbackNames.join(" / ")}`
    : "";
  return `${blueprint.slot} ${blueprint.priceBand}: ${names || "no recurring targets"}${fallbacks}`;
};

const draftPlanReportMarkdown = (report: DraftPlanReport): string => {
  const coach = report.recommendations.strategyCoach;
  const lines = [
    `# ${report.owner} ${report.strategy.label} Draft Plans`,
    "",
    `Engine: ${report.engineMode}`,
    `Runs: ${report.runCount}`,
    `Matches: ${report.matchedRunCount}`,
    `Thresholds: RB1 $${report.strategy.thresholds.rb1Minimum}+, RB2 $${report.strategy.thresholds.rb2Minimum}+, RB3 $${report.strategy.thresholds.rb3Minimum}+, core $${report.strategy.thresholds.rbCoreSpendMinimum}+`,
    "",
    "## Path Recommendations",
    `Max bands: ${report.recommendations.maxPriceBands.map(draftPlanPriceBandMarkdown).join(" | ")}`,
    `Targets: ${report.recommendations.targetClusters.map(cluster => `${cluster.label} ${cluster.priceBand}`).join(" | ") || "none"}`,
    `Pivots: ${report.recommendations.pivotRules.map(rule => `${rule.label} - ${rule.action}`).join(" | ") || "none"}`,
    `Dead zones: ${report.recommendations.deadZoneWarnings.join(" | ") || "none"}`,
    "",
    "## Strategy Coach",
    coach.headline,
    `Blueprint: ${coach.blueprint.map(draftPlanCoachBlueprintMarkdown).join(" | ") || "none"}`,
    `Contingencies: ${coach.contingencyPlans.map(plan => `${plan.label} - ${plan.action}`).join(" | ") || "none"}`,
    `Risk guardrails: ${coach.riskGuardrails.map(guardrail => `${guardrail.label} (${guardrail.status}) - ${guardrail.detail}`).join(" | ") || "none"}`,
  ];

  for (const [index, candidate] of report.candidates.entries()) {
    lines.push(
      "",
      `## ${index + 1}. ${candidate.seed}`,
      `Spend: $${candidate.rosterSpend}, left: $${candidate.budgetRemaining}, RB core: $${candidate.rbCoreSpend}, Weeks 1-4: ${candidate.weeks1To4Score}`,
      `RB core: ${candidate.rbCore.map(draftPlanPlayerMarkdown).join(" | ")}`,
      "Starters:",
      ...candidate.lineup.map(entry => `- ${entry.slot}: ${draftPlanPlayerMarkdown(entry.player)}`),
      "Bench:",
      ...candidate.bench.map(player => `- ${draftPlanPlayerMarkdown(player)}`),
    );
  }

  if (report.candidates.length === 0) {
    lines.push("", "No matching draft plans found for this owner/strategy/run sample.");
  }

  return lines.join("\n");
};

const buildPlayerEvidenceQueueFromOptions = async (
  defaultSeedPrefix: string,
): Promise<PlayerEvidenceQueue> => {
  const pricingConfig = await pricingConfigFromOptions();
  const players = await loadCurrentProjections({ projectionPath });
  const historicalRecords = await loadHistoricalAuctionRecords();
  const sanityReport = buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOptionValue(),
    limit: numericOptionValue("--limit", 40),
    runs: numericOptionValue("--runs", 10),
    seedPrefix: optionValue("--seed-prefix") ?? defaultSeedPrefix,
    pricingConfig,
  });

  return buildPlayerEvidenceQueue(sanityReport);
};

const buildPlayerOutlierReviewQueueFromOptions = async (
  defaultSeedPrefix: string,
): Promise<PlayerOutlierReviewQueue> => {
  const pricingConfig = await pricingConfigFromOptions();
  const players = await loadCurrentProjections({ projectionPath });
  const historicalRecords = await loadHistoricalAuctionRecords();
  const sanityReport = buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOptionValue(),
    limit: numericOptionValue("--limit", 40),
    runs: numericOptionValue("--runs", 10),
    seedPrefix: optionValue("--seed-prefix") ?? defaultSeedPrefix,
    pricingConfig,
  });

  return buildPlayerOutlierReviewQueue(sanityReport);
};

const main = async (): Promise<void> => {
  const playerContextImportPath = optionValue("--player-context");
  const playerContextEvidencePath = playerEvidencePathFromOptions();

  if (command === "keepers") {
    console.log(JSON.stringify(keeperSummary(), null, 2));
    return;
  }

  if (command === "profiles") {
    const historicalRecords = await loadHistoricalAuctionRecords();
    const profiles = buildOwnerProfiles(historicalRecords);

    console.log(JSON.stringify({
      weights: defaultHistoricalWeights,
      profiles,
      ownerDemandMultipliers: buildOwnerDemandMultipliers(profiles),
      ownerAuctionBehaviors: buildOwnerAuctionBehaviors(profiles),
      ownerRosterMaximums: buildOwnerRosterMaximums(profiles),
      openAuctionSpendTargets: buildLeagueOpenAuctionSpendTargets(historicalRecords),
    }, null, 2));
    return;
  }

  if (command === "rankings") {
    const players = await loadCurrentProjections({ projectionPath });
    const rankings = buildProjectionRankings(players);

    console.log(JSON.stringify({
      source: {
        projectionFile: projectionPath,
        seasonLongProjectionFile: defaultSeasonLongProjectionPath,
        projectionLeagueId: 278452,
        historicalLeagueId: leagueConfig.leagueId,
        caveat: "Projection scoring is public; historical pricing uses the configured local data source when present.",
        rankBasis: "Weeks 1-4 projected fantasy points positional rank",
      },
      count: rankings.length,
      rankings,
    }, null, 2));
    return;
  }

  if (command === "prices") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);

    console.log(JSON.stringify({
      config: {
        draftedPoolCounts: pricingConfig.draftedPoolCounts,
        positionMarketMultipliers: pricingConfig.positionMarketMultipliers,
        rankGapAdjustmentCap: pricingConfig.rankGapAdjustmentCap,
        marketPressureByPosition: pricingConfig.marketPressureByPosition,
        hardPriceCeilings: pricingConfig.hardPriceCeilings,
        topPriceVolumeLimits: pricingConfig.topPriceVolumeLimits,
        playerContext: playerContextSummary(pricingConfig, playerContextImportPath, playerContextEvidencePath),
      },
      summary: summarizePricePool(prices),
      prices,
    }, null, 2));
    return;
  }

  if (command === "scenarios") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const scenarios = buildKeeperScenarios(keepers);

    console.log(JSON.stringify({
      config: {
        playerContext: playerContextSummary(pricingConfig, playerContextImportPath, playerContextEvidencePath),
      },
      scenarios: scenarios.map(scenario => applyKeeperScenarioToPrices(prices, scenario, keepers)),
    }, null, 2));
    return;
  }

  if (command === "scenarios-sensitivity") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const report = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: numericOptionValue("--limit", 60),
    });
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(keeperScenarioSensitivityCsv(report));
      return;
    }

    if (format !== "json") throw new Error(`Unknown scenario sensitivity format "${format}". Use json or csv.`);

    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "validate") {
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const visibleDraftRecords = historicalRecords.filter(record => record.acquisitionType !== "post-draft waiver");

    console.log(`Loaded ${players.length} projection records.`);
    console.log(`Loaded ${historicalRecords.length} historical roster records.`);
    console.log(`Visible draft records by season: ${JSON.stringify(countBySeason(visibleDraftRecords))}.`);
    return;
  }

  if (command === "audit") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify(buildPlayerPriceAudit({
      playerName: requiredOptionValue("--player"),
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: scenarioOptionValue(),
      runs: numericOptionValue("--runs", 10),
      seedPrefix: optionValue("--seed-prefix") ?? "player-audit",
      pricingConfig,
    }), null, 2));
    return;
  }

  if (command === "sanity") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify(buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: scenarioOptionValue(),
      limit: numericOptionValue("--limit", 40),
      runs: numericOptionValue("--runs", 10),
      seedPrefix: optionValue("--seed-prefix") ?? "top-sanity",
      pricingConfig,
    }), null, 2));
    return;
  }

  if (command === "evidence-queue") {
    const queue = await buildPlayerEvidenceQueueFromOptions("evidence-queue");
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(playerEvidenceQueueCsv(queue));
      return;
    }

    if (format !== "json") throw new Error(`Unknown evidence queue format "${format}". Use json or csv.`);

    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  if (command === "outliers-queue") {
    const queue = await buildPlayerOutlierReviewQueueFromOptions("outliers-queue");
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(playerOutlierReviewQueueCsv(queue));
      return;
    }

    if (format !== "json") throw new Error(`Unknown outlier queue format "${format}". Use json or csv.`);

    console.log(JSON.stringify(queue, null, 2));
    return;
  }

  if (command === "evidence-template") {
    console.log(playerEvidenceTemplateCsv(await buildPlayerEvidenceQueueFromOptions("evidence-template")));
    return;
  }

  if (command === "evidence-adapt") {
    const rows = await loadPlayerEvidenceSourceRows({
      path: requiredOptionValue("--input"),
      adapter: evidenceSourceAdapterOptionValue(),
    });
    const format = optionValue("--format") ?? "csv";

    if (format === "csv") {
      console.log(playerContextEvidenceCsv(rows));
      return;
    }

    if (format !== "json") throw new Error(`Unknown evidence adapter format "${format}". Use csv or json.`);

    console.log(JSON.stringify({ evidence: rows }, null, 2));
    return;
  }

  if (command === "evidence-coverage") {
    const audit = buildPlayerEvidenceCoverageAudit(
      await buildPlayerEvidenceQueueFromOptions("evidence-coverage"),
    );
    const format = optionValue("--format") ?? "json";

    if (format === "csv") {
      console.log(playerEvidenceCoverageGatesCsv(audit));
      return;
    }

    if (format !== "json") throw new Error(`Unknown evidence coverage format "${format}". Use json or csv.`);

    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  if (command === "mock") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const result = runMock({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: scenarioOptionValue(),
      seed: optionValue("--seed") ?? "mockd-default",
      pricingConfig,
    });

    console.log(JSON.stringify({
      seed: result.seed,
      keeperScenario: {
        key: result.keeperScenario.key,
        label: result.keeperScenario.label,
        totalKeeperCost: result.keeperScenario.totalKeeperCost,
        openAuctionDollars: result.keeperScenario.openAuctionDollars,
        globalFactor: result.keeperScenario.globalFactor,
        positionFactors: result.keeperScenario.positionFactors,
      },
      economics: {
        marketAnchor: "Base or scenario-adjusted player price remains the market input.",
        salePrice: "Auction result price is resolved from owner-local max bids, need, historical owner demand, and scarcity pressure.",
        budgetRule: "$1 is held back for every unfilled roster slot; overspent owners are capped individually.",
        scarcityRule: "Comparable-player scarcity can push good players above anchor while full-budget owners are still bidding.",
      },
      inputCounts: {
        pricedPlayers: result.inputCounts.pricedPlayers,
        auctionPlayers: result.inputCounts.auctionPlayers,
        lockedKeepers: result.inputCounts.lockedKeepers,
      },
      pickCount: result.pickCount,
      firstPicks: result.picks.slice(0, 30),
      draftBoard: result.picks,
      budgetTrajectory: result.budgetTrajectory,
      rosters: result.rosters.map(roster => ({
        owner: roster.owner,
        spend: roster.spend,
        budgetRemaining: roster.budgetRemaining,
        week1Score: roster.week1Score,
        weeks1To4Score: roster.weeks1To4Score,
        valid: roster.valid,
        errors: roster.errors,
        players: roster.players.map(player => ({
          name: player.name,
          position: player.position,
          price: player.price,
          weeks1To4: player.weeks1To4,
        })),
      })),
      unsoldPlayerCount: result.unsoldPlayerCount,
    }, null, 2));
    return;
  }

  if (command === "mocks") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: scenarioListOptionValue(),
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
    });

    console.log(JSON.stringify({
      options: batch.options,
      summary: batch.summary,
      runCount: batch.runs.length,
    }, null, 2));
    return;
  }

  if (command === "strategy-lab") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const customScenarios = strategyLabScenariosFromOptions();
    const report = await runStrategyLab({
      projections: players,
      historicalRecords,
      keepers,
      ...(customScenarios === undefined ? {} : { scenarios: customScenarios }),
      scenarioKey: scenarioOptionValue(),
      runsPerScenario: numericOptionValue("--runs", 25),
      seedPrefix: optionValue("--seed-prefix") ?? "strategy-lab",
      pricingConfig,
    });
    const format = optionValue("--format") ?? "json";

    if (format === "markdown") {
      console.log(strategyLabReportMarkdown(report));
      return;
    }

    if (format !== "json") throw new Error(`Unknown strategy lab format "${format}". Use json or markdown.`);

    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "teams") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const scenarioKey = scenarioOptionValue();
    const owner = ownerOptionValue();
    const strategyKey = draftPlanStrategyOptionValue();
    const strategyMode = draftPlanStrategyModeOptionValue();
    const engineMode = draftPlanEngineModeOptionValue();
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario: numericOptionValue("--runs", 250),
      seedPrefix: optionValue("--seed-prefix") ?? "draft-plans",
      pricingConfig,
      auctionConfigOverrides: strategyMode === "force"
        ? draftPlanAuctionOverridesFor({ owner, strategyKey })
        : {},
      diagnosticsMode: engineMode === "fast" ? "summary" : "full",
    });
    const report = buildDraftPlanReport({
      batch,
      owner,
      strategyKey,
      limit: numericOptionValue("--limit", 5),
    });
    const format = optionValue("--format") ?? "json";

    if (format === "markdown") {
      console.log(draftPlanReportMarkdown(report));
      return;
    }

    if (format === "csv") {
      console.log(draftPlanReportCsv(report));
      return;
    }

    if (format !== "json") throw new Error(`Unknown teams format "${format}". Use json, markdown, or csv.`);

    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (command === "draft-ready") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const scenarioKey = scenarioOptionValue();
    const owner = ownerOptionValue();
    const strategyKey = draftPlanStrategyOptionValue();
    const strategyMode = draftPlanStrategyModeOptionValue();
    const engineMode = draftPlanEngineModeOptionValue();
    const runs = numericOptionValue("--runs", 50);
    const qaRuns = numericOptionValue("--qa-runs", 10);
    const seedPrefix = optionValue("--seed-prefix") ?? "draft-ready";
    const minimumMatches = numericOptionValue("--min-matches", Math.max(1, Math.ceil(runs * 0.2)));
    const qaSeedPrefix = `${seedPrefix}:qa`;
    const planSeedPrefix = `${seedPrefix}:plans`;
    const qaBatch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario: qaRuns,
      seedPrefix: qaSeedPrefix,
      pricingConfig,
    });
    const firstRun = qaBatch.runs[0];
    if (!firstRun) throw new Error("Draft readiness command did not produce a QA mock run.");
    const calibration = buildHistoricalCalibrationAudit({ historicalRecords, batch: qaBatch });
    const smokeReport = buildMockSmokeReport({ run: firstRun, batch: qaBatch, rounds: 2 });
    const historicalBacktest = buildHistoricalBacktest(historicalRecords);
    const sanityReport = buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey,
      limit: numericOptionValue("--evidence-limit", 40),
      seedPrefix: qaSeedPrefix,
      pricingConfig,
      mockBatch: qaBatch,
    });
    const evidenceCoverageAudit = buildPlayerEvidenceCoverageAudit(buildPlayerEvidenceQueue(sanityReport));
    const qaReport = buildQaReport({
      options: {
        scenarioKeys: [scenarioKey],
        runsPerScenario: qaRuns,
        seedPrefix: qaSeedPrefix,
      },
      smoke: smokeReport,
      calibration,
      backtest: historicalBacktest,
      evidenceCoverage: evidenceCoverageAudit,
    });
    const planBatch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario: runs,
      seedPrefix: planSeedPrefix,
      pricingConfig,
      auctionConfigOverrides: strategyMode === "force"
        ? draftPlanAuctionOverridesFor({ owner, strategyKey })
        : {},
      diagnosticsMode: engineMode === "fast" ? "summary" : "full",
    });
    const draftPlanReport = buildDraftPlanReport({
      batch: planBatch,
      owner,
      strategyKey,
      limit: numericOptionValue("--limit", 5),
    });
    const report = buildDraftReadyReport({
      options: {
        owner,
        strategyKey,
        strategyMode,
        scenarioKey,
        runs,
        qaRuns,
        seedPrefix,
        engineMode,
        minimumMatches,
      },
      dataCounts: {
        projections: players.length,
        historicalRecords: historicalRecords.length,
        keepers: keepers.length,
      },
      qaReport,
      draftPlanReport,
      planBatch,
    });

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.recommendedExitCode;
    return;
  }

  if (command === "smoke") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const scenarioKey = scenarioOptionValue();
    const seed = optionValue("--seed") ?? "smoke";
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario: numericOptionValue("--runs", 2),
      seedPrefix: seed,
      pricingConfig,
    });
    const run = batch.runs[0];
    if (!run) throw new Error("Smoke command did not produce a mock run.");

    console.log(JSON.stringify(buildMockSmokeReport({ run, batch, rounds: 2 }), null, 2));
    return;
  }

  if (command === "calibration") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: scenarioListOptionValue(),
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
    });

    console.log(JSON.stringify({
      options: batch.options,
      audit: buildHistoricalCalibrationAudit({ historicalRecords, batch }),
    }, null, 2));
    return;
  }

  if (command === "backtest") {
    const historicalRecords = await loadHistoricalAuctionRecords();

    console.log(JSON.stringify(buildHistoricalBacktest(historicalRecords), null, 2));
    return;
  }

  if (command === "qa") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const selectedScenarioKeys = scenarioListOptionValue();
    const evidenceScenarioKey = selectedScenarioKeys[0] ?? "expected";
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: selectedScenarioKeys,
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "qa",
      pricingConfig,
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });
    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("QA command did not produce a mock run.");
    const smokeReport = buildMockSmokeReport({ run: firstRun, batch, rounds: 2 });
    const historicalBacktest = buildHistoricalBacktest(historicalRecords);
    const sanityReport = buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: evidenceScenarioKey,
      limit: numericOptionValue("--evidence-limit", 40),
      seedPrefix: optionValue("--seed-prefix") ?? "qa",
      pricingConfig,
      mockBatch: batch,
    });
    const evidenceQueue = buildPlayerEvidenceQueue(sanityReport);
    const outlierQueue = buildPlayerOutlierReviewQueue(sanityReport);
    const evidenceCoverageAudit = buildPlayerEvidenceCoverageAudit(evidenceQueue);
    const keeperScenarioSensitivity = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: numericOptionValue("--scenario-sensitivity-limit", 60),
    });
    const outputDirectory = optionValue("--out");
    const artifacts = outputDirectory
      ? await writePrepOutputArtifacts({
        batch,
        audit,
        smokeReport,
        historicalBacktest,
        evidenceQueue,
        evidenceCoverageAudit,
        outlierQueue,
        keeperScenarioSensitivity,
        outputDirectory,
      })
      : [];
    const report = buildQaReport({
      options: batch.options,
      smoke: smokeReport,
      calibration: audit,
      backtest: historicalBacktest,
      evidenceCoverage: evidenceCoverageAudit,
      artifactPaths: artifacts.map(artifact => artifact.path),
    });

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.recommendedExitCode;
    return;
  }

  if (command === "outputs") {
    const pricingConfig = await pricingConfigFromOptions();
    const players = await loadCurrentProjections({ projectionPath });
    const historicalRecords = await loadHistoricalAuctionRecords();
    const selectedScenarioKeys = scenarioListOptionValue();
    const evidenceScenarioKey = selectedScenarioKeys[0] ?? "expected";
    const prices = buildBasePrices(players, historicalRecords, pricingConfig);
    const batch = runMockBatch({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKeys: selectedScenarioKeys,
      runsPerScenario: numericOptionValue("--runs", 50),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
    });
    const audit = buildHistoricalCalibrationAudit({ historicalRecords, batch });
    const firstRun = batch.runs[0];
    if (!firstRun) throw new Error("Outputs command did not produce a mock run.");
    const smokeReport = buildMockSmokeReport({ run: firstRun, batch, rounds: 2 });
    const historicalBacktest = buildHistoricalBacktest(historicalRecords);
    const sanityReport = buildTopPlayerSanityReport({
      projections: players,
      historicalRecords,
      keepers,
      scenarioKey: evidenceScenarioKey,
      limit: numericOptionValue("--evidence-limit", 40),
      seedPrefix: optionValue("--seed-prefix") ?? "mockd",
      pricingConfig,
      mockBatch: batch,
    });
    const evidenceQueue = buildPlayerEvidenceQueue(sanityReport);
    const outlierQueue = buildPlayerOutlierReviewQueue(sanityReport);
    const evidenceCoverageAudit = buildPlayerEvidenceCoverageAudit(evidenceQueue);
    const keeperScenarioSensitivity = buildKeeperScenarioSensitivityReport({
      prices,
      keepers,
      limit: numericOptionValue("--scenario-sensitivity-limit", 60),
    });
    const artifacts = await writePrepOutputArtifacts({
      batch,
      audit,
      smokeReport,
      historicalBacktest,
      evidenceQueue,
      evidenceCoverageAudit,
      outlierQueue,
      keeperScenarioSensitivity,
      outputDirectory: optionValue("--out") ?? "data/processed/mock-prep",
    });

    console.log(JSON.stringify({
      options: batch.options,
      outputDirectory: optionValue("--out") ?? "data/processed/mock-prep",
      files: artifacts.map(artifact => ({
        filename: artifact.filename,
        path: artifact.path,
      })),
    }, null, 2));
    return;
  }

  console.log("Usage: npm run keepers | npm run profiles | npm run rankings | npm run prices [-- --custom-weights --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run scenarios [-- --custom-weights --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run scenarios:sensitivity [-- --limit=60 --format=json|csv --custom-weights --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run validate | npm run audit -- --player=\"Drake London\" [--scenario=expected --runs=10 --seed-prefix=player-audit --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run sanity [-- --scenario=expected --limit=40 --runs=10 --seed-prefix=top-sanity --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run outliers:queue [-- --scenario=expected --limit=40 --runs=10 --format=json|csv --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run evidence:queue [-- --scenario=expected --limit=40 --runs=10 --format=json|csv --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run evidence:template [-- --scenario=expected --limit=40 --runs=10 --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run evidence:adapt -- --input=path.csv [--adapter=scored-local --format=csv|json] | npm run evidence:coverage [-- --scenario=expected --limit=40 --runs=10 --format=json|csv --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run mock [-- --scenario=expected --seed=mockd-default --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run smoke [-- --scenario=expected --runs=2 --seed=smoke --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run qa [-- --scenarios=expected --runs=50 --seed-prefix=qa --out=data/processed/mock-prep --evidence-limit=40 --scenario-sensitivity-limit=60 --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run mocks [-- --scenarios=expected --runs=50 --seed-prefix=mockd --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run strategy:lab [-- --scenario=expected --runs=25 --format=json|markdown --seed-prefix=strategy-lab --force=\"Puka Nacua:75\" --target=\"Breece Hall:42\" --build-around=\"Omarion Hampton:46-52:2\" --strategy=wr-heavy --label=\"Puka path\"] | npm run teams [-- --owner=Cam --strategy=three-rb --scenario=expected --runs=250 --strategy-mode=force --engine-mode=fast|full --format=json|markdown|csv --seed-prefix=draft-prep] | npm run draft:ready [-- --owner=Cam --strategy=three-rb --scenario=expected --runs=50 --qa-runs=10 --strategy-mode=force --engine-mode=fast|full --min-matches=10 --seed-prefix=draft-ready] | npm run calibration [-- --scenarios=expected --runs=50 --seed-prefix=mockd --player-context=path.csv --player-evidence=path.csv --no-default-evidence] | npm run backtest | npm run outputs [-- --scenarios=expected --runs=50 --seed-prefix=mockd --out=data/processed/mock-prep --evidence-limit=40 --scenario-sensitivity-limit=60 --player-context=path.csv --player-evidence=path.csv --no-default-evidence]");
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
