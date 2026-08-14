import { leagueConfig, ownerOrder } from "../../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type AuctionLeagueSeason,
  type LeagueSeason,
} from "../../src/platform/leagueSeason.js";
import {
  InMemoryLiveDraftRoomRepository,
  LiveDraftRoomError,
  type LiveDraftRoomActor,
  type LiveDraftRoomPlayerCatalogEntry,
} from "../../src/platform/liveDraftRooms.js";

type CreateRoomInput = Parameters<InMemoryLiveDraftRoomRepository["createRoom"]>[0];
type CreateRoomOptions = Partial<CreateRoomInput>;
type UnvalidatedPlayerCatalogEntry = Omit<LiveDraftRoomPlayerCatalogEntry, "position"> & {
  position: string;
};
type UnvalidatedPlayerCatalogOptions = Omit<CreateRoomOptions, "playerCatalog"> & {
  playerCatalog?: readonly UnvalidatedPlayerCatalogEntry[];
};

export const now = new Date("2026-08-09T12:00:00.000Z");
export const commissioner: LiveDraftRoomActor = {
  userId: "user_commish", leagueId: "league-100001", role: "admin",
};
export const member: LiveDraftRoomActor = {
  userId: "user_member", leagueId: "league-100001", role: "member",
};
export const nonMember: LiveDraftRoomActor = {
  userId: "user_outside", leagueId: "other-league", role: "admin",
};

export const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
  { name: "Trevor Lawrence", position: "QB", expectedPrice: 9 },
] satisfies readonly LiveDraftRoomPlayerCatalogEntry[];

export const publishedSeason = (): AuctionLeagueSeason =>
  buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    setupStatus: "published",
    leagueName: "Sunday league",
  });

export const multiwordTeamSeason = (): LeagueSeason => {
  const season = publishedSeason();

  return {
    ...season,
    teams: season.teams.map(team => {
      if (team.ownerDisplayName === "Owner11") {
        return { ...team, ownerDisplayName: "Owner11 Audit", displayName: "Audit Aces" };
      }
      if (team.ownerDisplayName === "Owner12") {
        return { ...team, ownerDisplayName: "Owner12 Audit", displayName: "Audit Angels" };
      }

      return team;
    }),
  };
};

export const publishedSnakeSeason = (): LeagueSeason => {
  const season = publishedSeason();

  return {
    ...season,
    settings: {
      expectedTeamCount: season.settings.expectedTeamCount,
      draftFormat: "snake",
      scoring: season.settings.scoring,
      snake: {
        rounds: season.settings.roster.rosterSize,
        order: season.teams.map(team => team.id),
        reversal: "standard",
      },
      roster: season.settings.roster,
      keeperPolicy: season.settings.keeperPolicy,
    },
  };
};

export function createRoom(
  repository?: InMemoryLiveDraftRoomRepository,
  options?: CreateRoomOptions,
): ReturnType<InMemoryLiveDraftRoomRepository["createRoom"]>;
export function createRoom(
  repository: InMemoryLiveDraftRoomRepository,
  options: UnvalidatedPlayerCatalogOptions,
): ReturnType<InMemoryLiveDraftRoomRepository["createRoom"]>;
export function createRoom(
  repository = new InMemoryLiveDraftRoomRepository(),
  options: CreateRoomOptions | UnvalidatedPlayerCatalogOptions = {},
): ReturnType<InMemoryLiveDraftRoomRepository["createRoom"]> {
  return Reflect.apply(repository.createRoom, repository, [{
    season: publishedSeason(),
    roomId: "room_sunday",
    commissionerUserId: "user_commish",
    viewerPasswordHashRef: "viewer-password-hash",
    playerCatalog,
    createdAt: now,
    ...options,
  }]);
}

export const startRoom = (
  repository: InMemoryLiveDraftRoomRepository,
  expectedRevision = 1,
) =>
  repository.startRoom({
    roomId: "room_sunday",
    actor: commissioner,
    expectedRevision,
    idempotencyKey: `start:room_sunday:${expectedRevision}`,
    now: new Date(now.getTime() + 1_000),
  });

export const teamByOwner = (season: LeagueSeason, ownerDisplayName: string) => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === ownerDisplayName);
  if (team === undefined) throw new Error(`Expected ${ownerDisplayName} team fixture.`);

  return team;
};

export {
  buildCurrentMockdLeagueSeason,
  InMemoryLiveDraftRoomRepository,
  leagueConfig,
  LiveDraftRoomError,
  ownerOrder,
};
export type { LeagueSeason, LiveDraftRoomPlayerCatalogEntry };
