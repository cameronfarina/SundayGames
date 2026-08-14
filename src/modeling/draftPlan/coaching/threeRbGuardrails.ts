import type {
  DraftPlanCandidate,
  DraftPlanRiskGuardrail,
} from "../contracts.js";
import { priceWindowText } from "../formatters.js";
import { average, roundToTwo } from "../numbers.js";
import { playerAtPosition } from "../players.js";
import { threeRbPathRules } from "../threeRbPathRules.js";
import { guardrailStatus } from "./guardrailStatus.js";

export const threeRbRiskGuardrailsFor = (
  candidates: readonly DraftPlanCandidate[],
): DraftPlanRiskGuardrail[] => {
  const rbCoreSpends = candidates.map(candidate => candidate.rbCoreSpend);
  const wrStarterSpends = candidates.map(candidate =>
    (playerAtPosition(candidate, "WR", 0)?.price ?? 0) +
    (playerAtPosition(candidate, "WR", 1)?.price ?? 0)
  );
  const dollarPlayerCounts = candidates.map(candidate =>
    candidate.players.filter(player => player.price <= 1).length
  );
  const rbMinimum = Math.min(...rbCoreSpends);
  const rbMaximum = Math.max(...rbCoreSpends);
  const wrMinimum = Math.min(...wrStarterSpends);
  const wrMaximum = Math.max(...wrStarterSpends);
  const averageDollarPlayers = roundToTwo(average(dollarPlayerCounts));

  return [
    {
      label: "RB core spend",
      status: guardrailStatus(
        rbMinimum > threeRbPathRules.rbCoreBudget.hardBudget,
        rbMaximum > threeRbPathRules.rbCoreBudget.hardBudget,
      ),
      detail: `Best sampled teams spent ${priceWindowText(rbMinimum, rbMaximum)} on the three-RB core; ${priceWindowText(threeRbPathRules.rbCoreBudget.minimumSpend, threeRbPathRules.rbCoreBudget.hardBudget)} is the planned lane.`,
    },
    {
      label: "WR starter pocket",
      status: guardrailStatus(wrMinimum === 0, wrMaximum > 50),
      detail: `Best sampled teams reserved ${priceWindowText(wrMinimum, wrMaximum)} for the top two WR slots instead of buying one receiver at any price.`,
    },
    {
      label: "Dollar-player exposure",
      status: guardrailStatus(averageDollarPlayers >= 11, averageDollarPlayers >= 9),
      detail: `Best sampled teams averaged ${averageDollarPlayers.toFixed(1)} $1 players; crossing 9 means the roster is leaning thin.`,
    },
  ];
};
