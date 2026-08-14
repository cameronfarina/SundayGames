import type { DraftRoomRanking } from "../../data/draftRoomRankings.js";
import type { ProjectionRecord } from "../../projections.js";
import type { KeeperScenario, ScenarioAdjustedPrice } from "../keeperInflation.js";
import { buildProjectionRankings } from "../projectionRankings.js";
import type { LiveDraftPlayerRecord } from "./internalTypes.js";
import { liveRecordFromPrice, liveRecordFromProjection } from "./playerRecords.js";

const withDraftRoomRank = (
  record: LiveDraftPlayerRecord,
  draftRoomRank: DraftRoomRanking | undefined,
): LiveDraftPlayerRecord => draftRoomRank ? { ...record, draftRoomRank } : record;

export const buildLivePlayerUniverse = ({
  projections,
  prices,
  scenario,
  unavailableKeeperNames,
  draftRoomRankingsByName,
}: {
  projections: readonly ProjectionRecord[];
  prices: readonly ScenarioAdjustedPrice[];
  scenario: KeeperScenario;
  unavailableKeeperNames: ReadonlySet<string>;
  draftRoomRankingsByName: ReadonlyMap<string, DraftRoomRanking>;
}): LiveDraftPlayerRecord[] => {
  const recordsByName = new Map<string, LiveDraftPlayerRecord>();
  for (const price of prices) {
    recordsByName.set(price.normalizedName, withDraftRoomRank(
      liveRecordFromPrice(price),
      draftRoomRankingsByName.get(price.normalizedName),
    ));
  }
  for (const projection of buildProjectionRankings(projections)) {
    if (recordsByName.has(projection.normalizedName)) continue;
    if (unavailableKeeperNames.has(projection.normalizedName)) continue;
    recordsByName.set(projection.normalizedName, withDraftRoomRank(
      liveRecordFromProjection(projection, scenario),
      draftRoomRankingsByName.get(projection.normalizedName),
    ));
  }
  return [...recordsByName.values()];
};
