import type { BasePrice } from "../basePricing.js";
import type { KeeperScenario, ScenarioAdjustedPrice } from "../keeperInflation.js";
import type { ProjectionRanking } from "../projectionRankings.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { roundPrice } from "./numbers.js";
import { teamMetadataFor } from "./playerMetadata.js";

export const projectionPriceFor = (
  projection: ProjectionRanking,
  scenario: KeeperScenario,
): number => {
  const publicAnchor = projection.espnAuctionValue ?? 0;
  const scenarioFactor = scenario.positionFactors[projection.position];
  return roundPrice(Math.max(publicAnchor, 1) * scenarioFactor);
};

export const liveRecordFromPrice = (price: ScenarioAdjustedPrice): LiveDraftPlayerRecord => ({
  name: price.name,
  normalizedName: price.normalizedName,
  position: price.position,
  expectedPrice: price.scenarioPrice,
  week1: price.weeks[1] ?? 0,
  weeks1To4: price.weeks1To4,
  seasonProjection: price.seasonProjection ?? price.weeks1To4 * 4,
  source: "pricedPool",
  ...teamMetadataFor(price.proTeamId),
  projectionRank: price.projectionRank,
  ...(price.espnRank === undefined ? {} : { espnRank: price.espnRank }),
});

export const liveRecordFromProjection = (
  projection: ProjectionRanking,
  scenario: KeeperScenario,
): LiveDraftPlayerRecord => ({
  name: projection.name,
  normalizedName: projection.normalizedName,
  position: projection.position,
  expectedPrice: projectionPriceFor(projection, scenario),
  week1: projection.weeks[1] ?? 0,
  weeks1To4: projection.weeks1To4,
  seasonProjection: projection.seasonProjection ?? projection.weeks1To4 * 4,
  source: "projectionFallback",
  ...teamMetadataFor(projection.proTeamId),
  projectionRank: projection.projectionRank,
  ...(projection.espnRank === undefined ? {} : { espnRank: projection.espnRank }),
});

export const keeperProjectionFor = ({
  normalizedName,
  prices,
  projections,
}: {
  normalizedName: string;
  prices: readonly BasePrice[];
  projections: ReadonlyMap<string, ProjectionRanking>;
}): BasePrice | ProjectionRanking | undefined =>
  prices.find(price => price.normalizedName === normalizedName) ?? projections.get(normalizedName);
