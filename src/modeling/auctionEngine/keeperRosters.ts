import type { Owner } from "../../../config/league.js";
import type { KeeperDeclaration, KeeperStatus } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { ProjectionRecord } from "../../projections.js";
import type { Player } from "../../types.js";
import { buildProjectionRankings } from "../projectionRankings.js";
import { InitialRostersByOwner } from "./configContracts.js";

export const projectionWeekOne = (projection: Pick<ProjectionRecord, "weeks">): number =>
  projection.weeks[1] ?? 0;

export const buildInitialRostersFromKeepers = (
  declarations: readonly KeeperDeclaration[],
  projections: readonly ProjectionRecord[],
  includedStatuses: readonly KeeperStatus[],
): InitialRostersByOwner => {
  const included = new Set<KeeperStatus>(includedStatuses);
  const projectionByName = new Map(
    buildProjectionRankings(projections).map(projection => [projection.normalizedName, projection]),
  );
  const rosters: Partial<Record<Owner, Player[]>> = {};

  for (const declaration of declarations) {
    if (!included.has(declaration.status)) continue;

    const normalizedName = normalizePlayerName(declaration.player);
    const projection = projectionByName.get(normalizedName);
    const playerId = projection?.id ?? `keeper:${normalizedName}`;
    const keeperPlayer: Player = {
      id: playerId,
      name: projection?.name ?? declaration.player,
      position: declaration.position,
      ...(projection?.proTeamId === undefined ? {} : { proTeamId: projection.proTeamId }),
      price: declaration.newCost,
      week1: projection ? projectionWeekOne(projection) : 0,
      weeks1To4: projection?.weeks1To4 ?? 0,
      ...(projection?.seasonProjection === undefined ? {} : { seasonProjection: projection.seasonProjection }),
    };

    rosters[declaration.owner] = [...(rosters[declaration.owner] ?? []), keeperPlayer];
  }

  return rosters;
};
