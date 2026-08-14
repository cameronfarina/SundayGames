import type {
  PlayerPriceSnapshotRow,
  PricingSnapshot,
  PricingSourcePrice,
} from "./contracts.js";
import { slugify } from "./slug.js";

type SnapshotReference = Pick<
  PricingSnapshot,
  "modelRunId" | "modelVersion" | "scenarioId" | "inputSnapshot"
>;

export const rowFromSourcePrice = (
  sourcePrice: PricingSourcePrice,
  snapshot: SnapshotReference,
): PlayerPriceSnapshotRow => {
  const scenarioPrice = sourcePrice.scenarioPrice ?? sourcePrice.price;
  const livePrice = sourcePrice.livePrice ?? sourcePrice.liveExpectedPrice ?? scenarioPrice;
  const personalValue = sourcePrice.personalValue ?? livePrice;
  const recommendedMaxBid = sourcePrice.recommendedMaxBid ?? personalValue;
  const playerKey = slugify(sourcePrice.normalizedName);

  return {
    playerKey,
    playerName: sourcePrice.name,
    normalizedName: sourcePrice.normalizedName,
    position: sourcePrice.position,
    marketPrice: sourcePrice.price,
    scenarioPrice,
    livePrice,
    personalValue,
    recommendedMaxBid,
    warnings: [...(sourcePrice.warnings ?? [])],
    explanationRef: {
      modelRunId: snapshot.modelRunId,
      modelVersion: snapshot.modelVersion,
      scenarioId: snapshot.scenarioId,
      inputSnapshotId: snapshot.inputSnapshot.id,
      playerKey,
    },
    ...(sourcePrice.confidence === undefined ? {} : { confidence: sourcePrice.confidence }),
    ...(sourcePrice.tier === undefined ? {} : { tier: sourcePrice.tier }),
  };
};
