import { ownerOrder, primaryOwner, type Owner } from "../../../config/league.js";
import type { KeeperScenarioKey } from "../../modeling/keeperInflation.js";
import type { CliArguments } from "../arguments.js";

const keeperScenarioKey = (value: string): KeeperScenarioKey | undefined => {
  if (value === "confirmedOnly") return value;
  if (value === "expected") return value;
  if (value === "highRetention") return value;
  return undefined;
};

export const scenarioOption = (
  arguments_: CliArguments,
  name = "--scenario",
): KeeperScenarioKey => {
  const value = arguments_.option(name) ?? "expected";
  const scenario = keeperScenarioKey(value);
  if (!scenario) {
    throw new Error(`Unknown keeper scenario "${value}". Use confirmedOnly, expected, or highRetention.`);
  }
  return scenario;
};

export const scenarioListOption = (arguments_: CliArguments): KeeperScenarioKey[] => {
  const value = arguments_.option("--scenarios");
  if (!value) return ["expected"];

  return value.split(",").map(key => {
    const scenario = keeperScenarioKey(key);
    if (!scenario) {
      throw new Error(`Unknown keeper scenario "${key}". Use confirmedOnly, expected, or highRetention.`);
    }
    return scenario;
  });
};

export const ownerOption = (arguments_: CliArguments): Owner => {
  const value = arguments_.option("--owner") ?? primaryOwner;
  const owner = ownerOrder.find(candidate => candidate === value);
  if (!owner) throw new Error(`Unknown owner "${value}". Use one of: ${ownerOrder.join(", ")}.`);
  return owner;
};
