import { leagueConfig, ownerOrder } from "../../../config/league.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../leagueSeason.js";
import { localDemoSeasonId } from "../localDemoFixtures.js";
import { seedAccount } from "./accounts.js";
import type {
  LocalE2eSeedEnv,
  LocalE2eSeedPlatformApp,
  SeedLocalE2eOptions,
  SeedLocalE2eResult,
  SeedLocalE2eSeasonSummary,
} from "./contracts.js";
import { commissionerOwner, managerOwner, seedAccountFixtures } from "./fixtures.js";
import { ensureSeedRoom, roomSummaryFor } from "./room.js";
import { loadLocalE2eSeedRuntime } from "./runtime.js";
import { membershipFor, openTeamsFor, teamByOwner, teamClaimFor } from "./teams.js";

const seasonSummaryFor = (season: LeagueSeason): SeedLocalE2eSeasonSummary => ({
  id: season.id,
  leagueId: season.leagueId,
  seasonYear: season.seasonYear,
  teamCount: season.teams.length,
  setupStatus: season.setupStatus,
});

export const seedLocalE2e = async (
  app: LocalE2eSeedPlatformApp,
  options: SeedLocalE2eOptions = {},
): Promise<SeedLocalE2eResult> => {
  const draftSeason = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "Mockd Local E2E",
    setupStatus: "published",
  });
  if (draftSeason.id !== localDemoSeasonId) {
    throw new Error(`Local E2E season ${draftSeason.id} does not match the configured demo season ${localDemoSeasonId}.`);
  }
  const now = options.now ?? new Date();
  const commissioner = await seedAccount(app, seedAccountFixtures.commissioner, now);
  const manager = await seedAccount(app, seedAccountFixtures.manager, now);
  const season = await app.registerLeagueSeason({
    actorSessionToken: commissioner.sessionToken,
    season: draftSeason,
    memberships: [
      membershipFor(commissioner, draftSeason, commissionerOwner),
      membershipFor(manager, draftSeason, managerOwner),
    ],
    now,
  });
  const commissionerTeam = teamByOwner(season, commissionerOwner);
  const managerTeam = teamByOwner(season, managerOwner);
  const commissionerClaim = await app.claimLeagueSeasonTeam({
    actorSessionToken: commissioner.sessionToken,
    seasonId: season.id,
    ownerId: commissionerTeam.ownerId,
    teamId: commissionerTeam.id,
    now,
  });
  const managerClaim = await app.claimLeagueSeasonTeam({
    actorSessionToken: manager.sessionToken,
    seasonId: season.id,
    ownerId: managerTeam.ownerId,
    teamId: managerTeam.id,
    now,
  });
  const liveDraftRoom = await ensureSeedRoom(app, season, commissioner, options, now);
  await options.persist?.();
  return {
    accounts: { commissioner, manager },
    season: seasonSummaryFor(season),
    teamClaims: {
      commissioner: teamClaimFor(season, commissionerOwner, commissionerClaim),
      manager: teamClaimFor(season, managerOwner, managerClaim),
    },
    openTeams: openTeamsFor(season),
    liveDraftRoom: roomSummaryFor(liveDraftRoom),
  };
};

export const seedLocalE2eFromEnv = async (
  env: LocalE2eSeedEnv = process.env,
  options: SeedLocalE2eOptions = {},
): Promise<SeedLocalE2eResult> => {
  const runtime = await loadLocalE2eSeedRuntime(env);
  try {
    const result = await seedLocalE2e(runtime.app, { ...options, persist: runtime.persist });
    return { ...result, storage: runtime.storage };
  } finally {
    await runtime.close();
  }
};
