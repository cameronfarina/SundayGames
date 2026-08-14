import type { SaveLiveDraftRoomSetupInput } from "../liveDraftRoomSetups.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";
import { normalizeLeagueSeasonSettings, type LeagueSeason } from "../leagueSeason.js";
import type { ResolvedProductionProvisioningDocument } from "../productionProvisioning.js";

export const normalizedMemberships = (
  memberships: readonly PlatformLeagueMembership[],
): readonly PlatformLeagueMembership[] => [...memberships]
  .map(membership => ({
    userId: membership.userId,
    leagueId: membership.leagueId,
    role: membership.role,
    ...(membership.ownerId === undefined ? {} : { ownerId: membership.ownerId }),
    ...(membership.teamId === undefined ? {} : { teamId: membership.teamId }),
  }))
  .sort((left, right) => left.userId.localeCompare(right.userId));

export const draftSetupInputFor = (
  document: ResolvedProductionProvisioningDocument,
): SaveLiveDraftRoomSetupInput => ({
  seasonId: document.season.id,
  sourceVersion: document.provisioningId,
  playerCatalog: document.catalog.map(player => ({
    name: player.name,
    position: player.position,
    expectedPrice: player.expectedPrice,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  })),
  initialRosters: document.initialRosters.map(player => ({
    teamId: player.teamId,
    playerName: player.playerName,
    position: player.position,
    price: player.price,
    ...(player.expectedPrice === undefined ? {} : { expectedPrice: player.expectedPrice }),
    ...(player.source === undefined ? {} : { source: player.source }),
  })),
});

export const seasonComparable = (season: LeagueSeason): unknown => ({
  id: season.id,
  league: season.league,
  leagueId: season.leagueId,
  seasonYear: season.seasonYear,
  teams: season.teams,
  settings: normalizeLeagueSeasonSettings(season.settings),
  setupStatus: season.setupStatus,
  ...(season.draft === undefined ? {} : { draft: season.draft }),
});
