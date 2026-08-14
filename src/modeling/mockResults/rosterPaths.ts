import type { MockResultsRosterPath } from "./analyticsContracts.js";
import { average, roundToTwo } from "./formatting.js";
import type { MockResultsRun } from "./reportContracts.js";
import type { MockResultsCamOutcome } from "./teamContracts.js";

interface RosterPathGroup {
  corePlayers: string[];
  outcomes: MockResultsCamOutcome[];
}

export const topCamRosterPathsFor = (runs: readonly MockResultsRun[]): MockResultsRosterPath[] => {
  const pathGroups = new Map<string, RosterPathGroup>();

  for (const run of runs) {
    const corePlayers = run.camOutcome.corePlayers;
    const path = corePlayers.join(" / ");
    const group = pathGroups.get(path) ?? { corePlayers, outcomes: [] };
    group.outcomes.push(run.camOutcome);
    pathGroups.set(path, group);
  }

  return [...pathGroups.entries()]
    .map(([path, group]) => ({
      path,
      corePlayers: group.corePlayers,
      count: group.outcomes.length,
      draftedRate: roundToTwo(group.outcomes.length / runs.length),
      averageWeek1Score: roundToTwo(average(group.outcomes.map(outcome => outcome.week1Score))),
      averageWeeks1To4Score: roundToTwo(average(group.outcomes.map(outcome => outcome.weeks1To4Score))),
      averageRank: roundToTwo(average(group.outcomes.map(outcome => outcome.rank))),
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.averageRank - right.averageRank ||
        right.averageWeeks1To4Score - left.averageWeeks1To4Score ||
        left.path.localeCompare(right.path),
    )
    .slice(0, 8);
};
