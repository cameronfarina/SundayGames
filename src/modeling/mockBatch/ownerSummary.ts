import { ownerOrder, positions } from "../../../config/league.js";
import type { MockRun, OwnerBatchSummary } from "./contracts.js";
import { average, roundToTwo } from "./math.js";
import { emptyPositionAmounts } from "./positionAmounts.js";

export const summarizeOwners = (runs: readonly MockRun[]): OwnerBatchSummary[] =>
  ownerOrder.map(owner => {
    const rosters = runs.flatMap(run => run.rosters).filter(roster => roster.owner === owner);
    const positionSpend = emptyPositionAmounts();

    for (const position of positions) {
      positionSpend[position] = roundToTwo(
        average(rosters.map(roster => roster.positionSpend[position])),
      );
    }

    return {
      owner,
      runCount: rosters.length,
      invalidRosterCount: rosters.filter(roster => !roster.valid).length,
      averageSpend: roundToTwo(average(rosters.map(roster => roster.spend))),
      minimumSpend: Math.min(...rosters.map(roster => roster.spend)),
      maximumSpend: Math.max(...rosters.map(roster => roster.spend)),
      averageWeek1Score: roundToTwo(average(rosters.map(roster => roster.week1Score ?? 0))),
      averageWeeks1To4Score: roundToTwo(
        average(rosters.map(roster => roster.weeks1To4Score ?? 0)),
      ),
      averageBudgetRemaining: roundToTwo(
        average(rosters.map(roster => roster.budgetRemaining)),
      ),
      averagePositionSpend: positionSpend,
    };
  });
