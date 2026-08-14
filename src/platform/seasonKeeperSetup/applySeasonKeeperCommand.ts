import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { SaveLiveDraftRoomSetupInput } from "../liveDraftRoomSetups.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import type { ApplySeasonKeeperCommandInput } from "./contracts.js";
import { SeasonKeeperSetupError } from "./errors.js";
import {
  existingKeeperTeamName,
  initialRosterPlayerIdentity,
  sourceVersionWithKeepers,
} from "./identity.js";
import { validateResultingInitialRosters } from "./validateResultingInitialRosters.js";

export const applySeasonKeeperCommand = ({
  season,
  setup,
  preview,
  now = new Date(),
}: ApplySeasonKeeperCommandInput): SaveLiveDraftRoomSetupInput => {
  if (setup.seasonId !== season.id) {
    throw new SeasonKeeperSetupError(
      "keeper_season_mismatch",
      "Keeper setup does not belong to the selected league season.",
    );
  }
  if (!season.teams.some(team => team.id === preview.team.id)) {
    throw new SeasonKeeperSetupError(
      "keeper_team_missing",
      "Keeper team no longer belongs to this season.",
    );
  }

  const previewPlayerIdentity = canonicalPlayerIdentityKey(preview.player.name);
  const duplicate = setup.initialRosters.find(player =>
    initialRosterPlayerIdentity(player) === previewPlayerIdentity
      && !(player.source === "keeper" && player.teamId === preview.team.id)
  );
  if (duplicate !== undefined) {
    throw new SeasonKeeperSetupError(
      "keeper_player_conflict",
      `${preview.player.name} is already kept by ${existingKeeperTeamName(season, duplicate)}.`,
    );
  }

  const keeper: LiveDraftRoomInitialRosterPlayer = {
    teamId: preview.team.id,
    playerId: preview.player.id,
    playerName: preview.player.name,
    position: preview.player.position,
    price: preview.keeper.draftType === "auction" ? preview.keeper.auctionCostDollars : 0,
    ...(preview.keeper.draftType === "snake" ? { keeperRound: preview.keeper.keeperRound } : {}),
    expectedPrice: preview.player.expectedPrice,
    source: "keeper",
  };
  const initialRosters = [
    ...setup.initialRosters.filter(player => !(
      player.source === "keeper"
        && player.teamId === preview.team.id
        && initialRosterPlayerIdentity(player) === previewPlayerIdentity
    )),
    keeper,
  ];
  validateResultingInitialRosters(season, initialRosters, preview);

  return {
    seasonId: season.id,
    sourceVersion: sourceVersionWithKeepers(setup.sourceVersion),
    playerCatalog: setup.playerCatalog,
    initialRosters,
    updatedAt: now,
  };
};
