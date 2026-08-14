import type {
  DraftPlanCandidate,
  DraftPlanRiskGuardrail,
  DraftPlanStrategyDefinition,
} from "../contracts.js";
import { generalRiskGuardrailsFor } from "./generalGuardrails.js";
import { threeRbRiskGuardrailsFor } from "./threeRbGuardrails.js";

export const riskGuardrailsFor = (
  candidates: readonly DraftPlanCandidate[],
  strategy: DraftPlanStrategyDefinition,
): DraftPlanRiskGuardrail[] => {
  if (candidates.length === 0) {
    return [{
      label: "Strategy sample",
      status: "fail",
      detail: "No sampled roster reached the requested strategy shape; do not treat this path as live-ready yet.",
    }];
  }
  return strategy.key === "three-rb"
    ? threeRbRiskGuardrailsFor(candidates)
    : generalRiskGuardrailsFor(candidates);
};
