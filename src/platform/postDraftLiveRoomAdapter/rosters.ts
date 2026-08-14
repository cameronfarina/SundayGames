import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoom } from "../liveDraftRooms.js";
import type {
  PostDraftProjection,
  PostDraftProjectionSnapshot,
  PostDraftRosterPlayer,
  PostDraftTeamRoster,
} from "../postDraftTeamAnalysis.js";
import { PostDraftLiveRoomAdapterError } from "./errors.js";

export interface LiveRoomRosters {
  teams: readonly PostDraftTeamRoster[];
  roster: PostDraftTeamRoster;
  freeAgentPlayers: readonly PostDraftRosterPlayer[];
}

const projectionMap = (
  snapshot: PostDraftProjectionSnapshot,
): ReadonlyMap<string, PostDraftProjection> => new Map(
  snapshot.projections.map(projection => [
    canonicalPlayerIdentityKey(projection.playerName),
    projection,
  ]),
);

const rosterPlayer = (
  player: { name: string; position: PostDraftRosterPlayer["position"] },
  projections: ReadonlyMap<string, PostDraftProjection>,
): PostDraftRosterPlayer => {
  const identity = canonicalPlayerIdentityKey(player.name);
  const projection = projections.get(identity);
  return {
    playerId: projection?.position === player.position
      ? projection.playerId
      : `draft-player:${identity}`,
    playerName: player.name,
    position: player.position,
  };
};

export const buildLiveRoomRosters = (
  room: LiveDraftRoom,
  snapshot: PostDraftProjectionSnapshot,
  teamId: string,
  ownerId: string,
): LiveRoomRosters => {
  const projections = projectionMap(snapshot);
  const teams = room.projection.teams.map<PostDraftTeamRoster>(team => ({
    teamId: team.teamId,
    ownerId: team.ownerId,
    players: team.roster.map(player => rosterPlayer(player, projections)),
  }));
  const roster = teams.find(team => team.teamId === teamId && team.ownerId === ownerId);
  if (roster === undefined) {
    throw new PostDraftLiveRoomAdapterError(
      "owned_team_mismatch",
      `Claimed team ${teamId} is not owned by ${ownerId} in this live draft room.`,
    );
  }
  const draftedPlayers = new Set(
    room.projection.teams.flatMap(team => team.roster)
      .map(player => canonicalPlayerIdentityKey(player.name)),
  );
  const freeAgentPlayers = room.playerCatalog
    .filter(player => !draftedPlayers.has(canonicalPlayerIdentityKey(player.name)))
    .map(player => rosterPlayer(player, projections));

  return { teams, roster, freeAgentPlayers };
};
