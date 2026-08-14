import { moneyText } from "./math.js";
import {
  forcedStartMarkdown,
  sampleBenchMarkdown,
  sampleMarkdown,
  sampleStartersMarkdown,
  targetMaxBidsMarkdown,
  targetOutcomesMarkdown,
} from "./markdownFragments.js";
import type { StrategyLabReport } from "./reportContracts.js";

export const strategyLabReportMarkdown = (report: StrategyLabReport): string => {
  const lines = [
    "# Primary Team Strategy Lab",
    "",
    `Runs per scenario: ${report.options.runsPerScenario}`,
    "",
    "## Leaderboard",
    "| Scenario | Avg rank | Best | Worst | Week 1 | Season strength | Thinness |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.leaderboard.map(row =>
      `| ${row.label} | ${row.averageCamRank.toFixed(2)} | ${row.bestCamRank} | ${row.worstCamRank} | ${row.averageCamWeek1Score.toFixed(1)} | ${row.averageCamSeasonStrengthScore.toFixed(1)} | ${row.averageThinnessScore.toFixed(1)} |`,
    ),
  ];

  for (const scenario of report.scenarios) {
    const bestSample = scenario.sampleBuilds[0];
    lines.push(
      "",
      `## ${scenario.label}`,
      scenario.question,
      `Strategy lens: ${scenario.strategyKey}`,
      `Forced start: ${forcedStartMarkdown(scenario.camForcedStart)}`,
      ...(scenario.targetMaxBids.length === 0
        ? []
        : [`Target caps: ${targetMaxBidsMarkdown(scenario.targetMaxBids)}`]),
      ...(scenario.targetOutcomes.length === 0
        ? []
        : [`Target outcomes: ${targetOutcomesMarkdown(scenario.targetOutcomes)}`]),
      `Budget after forced start: ${moneyText(scenario.camForcedStart.budgetRemaining)}, max bid ${moneyText(scenario.camForcedStart.maxBid)}, slots left ${scenario.camForcedStart.slotsRemaining}`,
      `Average: rank ${scenario.averageCamRank.toFixed(2)}, Week 1 ${scenario.averageCamWeek1Score.toFixed(1)}, season strength ${scenario.averageCamSeasonStrengthScore.toFixed(1)}, bench W1 ${scenario.averageCamBenchWeek1Score.toFixed(1)}, dollar players ${scenario.averageCamDollarPlayers.toFixed(1)}`,
      bestSample ? sampleMarkdown(bestSample) : "Best sample unavailable.",
      bestSample ? `Starters: ${sampleStartersMarkdown(bestSample)}` : "Starters unavailable.",
      bestSample ? `Bench: ${sampleBenchMarkdown(bestSample)}` : "Bench unavailable.",
    );
  }

  return lines.join("\n");
};
