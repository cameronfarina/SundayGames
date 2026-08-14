import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomSetup, SaveLiveDraftRoomSetupInput } from "../liveDraftRoomSetups.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import { sourceVersionWithKeepers } from "./identity.js";

export const listSeasonKeepers = (
  setup: Pick<LiveDraftRoomSetup | SaveLiveDraftRoomSetupInput, "initialRosters">,
): readonly LiveDraftRoomInitialRosterPlayer[] =>
  setup.initialRosters.filter(player => player.source === "keeper");

export const removeSeasonKeeper = (
  setup: LiveDraftRoomSetup | SaveLiveDraftRoomSetupInput,
  input: { teamId: string; playerId: string; now?: Date | undefined },
): SaveLiveDraftRoomSetupInput => ({
  seasonId: setup.seasonId,
  sourceVersion: sourceVersionWithKeepers(setup.sourceVersion),
  playerCatalog: setup.playerCatalog,
  initialRosters: setup.initialRosters.filter(player => !(
    player.source === "keeper"
      && player.teamId === input.teamId
      && (player.playerId ?? canonicalPlayerIdentityKey(player.playerName)) === input.playerId
  )),
  updatedAt: input.now ?? new Date(),
});
