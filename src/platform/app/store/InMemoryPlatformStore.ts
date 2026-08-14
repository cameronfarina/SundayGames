import type { LeagueSeason } from "../../leagueSeason.js";
import type {
  ArchiveLeagueRepositoryInput,
  ClaimLeagueSeasonTeamRepositoryInput,
  JoinLeagueSeasonTeamRepositoryInput,
  LeagueSetupRepository,
  PlatformLeagueMembership,
  RegisterLeagueSeasonRepositoryInput,
} from "../../leagueSetup.js";
import type {
  InMemoryPlatformStoreOptions,
  InMemoryPlatformStoreSnapshot,
} from "../contracts/store.js";
import {
  findLeagueSeason,
  findLeagueSeasonForLeagueYear,
  findMembership,
  hasLeagueSeasonForLeague,
  isLeagueArchived,
  membershipsForLeague,
} from "./InMemoryPlatformStore/leagueQueries.js";
import { InMemoryPlatformRepositories } from "./InMemoryPlatformStore/repositories.js";
import {
  createAuthSnapshot,
  createOnboardingSnapshot,
  createStoreSnapshot,
} from "./InMemoryPlatformStore/snapshots.js";
import { createLeagueMemoryState } from "./leagueMemoryState.js";
import { archiveLeague, registerLeagueSeason } from "./leagueRegistration.js";
import { loadStoreSnapshot } from "./loadStoreSnapshot.js";
import {
  claimLeagueSeasonTeam,
  joinLeagueSeasonTeam,
  replaceLeagueMemberships,
} from "./teamMemberships.js";

export class InMemoryPlatformStore extends InMemoryPlatformRepositories implements LeagueSetupRepository {
  constructor(snapshot?: InMemoryPlatformStoreSnapshot, options: InMemoryPlatformStoreOptions = {}) {
    super(createLeagueMemoryState(options.leagueCreationLimits), options);
    if (snapshot !== undefined) loadStoreSnapshot(this.leagueState, this, snapshot);
  }

  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): LeagueSeason {
    const season = registerLeagueSeason(this.leagueState, input);
    this.historicalImports.replaceLeagueSeasons([...this.leagueState.seasonsById.values()]);
    return season;
  }

  archiveLeague(input: ArchiveLeagueRepositoryInput): boolean {
    return archiveLeague(this.leagueState, input);
  }

  isLeagueArchived(leagueId: string): boolean {
    return isLeagueArchived(this.leagueState, leagueId);
  }

  claimLeagueSeasonTeam(input: ClaimLeagueSeasonTeamRepositoryInput): PlatformLeagueMembership | null {
    return claimLeagueSeasonTeam(this.leagueState, input);
  }

  joinLeagueSeasonTeam(input: JoinLeagueSeasonTeamRepositoryInput): PlatformLeagueMembership | null {
    return joinLeagueSeasonTeam(this.leagueState, input);
  }

  findLeagueSeason(seasonId: string): LeagueSeason | null {
    return findLeagueSeason(this.leagueState, seasonId);
  }

  hasLeagueSeasonForLeague(leagueId: string): boolean {
    return hasLeagueSeasonForLeague(this.leagueState, leagueId);
  }

  findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): LeagueSeason | null {
    return findLeagueSeasonForLeagueYear(this.leagueState, leagueId, seasonYear);
  }

  findMembership(userId: string, leagueId: string): PlatformLeagueMembership | null {
    return findMembership(this.leagueState, userId, leagueId);
  }

  membershipsForLeague(leagueId: string): readonly PlatformLeagueMembership[] {
    return membershipsForLeague(this.leagueState, leagueId);
  }

  replaceMembershipsForLeague(leagueId: string, memberships: readonly PlatformLeagueMembership[]): void {
    replaceLeagueMemberships(this.leagueState, leagueId, memberships);
  }

  clearAuthSnapshotState(): void { this.authRepository.clear(); }
  clearHistoricalImportSnapshotState(): void { this.historicalImports.replaceBatchesAndRecords([], []); }
  authSnapshot(): InMemoryPlatformStoreSnapshot["auth"] { return createAuthSnapshot(this); }
  onboardingSnapshot() { return createOnboardingSnapshot(this.leagueState, this); }
  snapshot(): InMemoryPlatformStoreSnapshot { return createStoreSnapshot(this.leagueState, this); }
}
