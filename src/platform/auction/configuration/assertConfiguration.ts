import type { GenericAuctionMockConfig } from "../types.js";
import { assertAiConfiguration } from "./ai.js";
import { assertCoreConfiguration } from "./core.js";
import { assertPlannedAcquisitions } from "./plannedAcquisitions.js";
import { assertPlayers, playerIdsFor } from "./players.js";
import { assertPositionCoverage, assertPositionMaximums } from "./positions.js";
import { assertRosterConfiguration } from "./roster.js";
import { assertTeamTendencies } from "./teamTendencies.js";

export const assertConfiguration = (config: GenericAuctionMockConfig): void => {
  assertCoreConfiguration(config);
  assertRosterConfiguration(config);
  assertPositionMaximums(config);
  assertPlayers(config);
  assertPositionCoverage(config);

  const playerIds = playerIdsFor(config);
  assertAiConfiguration(config, playerIds);
  assertPlannedAcquisitions(config, playerIds);
  assertTeamTendencies(config);
};
