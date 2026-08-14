import type { KeeperDeclaration } from "../../../config/keepers.js";
import { ownerOrder } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../../projections.js";
import type { BasePrice } from "../basePricing.js";
import type { KeeperScenario } from "../keeperInflation.js";
import { buildProjectionRankings, type ProjectionRanking } from "../projectionRankings.js";
import type { LiveDraftKeeperTarget } from "./contracts.js";
import { roundPrice, roundToTwo } from "./numbers.js";
import { keeperProjectionFor, projectionPriceFor } from "./playerRecords.js";
import { teamMetadataFor } from "./playerMetadata.js";

const keeperTargetFromDeclaration = ({
  keeper,
  projection,
  scenario,
}: {
  keeper: KeeperDeclaration;
  projection: BasePrice | ProjectionRanking | undefined;
  scenario: KeeperScenario;
}): LiveDraftKeeperTarget => {
  const expectedPrice = projection
    ? "price" in projection
      ? roundPrice(projection.price * scenario.positionFactors[keeper.position])
      : projectionPriceFor(projection, scenario)
    : keeper.newCost;
  const weeks1To4 = projection?.weeks1To4 ?? 0;
  return {
    name: projection?.name ?? keeper.player,
    position: keeper.position,
    ...teamMetadataFor(projection?.proTeamId),
    keeperOwner: keeper.owner,
    keeperCost: keeper.newCost,
    keeperStatus: keeper.status,
    draftable: false,
    expectedPrice,
    liveExpectedPrice: expectedPrice,
    personalValue: keeper.newCost,
    recommendedMaxBid: 0,
    valueScore: 0,
    week1Projection: roundToTwo(projection?.weeks[1] ?? 0),
    weeks1To4: roundToTwo(weeks1To4),
    seasonProjection: roundToTwo(projection?.seasonProjection ?? weeks1To4 * 4),
    ...(projection?.projectionRank === undefined ? {} : { projectionRank: projection.projectionRank }),
    ...(projection?.espnRank === undefined ? {} : { espnRank: projection.espnRank }),
    tags: [`keeper - ${keeper.owner}`, `${keeper.status} keeper`],
  };
};

export const buildKeeperTargets = ({
  keepers,
  prices,
  projections,
  scenario,
}: {
  keepers: readonly KeeperDeclaration[];
  prices: readonly BasePrice[];
  projections: readonly ProjectionRecord[];
  scenario: KeeperScenario;
}): LiveDraftKeeperTarget[] => {
  const rankingsByName = new Map(
    buildProjectionRankings(projections).map(projection => [projection.normalizedName, projection]),
  );
  return keepers
    .map(keeper => keeperTargetFromDeclaration({
      keeper,
      projection: keeperProjectionFor({
        normalizedName: normalizePlayerName(keeper.player),
        prices,
        projections: rankingsByName,
      }),
      scenario,
    }))
    .sort((left, right) =>
      ownerOrder.indexOf(left.keeperOwner) - ownerOrder.indexOf(right.keeperOwner)
      || left.name.localeCompare(right.name));
};
