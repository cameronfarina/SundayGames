import type { PlayerBatchSummary } from "../../mockBatch.js";
import type {
  DraftPlanCandidate,
  DraftPlanSlotBlueprint,
  DraftPlanStrategyCoach,
  DraftPlanStrategyDefinition,
} from "../contracts.js";
import { average, roundToTwo } from "../numbers.js";
import { slotBlueprintFor } from "./blueprint.js";
import { contingencyPlansFor } from "./contingencies.js";
import { coachSlotDefinitions, topCoachCandidates } from "./definitions.js";
import { riskGuardrailsFor } from "./riskGuardrails.js";

const presentBlueprint = (
  blueprint: DraftPlanSlotBlueprint | undefined,
): blueprint is DraftPlanSlotBlueprint => blueprint !== undefined;

export const strategyCoachFor = (
  candidates: readonly DraftPlanCandidate[],
  marketPlayers: readonly PlayerBatchSummary[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanStrategyCoach => {
  const coachCandidates = topCoachCandidates(candidates);
  const blueprint = coachSlotDefinitions
    .map(definition => slotBlueprintFor(definition, coachCandidates, marketPlayers, strategy))
    .filter(presentBlueprint);
  const averageWeeks1To4Score = roundToTwo(
    average(coachCandidates.map(candidate => candidate.weeks1To4Score)),
  );
  return {
    headline: coachCandidates.length
      ? `Top ${coachCandidates.length} sampled ${strategy.label} ${coachCandidates.length === 1 ? "build" : "builds"} averaged ${averageWeeks1To4Score.toFixed(1)} Weeks 1-4 points. Use the bands as guardrails, not guarantees.`
      : "No winning roster blueprint yet; run more mocks or loosen the strategy filters.",
    sampleSize: coachCandidates.length,
    averageWeeks1To4Score,
    blueprint,
    contingencyPlans: contingencyPlansFor(blueprint),
    riskGuardrails: riskGuardrailsFor(coachCandidates, strategy),
  };
};
