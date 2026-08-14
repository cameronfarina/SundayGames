import type { DraftPlanPlayer, DraftPlanReport } from "../../modeling/draftPlan.js";

const marketBand = (player: DraftPlanPlayer): string => player.market
  ? `, avg $${player.market.averageSalePrice}, range $${player.market.minimumSalePrice}-$${player.market.maximumSalePrice}`
  : "";

const playerMarkdown = (player: DraftPlanPlayer): string =>
  `${player.position} ${player.name} $${player.price}${marketBand(player)}`;

const priceBandMarkdown = (
  band: DraftPlanReport["recommendations"]["maxPriceBands"][number],
): string => `${band.slot} $${band.minimumPrice}-$${band.maximumPrice}`;

const blueprintMarkdown = (
  blueprint: DraftPlanReport["recommendations"]["strategyCoach"]["blueprint"][number],
): string => {
  const lockedNames = blueprint.lockedNames.map(name => `${name} locked`);
  const names = [...lockedNames, ...blueprint.targetNames].join(" / ");
  const fallbacks = blueprint.fallbackNames.length
    ? `; fallback ${blueprint.fallbackPriceBand}: ${blueprint.fallbackNames.join(" / ")}`
    : "";
  return `${blueprint.slot} ${blueprint.priceBand}: ${names || "no recurring targets"}${fallbacks}`;
};

const reportHeader = (report: DraftPlanReport): string[] => {
  const coach = report.recommendations.strategyCoach;
  return [
    `# ${report.owner} ${report.strategy.label} Draft Plans`,
    "",
    `Engine: ${report.engineMode}`,
    `Runs: ${report.runCount}`,
    `Matches: ${report.matchedRunCount}`,
    `Thresholds: RB1 $${report.strategy.thresholds.rb1Minimum}+, RB2 $${report.strategy.thresholds.rb2Minimum}+, RB3 $${report.strategy.thresholds.rb3Minimum}+, core $${report.strategy.thresholds.rbCoreSpendMinimum}+`,
    "",
    "## Path Recommendations",
    `Max bands: ${report.recommendations.maxPriceBands.map(priceBandMarkdown).join(" | ")}`,
    `Targets: ${report.recommendations.targetClusters.map(cluster => `${cluster.label} ${cluster.priceBand}`).join(" | ") || "none"}`,
    `Pivots: ${report.recommendations.pivotRules.map(rule => `${rule.label} - ${rule.action}`).join(" | ") || "none"}`,
    `Dead zones: ${report.recommendations.deadZoneWarnings.join(" | ") || "none"}`,
    "",
    "## Strategy Coach",
    coach.headline,
    `Blueprint: ${coach.blueprint.map(blueprintMarkdown).join(" | ") || "none"}`,
    `Contingencies: ${coach.contingencyPlans.map(plan => `${plan.label} - ${plan.action}`).join(" | ") || "none"}`,
    `Risk guardrails: ${coach.riskGuardrails.map(guardrail => `${guardrail.label} (${guardrail.status}) - ${guardrail.detail}`).join(" | ") || "none"}`,
  ];
};

export const draftPlanReportMarkdown = (report: DraftPlanReport): string => {
  const lines = reportHeader(report);
  for (const [index, candidate] of report.candidates.entries()) {
    lines.push(
      "",
      `## ${index + 1}. ${candidate.seed}`,
      `Spend: $${candidate.rosterSpend}, left: $${candidate.budgetRemaining}, RB core: $${candidate.rbCoreSpend}, Weeks 1-4: ${candidate.weeks1To4Score}`,
      `RB core: ${candidate.rbCore.map(playerMarkdown).join(" | ")}`,
      "Starters:",
      ...candidate.lineup.map(entry => `- ${entry.slot}: ${playerMarkdown(entry.player)}`),
      "Bench:",
      ...candidate.bench.map(player => `- ${playerMarkdown(player)}`),
    );
  }
  if (report.candidates.length === 0) {
    lines.push("", "No matching draft plans found for this owner/strategy/run sample.");
  }
  return lines.join("\n");
};
