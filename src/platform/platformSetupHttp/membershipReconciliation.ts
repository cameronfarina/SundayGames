import type { LeagueSeason } from "../leagueSeason.js";
import type { LeagueSetupMembershipSeed } from "../leagueSetupImport.js";
import type { PlatformLeagueMembership } from "../platformApp.js";
import type { PlatformSetupApp } from "./app.js";
import type {
  PlatformLeagueSetupImportInput,
  PlatformLeagueSetupImportPendingInvite,
} from "./contracts.js";

const normalizedName = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const membershipForSeed = (
  seed: LeagueSetupMembershipSeed,
  userId: string,
): PlatformLeagueMembership => ({
  userId,
  leagueId: seed.leagueId,
  role: seed.role,
  ownerId: seed.ownerId,
  teamId: seed.teamId,
  ...(seed.email === undefined ? {} : { inviteEmail: seed.email }),
});

const seedForExistingMembership = (
  season: LeagueSeason,
  seeds: readonly LeagueSetupMembershipSeed[],
  membership: PlatformLeagueMembership,
): LeagueSetupMembershipSeed | undefined => {
  const exactSeed = seeds.find(seed =>
    seed.ownerId === membership.ownerId || seed.teamId === membership.teamId
  );
  if (exactSeed !== undefined) return exactSeed;

  const existingTeam = season.teams.find(team =>
    team.id === membership.teamId || team.ownerId === membership.ownerId
  );
  if (existingTeam === undefined) return undefined;

  return seeds.find(seed =>
    normalizedName(seed.ownerDisplayName) === normalizedName(existingTeam.ownerDisplayName)
  );
};

const pendingInviteFor = (
  seed: LeagueSetupMembershipSeed,
): PlatformLeagueSetupImportPendingInvite | null => seed.email === undefined ? null : {
  email: seed.email,
  leagueId: seed.leagueId,
  role: seed.role,
  ownerId: seed.ownerId,
  teamId: seed.teamId,
  ownerDisplayName: seed.ownerDisplayName,
  teamDisplayName: seed.teamDisplayName,
};

export interface ReconciledSetupMemberships {
  memberships: readonly PlatformLeagueMembership[];
  pendingInvites: readonly PlatformLeagueSetupImportPendingInvite[];
  actorAccountId: string | null;
}

export const reconcileSetupMemberships = async (
  app: PlatformSetupApp,
  input: PlatformLeagueSetupImportInput,
  season: LeagueSeason,
  seeds: readonly LeagueSetupMembershipSeed[],
): Promise<ReconciledSetupMemberships> => {
  const membershipsByUserId = new Map<string, PlatformLeagueMembership>();
  const claimedTeamIds = new Set<string>();
  const account = await app.findAccountBySessionToken(input.actorSessionToken, input.now);
  const actorAccountId = account?.id ?? null;

  for (const existingMembership of await app.listLeagueMemberships(season.leagueId)) {
    const existingSeed = seedForExistingMembership(season, seeds, existingMembership);
    const membership = existingSeed === undefined
      ? {
          userId: existingMembership.userId,
          leagueId: season.leagueId,
          role: existingMembership.role,
        }
      : {
          ...membershipForSeed(existingSeed, existingMembership.userId),
          role: existingMembership.role,
        };
    membershipsByUserId.set(existingMembership.userId, membership);
    if (existingSeed !== undefined) claimedTeamIds.add(existingSeed.teamId);
  }

  if (actorAccountId !== null && !membershipsByUserId.has(actorAccountId)) {
    membershipsByUserId.set(actorAccountId, {
      userId: actorAccountId,
      leagueId: season.leagueId,
      role: "owner",
    });
  }

  const pendingInvites = seeds.flatMap(seed => {
    if (claimedTeamIds.has(seed.teamId)) return [];
    const invite = pendingInviteFor(seed);
    return invite === null ? [] : [invite];
  });
  return { actorAccountId, memberships: [...membershipsByUserId.values()], pendingInvites };
};
