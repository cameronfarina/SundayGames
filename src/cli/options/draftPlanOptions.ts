import type { DraftPlanStrategyKey } from "../../modeling/draftPlan.js";
import type { CliArguments } from "../arguments.js";

export type DraftPlanStrategyMode = "filter" | "force";
export type DraftPlanEngineMode = "fast" | "full";

const strategyKey = (value: string): DraftPlanStrategyKey | undefined => {
  if (value === "balanced") return value;
  if (value === "three-rb") return value;
  if (value === "hero-rb") return value;
  if (value === "wr-heavy") return value;
  return undefined;
};

export const draftPlanStrategyOption = (arguments_: CliArguments): DraftPlanStrategyKey => {
  const value = arguments_.option("--strategy") ?? "three-rb";
  const strategy = strategyKey(value);
  if (!strategy) {
    throw new Error(`Unknown draft plan strategy "${value}". Use balanced, three-rb, hero-rb, or wr-heavy.`);
  }
  return strategy;
};

export const draftPlanStrategyModeOption = (arguments_: CliArguments): DraftPlanStrategyMode => {
  const value = arguments_.option("--strategy-mode") ?? "force";
  if (value === "filter" || value === "force") return value;
  throw new Error(`Unknown draft plan strategy mode "${value}". Use filter or force.`);
};

export const draftPlanEngineModeOption = (arguments_: CliArguments): DraftPlanEngineMode => {
  const value = arguments_.option("--engine-mode") ?? "fast";
  if (value === "fast" || value === "full") return value;
  throw new Error(`Unknown draft plan engine mode "${value}". Use fast or full.`);
};
