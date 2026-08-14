import {
  createAuthService,
  type AccountRecord,
  type AuthRepository,
} from "../auth.js";
import type { ExportArtifactRepository } from "../exportArtifacts.js";
import type { HistoricalImportRepository } from "../historicalImports.js";
import type { JobRepository } from "../jobs.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type { LeagueSetupRepository, PlatformLeagueMembership } from "../leagueSetup.js";
import type { LiveDraftRoomRepository } from "../liveDraftRooms.js";
import type { MockDraftResultReference } from "../mockSessions.js";
import type { PracticeShortlistRepository } from "../practiceShortlists.js";
import type {
  SimulationMockBatchRunner,
  SimulationRepository,
} from "../simulations.js";
import {
  authorizeSharedLeagueResourceRead,
  authorizeSharedLeagueSetupMutation,
  type WorkspaceRole,
} from "../workspacePrivacy.js";
import type { PlatformAppOptions } from "./contracts/options.js";
import type { PrivateTeamContextInput } from "./contracts/league.js";
import { PlatformAppError } from "./errors.js";
import { InMemoryPlatformStore } from "./store/InMemoryPlatformStore.js";

const sharedMutationRoles = new Set<WorkspaceRole>(["owner", "admin"]);

export interface PlatformAppContext {
  readonly store: InMemoryPlatformStore;
  readonly auth: ReturnType<typeof createAuthService>;
  readonly authRepository: AuthRepository;
  readonly leagueSetup: LeagueSetupRepository;
  readonly historicalImports: HistoricalImportRepository;
  readonly jobs: JobRepository;
  readonly simulations: SimulationRepository;
  readonly practiceShortlists: PracticeShortlistRepository;
  readonly liveDraftRooms: LiveDraftRoomRepository;
  readonly exportArtifacts: ExportArtifactRepository;
  readonly simulationRunner: SimulationMockBatchRunner;
  readonly usesExternalLeagueSetup: boolean;
  requireAccount(sessionToken: string, now?: Date): Promise<AccountRecord>;
  requireSeason(seasonId: string): Promise<LeagueSeason>;
  requireSeasonForLeagueYear(leagueId: string, seasonYear: number): Promise<LeagueSeason>;
  requireSharedRead(account: AccountRecord, leagueId: string): Promise<PlatformLeagueMembership>;
  requireSharedMutation(account: AccountRecord, leagueId: string): Promise<PlatformLeagueMembership>;
  requireSeasonRead(account: AccountRecord, seasonId: string): Promise<LeagueSeason>;
  requirePrivateTeamContext(
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): Promise<LeagueSeason>;
  canReadPrivateTeamContext(
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): Promise<boolean>;
  requireReadableMockDraftResultReference(
    account: AccountRecord,
    latestResultRef: MockDraftResultReference | undefined,
  ): Promise<MockDraftResultReference | undefined>;
}

export const createPlatformAppContext = (options: PlatformAppOptions): PlatformAppContext => {
  const store = options.store ?? new InMemoryPlatformStore();
  const authRepository = options.authRepository ?? store.authRepository;
  const leagueSetup = options.leagueSetupRepository ?? store;
  const historicalImports = options.historicalImportRepository ?? store.historicalImports;
  const jobs = options.jobRepository ?? store.jobs;
  const simulations = options.simulationRepository ?? store.simulations;
  const practiceShortlists = options.practiceShortlistRepository ?? store.practiceShortlists;
  const liveDraftRooms = options.liveDraftRoomRepository ?? store.liveDraftRooms;
  const exportArtifacts = options.exportArtifactRepository ?? store.exportArtifacts;
  const usesExternalLeagueSetup = leagueSetup !== store;
  const authEmail = options.authEmail;
  const auth = createAuthService({
    repository: authRepository,
    emailVerificationRequired: authEmail?.verificationRequired ?? false,
    ...(authEmail?.mailSender === undefined ? {} : { mailSender: authEmail.mailSender }),
    ...(authEmail?.publicBaseUrl === undefined ? {} : { publicBaseUrl: authEmail.publicBaseUrl }),
  });

  const mirrorLeagueMemberships = (
    leagueId: string,
    memberships: readonly PlatformLeagueMembership[],
  ): void => {
    if (usesExternalLeagueSetup) store.replaceMembershipsForLeague(leagueId, memberships);
  };
  const mirrorLeagueSetup = async (season: LeagueSeason): Promise<LeagueSeason> => {
    if (usesExternalLeagueSetup) {
      store.registerLeagueSeason({
        season,
        memberships: await leagueSetup.membershipsForLeague(season.leagueId),
        createdByUserId: "external",
        enforceCreationLimits: false,
      });
    }
    return season;
  };
  const requireAccount = async (sessionToken: string, now?: Date): Promise<AccountRecord> => {
    const authenticated = await auth.lookupSession(sessionToken, now);
    if (authenticated === null) {
      throw new PlatformAppError("auth_required", "Sign in before using this workspace.");
    }
    return authenticated.account;
  };
  const requireSeason = async (seasonId: string): Promise<LeagueSeason> => {
    const season = await leagueSetup.findLeagueSeason(seasonId);
    if (season === null) throw new PlatformAppError("season_not_found", "League season was not found.");
    return await mirrorLeagueSetup(season);
  };
  const requireSeasonForLeagueYear = async (
    leagueId: string,
    seasonYear: number,
  ): Promise<LeagueSeason> => {
    const season = await leagueSetup.findLeagueSeasonForLeagueYear(leagueId, seasonYear);
    if (season === null) throw new PlatformAppError("season_not_found", "League season was not found.");
    return await mirrorLeagueSetup(season);
  };
  const requireMembership = async (
    account: AccountRecord,
    leagueId: string,
    mutate: boolean,
  ): Promise<PlatformLeagueMembership> => {
    const memberships = await leagueSetup.membershipsForLeague(leagueId);
    const decision = mutate
      ? authorizeSharedLeagueSetupMutation({ id: account.id }, { leagueId }, memberships)
      : authorizeSharedLeagueResourceRead({ id: account.id }, { leagueId }, memberships);
    if (!decision.allowed) {
      if (mutate && decision.reason !== "league_membership_required") {
        throw new PlatformAppError(
          "shared_mutation_denied",
          "Only league owners and admins can change shared draft data.",
        );
      }
      throw new PlatformAppError(
        "membership_required",
        mutate
          ? "Join this league before changing shared league data."
          : "Join this league before viewing shared league data.",
      );
    }
    const membership = await leagueSetup.findMembership(account.id, leagueId);
    if (membership === null) {
      throw new PlatformAppError(
        "membership_required",
        mutate
          ? "Join this league before changing shared league data."
          : "Join this league before viewing shared league data.",
      );
    }
    mirrorLeagueMemberships(leagueId, memberships);
    return membership;
  };
  const requireSharedRead = (account: AccountRecord, leagueId: string) =>
    requireMembership(account, leagueId, false);
  const requireSharedMutation = (account: AccountRecord, leagueId: string) =>
    requireMembership(account, leagueId, true);
  const requireSeasonRead = async (account: AccountRecord, seasonId: string): Promise<LeagueSeason> => {
    const season = await requireSeason(seasonId);
    await requireSharedRead(account, season.leagueId);
    return season;
  };
  const requirePrivateTeamContext = async (
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): Promise<LeagueSeason> => {
    const season = await requireSeason(input.seasonId);
    const membership = await requireSharedRead(account, input.leagueId);
    if (season.leagueId !== input.leagueId) {
      throw new PlatformAppError("league_not_found", "League does not match this season.");
    }
    const team = season.teams.find(candidate => candidate.id === input.teamId);
    if (team === undefined || team.ownerId !== input.ownerId) {
      throw new PlatformAppError("team_not_found", "Team was not found in this league season.");
    }
    if (membership.teamId === undefined || membership.ownerId === undefined) {
      throw new PlatformAppError("team_claim_required", "Claim your team before creating private prep.");
    }
    if (membership.teamId !== input.teamId || membership.ownerId !== input.ownerId) {
      throw new PlatformAppError("private_team_required", "Private prep can only use your claimed team.");
    }
    return season;
  };
  const canReadPrivateTeamContext = async (
    account: AccountRecord,
    input: Omit<PrivateTeamContextInput, "actorSessionToken" | "now">,
  ): Promise<boolean> => {
    try {
      await requirePrivateTeamContext(account, input);
      return true;
    } catch (error) {
      if (error instanceof PlatformAppError) return false;
      throw error;
    }
  };
  const requireReadableMockDraftResultReference = async (
    account: AccountRecord,
    resultRef: MockDraftResultReference | undefined,
  ): Promise<MockDraftResultReference | undefined> => {
    if (resultRef === undefined || resultRef.kind !== "simulation-result") return resultRef;
    const run = await simulations.fetchForUser(resultRef.id, account.id);
    if (run === null) {
      throw new PlatformAppError("private_resource", "This prep artifact belongs to another user.");
    }
    await requirePrivateTeamContext(account, run.request);
    return resultRef;
  };

  return {
    store, auth, authRepository, leagueSetup, historicalImports, jobs, simulations,
    practiceShortlists, liveDraftRooms, exportArtifacts,
    simulationRunner: options.simulationRunner, usesExternalLeagueSetup,
    requireAccount, requireSeason, requireSeasonForLeagueYear, requireSharedRead,
    requireSharedMutation, requireSeasonRead, requirePrivateTeamContext,
    canReadPrivateTeamContext, requireReadableMockDraftResultReference,
  };
};

export const canMutateLeague = (role: WorkspaceRole): boolean => sharedMutationRoles.has(role);
