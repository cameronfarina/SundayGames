import type {
  CreatePricingSnapshotInput,
  PricingSnapshot,
} from "./contracts.js";
import { generatePricingModelRunId } from "./modelRunIdentity.js";
import { rowFromSourcePrice } from "./rowFactory.js";
import { slugify } from "./slug.js";

export const createPricingSnapshot = ({
  leagueId,
  seasonYear,
  modelVersion,
  scenarioId,
  inputSnapshot,
  prices,
  createdAt,
}: CreatePricingSnapshotInput): PricingSnapshot => {
  const modelRunId = generatePricingModelRunId({
    leagueId,
    seasonYear,
    modelVersion,
    inputHash: inputSnapshot.hash,
  });
  const snapshotRef = { modelRunId, modelVersion, scenarioId, inputSnapshot };

  return {
    snapshotId: `pricing-snapshot:${modelRunId}:${slugify(scenarioId)}`,
    modelRunId,
    leagueId,
    seasonYear,
    modelVersion,
    scenarioId,
    inputSnapshot,
    rows: prices.map(price => rowFromSourcePrice(price, snapshotRef)),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
};
