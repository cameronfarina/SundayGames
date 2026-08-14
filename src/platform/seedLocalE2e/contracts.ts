import type { createPlatformApp, PlatformLeagueMembership } from "../platformApp.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoom,
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../liveDraftRooms.js";

export interface LocalE2eSeedEnv {
  readonly [key: string]: string | undefined;
}

export type LocalE2eSeedStorage =
  | { kind: "file"; path: string }
  | { kind: "postgres"; databaseUrl: string; snapshotKey?: string | undefined };

export type LocalE2eSeedPlatformApp = ReturnType<typeof createPlatformApp>;

export interface LocalE2eSeedRuntime {
  storage: LocalE2eSeedStorage;
  app: LocalE2eSeedPlatformApp;
  persist: () => Promise<void>;
  close: () => Promise<void>;
}

export interface SeedLocalE2eOptions {
  now?: Date | undefined;
  playerCatalog?: readonly LiveDraftRoomPlayerCatalogEntry[] | undefined;
  initialRosters?: readonly LiveDraftRoomInitialRosterPlayer[] | undefined;
  persist?: (() => Promise<void>) | undefined;
}

export interface SeedLocalE2eAccount {
  accountId: string;
  email: string;
  password: string;
  sessionToken: string;
}

export interface SeedLocalE2eTeamClaim {
  userId: string;
  leagueId: string;
  role: PlatformLeagueMembership["role"];
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface SeedLocalE2eSeasonSummary {
  id: string;
  leagueId: string;
  seasonYear: number;
  teamCount: number;
  setupStatus: LeagueSeason["setupStatus"];
}

export interface SeedLocalE2eRoomSummary {
  roomId: string;
  status: LiveDraftRoom["status"];
  revision: number;
  boardCount: number;
  catalogCount: number;
  initialRosterCount: number;
}

export interface SeedLocalE2eOpenTeam {
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface SeedLocalE2eResult {
  storage?: LocalE2eSeedStorage | undefined;
  accounts: {
    commissioner: SeedLocalE2eAccount;
    manager: SeedLocalE2eAccount;
  };
  season: SeedLocalE2eSeasonSummary;
  teamClaims: {
    commissioner: SeedLocalE2eTeamClaim;
    manager: SeedLocalE2eTeamClaim;
  };
  openTeams: readonly SeedLocalE2eOpenTeam[];
  liveDraftRoom: SeedLocalE2eRoomSummary;
}
