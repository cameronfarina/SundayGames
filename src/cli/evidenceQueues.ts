import { keepers } from "../../config/keepers.js";
import { buildPlayerEvidenceQueue, type PlayerEvidenceQueue } from "../modeling/playerEvidenceQueue.js";
import {
  buildPlayerOutlierReviewQueue,
  type PlayerOutlierReviewQueue,
} from "../modeling/playerOutlierReviewQueue.js";
import { buildTopPlayerSanityReport } from "../modeling/topPlayerSanity.js";
import type { CliArguments } from "./arguments.js";
import { loadPricingInputs } from "./inputs.js";
import { scenarioOption } from "./options/commonOptions.js";

const sanityReport = async (arguments_: CliArguments, defaultSeedPrefix: string) => {
  const { pricingConfig, players, historicalRecords } = await loadPricingInputs(arguments_);
  return buildTopPlayerSanityReport({
    projections: players,
    historicalRecords,
    keepers,
    scenarioKey: scenarioOption(arguments_),
    limit: arguments_.positiveInteger("--limit", 40),
    runs: arguments_.positiveInteger("--runs", 10),
    seedPrefix: arguments_.option("--seed-prefix") ?? defaultSeedPrefix,
    pricingConfig,
  });
};

export const playerEvidenceQueue = async (
  arguments_: CliArguments,
  defaultSeedPrefix: string,
): Promise<PlayerEvidenceQueue> => buildPlayerEvidenceQueue(
  await sanityReport(arguments_, defaultSeedPrefix),
);

export const playerOutlierQueue = async (
  arguments_: CliArguments,
  defaultSeedPrefix: string,
): Promise<PlayerOutlierReviewQueue> => buildPlayerOutlierReviewQueue(
  await sanityReport(arguments_, defaultSeedPrefix),
);
