import type { PricingConfig } from "../../modeling/basePricing.js";
import { buildPricingConfigFromSources, playerEvidencePathFor } from "../../pricingConfig.js";
import type { CliArguments } from "../arguments.js";

export const playerEvidencePathOption = (arguments_: CliArguments): string | undefined => {
  const explicitEvidencePath = arguments_.option("--player-evidence");
  return playerEvidencePathFor({
    ...(explicitEvidencePath === undefined ? {} : { playerEvidencePath: explicitEvidencePath }),
    useDefaultEvidence: !arguments_.has("--no-default-evidence"),
  });
};

export const pricingConfigOption = async (arguments_: CliArguments): Promise<PricingConfig> => {
  const importPath = arguments_.option("--player-context");
  const evidencePath = playerEvidencePathOption(arguments_);
  return buildPricingConfigFromSources({
    customWeights: arguments_.has("--custom-weights"),
    ...(importPath === undefined ? {} : { playerContextPath: importPath }),
    ...(evidencePath === undefined ? {} : { playerEvidencePath: evidencePath }),
    useDefaultEvidence: !arguments_.has("--no-default-evidence"),
  });
};

export const playerContextSummary = (
  config: PricingConfig,
  importPath?: string,
  evidencePath?: string,
) => ({
  enabled: config.playerContext.enabled,
  weights: config.playerContext.weights,
  maxAdjustment: config.playerContext.maxAdjustment,
  maxPositiveAdjustment: config.playerContext.maxPositiveAdjustment ?? config.playerContext.maxAdjustment,
  maxNegativeAdjustment: config.playerContext.maxNegativeAdjustment ?? config.playerContext.maxAdjustment,
  overrideCount: config.playerContext.overrides.length,
  ...(importPath ? { importPath } : {}),
  ...(evidencePath ? { evidencePath } : {}),
});
