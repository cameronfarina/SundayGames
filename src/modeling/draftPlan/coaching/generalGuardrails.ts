import type {
  DraftPlanCandidate,
  DraftPlanRiskGuardrail,
} from "../contracts.js";
import { priceWindowText } from "../formatters.js";
import { average, roundToTwo } from "../numbers.js";
import { guardrailStatus } from "./guardrailStatus.js";

export const generalRiskGuardrailsFor = (
  candidates: readonly DraftPlanCandidate[],
): DraftPlanRiskGuardrail[] => {
  const rosterSpends = candidates.map(candidate => candidate.rosterSpend);
  const starterScores = candidates.map(candidate => candidate.weeks1To4Score);
  const dollarPlayerCounts = candidates.map(candidate =>
    candidate.players.filter(player => player.price <= 1).length
  );
  const spendMinimum = Math.min(...rosterSpends);
  const spendMaximum = Math.max(...rosterSpends);
  const scoreMinimum = Math.min(...starterScores);
  const scoreMaximum = Math.max(...starterScores);
  const averageDollarPlayers = roundToTwo(average(dollarPlayerCounts));

  return [
    {
      label: "Budget usage",
      status: guardrailStatus(spendMaximum > 200, spendMinimum < 185),
      detail: `Best sampled teams spent ${priceWindowText(spendMinimum, spendMaximum)}; leaving more than about $15 unused means the plan probably passed too many useful tiers.`,
    },
    {
      label: "Starter strength",
      status: guardrailStatus(scoreMinimum <= 0, scoreMaximum - scoreMinimum > 80),
      detail: `Best sampled teams landed in a ${scoreMinimum.toFixed(1)}-${scoreMaximum.toFixed(1)} Weeks 1-4 starter range.`,
    },
    {
      label: "Dollar-player exposure",
      status: guardrailStatus(averageDollarPlayers >= 11, averageDollarPlayers >= 9),
      detail: `Best sampled teams averaged ${averageDollarPlayers.toFixed(1)} $1 players; crossing 9 means the roster is leaning thin.`,
    },
  ];
};
