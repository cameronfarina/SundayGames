import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../liveDraftRooms.js";

export const playerIdFor = (player: LiveDraftRoomPlayerCatalogEntry): string =>
  canonicalPlayerIdentityKey(player.name);

export const initialRosterPlayerIdentity = (
  player: LiveDraftRoomInitialRosterPlayer,
): string => canonicalPlayerIdentityKey(player.playerName);

export const existingKeeperTeamName = (
  season: LeagueSeason,
  keeper: LiveDraftRoomInitialRosterPlayer,
): string => season.teams.find(team => team.id === keeper.teamId)?.displayName ?? "another team";

export const sourceVersionWithKeepers = (sourceVersion: string): string => {
  const base = sourceVersion.replace(/\+keepers-v1$/u, "");
  return `${base}+keepers-v1`;
};
