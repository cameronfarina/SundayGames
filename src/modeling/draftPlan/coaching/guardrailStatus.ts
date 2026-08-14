import type { DraftPlanRiskStatus } from "../contracts.js";

export const guardrailStatus = (
  failed: boolean,
  warned: boolean,
): DraftPlanRiskStatus => {
  if (failed) return "fail";
  if (warned) return "warn";
  return "pass";
};
