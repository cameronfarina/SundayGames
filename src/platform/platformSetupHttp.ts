import type { LeagueSeason } from "./leagueSeason.js";
import {
  applyLeagueSetupImportToSeason,
  parseLeagueSetupImport,
  type LeagueSetupImportResult,
  type LeagueSetupMembershipSeed,
} from "./leagueSetupImport.js";
import type {
  createPlatformApp,
  PlatformLeagueMembership,
} from "./platformApp.js";
import {
  issuePlatformInvitation,
  reissuePlatformInvitation,
  type PlatformInvitationRepository,
  type PlatformInvitationView,
} from "./platformInvitations.js";

export interface PlatformSetupHttpErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface PlatformSetupHttpResponse<TBody = unknown> {
  status: number;
  body: TBody | PlatformSetupHttpErrorBody;
}

export interface PlatformLeagueSetupImportKnownUser {
  email: string;
  userId?: string;
  accountId?: string;
}

export interface PlatformLeagueSetupImportInput {
  actorSessionToken: string;
  seasonId?: string;
  content?: string;
  rows?: readonly string[];
  knownUsers?: readonly PlatformLeagueSetupImportKnownUser[];
  invitationRepository?: PlatformInvitationRepository;
  now?: Date | undefined;
}

export interface PlatformLeagueSetupImportPreviewBody {
  import: LeagueSetupImportResult;
}

export interface PlatformLeagueSetupImportPendingInvite {
  email: string;
  leagueId: string;
  role: LeagueSetupMembershipSeed["role"];
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
}

export interface PlatformLeagueSetupImportApplyBody extends PlatformLeagueSetupImportPreviewBody {
  season: LeagueSeason;
  memberships: readonly PlatformLeagueMembership[];
  pendingInvites: readonly PlatformLeagueSetupImportPendingInvite[];
  invitations: readonly PlatformInvitationView[];
}

export interface PlatformLeagueSetupImportBlockedBody extends PlatformSetupHttpErrorBody {
  import: LeagueSetupImportResult;
}

type PlatformApp = ReturnType<typeof createPlatformApp>;

const leagueSetupImportBlockedBody = (
  parsedImport: LeagueSetupImportResult,
): PlatformLeagueSetupImportBlockedBody => ({
  error: {
    code: "league_setup_import_blocked",
    message: "Resolve league setup import blockers before applying.",
  },
  import: parsedImport,
});

const seasonRequiredBody: PlatformSetupHttpErrorBody = {
  error: {
    code: "season_required",
    message: "Choose an existing season before applying league setup import rows.",
  },
};

const normalizeEmailKey = (email: string): string => email.trim().toLowerCase();

const contentFor = (input: Pick<PlatformLeagueSetupImportInput, "content" | "rows">): string =>
  input.content ?? input.rows?.join("\n") ?? "";

const existingSeasonFor = async (
  app: PlatformApp,
  input: Pick<PlatformLeagueSetupImportInput, "actorSessionToken" | "seasonId" | "now">,
): Promise<LeagueSeason | null> => {
  if (input.seasonId === undefined || input.seasonId.trim().length === 0) return null;

  return await app.getLeagueSeason({
    actorSessionToken: input.actorSessionToken,
    seasonId: input.seasonId,
    now: input.now,
  });
};

const registeredAccountIdForEmail = async (
  app: PlatformApp,
  email: string,
): Promise<string | null> => {
  const account = await app.findAccountByEmail(normalizeEmailKey(email));

  return account?.id ?? null;
};

const knownUserIdsByEmail = async (
  app: PlatformApp,
  knownUsers: readonly PlatformLeagueSetupImportKnownUser[] | undefined,
): Promise<ReadonlyMap<string, string>> => {
  const knownUserIds = new Map<string, string>();

  for (const knownUser of knownUsers ?? []) {
    const email = normalizeEmailKey(knownUser.email);
    const accountId = await registeredAccountIdForEmail(app, email);
    const submittedUserId = knownUser.userId ?? knownUser.accountId;

    if (accountId === null || email.length === 0) continue;
    if (
      submittedUserId !== undefined &&
      submittedUserId.trim().length > 0 &&
      submittedUserId !== accountId
    ) {
      continue;
    }
    knownUserIds.set(email, accountId);
  }

  return knownUserIds;
};

const actorAccountIdFor = async (
  app: PlatformApp,
  actorSessionToken: string,
  now: Date | undefined,
): Promise<string | null> => {
  const account = await app.findAccountBySessionToken(actorSessionToken, now);

  return account?.id ?? null;
};

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

const normalizedName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, " ");

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
): PlatformLeagueSetupImportPendingInvite | null => {
  if (seed.email === undefined) return null;

  return {
    email: seed.email,
    leagueId: seed.leagueId,
    role: seed.role,
    ownerId: seed.ownerId,
    teamId: seed.teamId,
    ownerDisplayName: seed.ownerDisplayName,
    teamDisplayName: seed.teamDisplayName,
  };
};

const membershipsForAppliedImport = async (
  app: PlatformApp,
  input: PlatformLeagueSetupImportInput,
  season: LeagueSeason,
  seeds: readonly LeagueSetupMembershipSeed[],
): Promise<{
  memberships: readonly PlatformLeagueMembership[];
  pendingInvites: readonly PlatformLeagueSetupImportPendingInvite[];
  actorAccountId: string | null;
}> => {
  const membershipsByUserId = new Map<string, PlatformLeagueMembership>();
  const claimedTeamIds = new Set<string>();
  const userIdsByEmail = await knownUserIdsByEmail(app, input.knownUsers);

  for (const seed of seeds) {
    if (seed.email === undefined) continue;

    const email = normalizeEmailKey(seed.email);
    const knownUserId = userIdsByEmail.get(email) ?? (await registeredAccountIdForEmail(app, email));
    if (knownUserId === undefined || knownUserId === null) continue;

    membershipsByUserId.set(knownUserId, membershipForSeed(seed, knownUserId));
    claimedTeamIds.add(seed.teamId);
  }

  const actorAccountId = await actorAccountIdFor(app, input.actorSessionToken, input.now);
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

  return {
    actorAccountId,
    memberships: [...membershipsByUserId.values()],
    pendingInvites: seeds
      .filter(seed => !claimedTeamIds.has(seed.teamId))
      .map(pendingInviteFor)
      .filter((invite): invite is PlatformLeagueSetupImportPendingInvite => invite !== null),
  };
};

export const previewLeagueSetupImport = async (
  app: PlatformApp,
  input: PlatformLeagueSetupImportInput,
): Promise<PlatformSetupHttpResponse<PlatformLeagueSetupImportPreviewBody>> => {
  const season = await existingSeasonFor(app, input);
  const parsedImport = parseLeagueSetupImport(
    contentFor(input),
    season === null ? {} : { expectedTeamCount: season.settings.expectedTeamCount },
  );

  return {
    status: 200,
    body: { import: parsedImport },
  };
};

export const applyLeagueSetupImport = async (
  app: PlatformApp,
  input: PlatformLeagueSetupImportInput,
): Promise<PlatformSetupHttpResponse<PlatformLeagueSetupImportApplyBody | PlatformLeagueSetupImportBlockedBody>> => {
  const season = await existingSeasonFor(app, input);
  if (season === null) {
    return {
      status: 400,
      body: seasonRequiredBody,
    };
  }

  const parsedImport = parseLeagueSetupImport(contentFor(input), {
    expectedTeamCount: season.settings.expectedTeamCount,
  });

  if (parsedImport.status === "blocked") {
    return {
      status: 400,
      body: leagueSetupImportBlockedBody(parsedImport),
    };
  }

  const appliedImport = applyLeagueSetupImportToSeason(season, parsedImport.records);
  const { actorAccountId, memberships, pendingInvites } = await membershipsForAppliedImport(
    app,
    input,
    season,
    appliedImport.memberships,
  );
  const registeredSeason = await app.registerLeagueSeason({
    actorSessionToken: input.actorSessionToken,
    season: appliedImport.season,
    memberships,
    now: input.now,
  });
  const invitationNow = input.now ?? new Date();
  const expiresAt = new Date(invitationNow.getTime() + 7 * 24 * 60 * 60 * 1_000);
  let invitations: readonly PlatformInvitationView[] = [];
  if (input.invitationRepository !== undefined && actorAccountId !== null) {
    const invitationRepository = input.invitationRepository;
    const existingInvitations = await invitationRepository.listForSeason(registeredSeason.id);
    invitations = await Promise.all(pendingInvites.map(invite => {
      const existing = existingInvitations.find(candidate =>
        candidate.status === "pending"
          && candidate.teamId === invite.teamId
          && candidate.email === normalizeEmailKey(invite.email)
      );
      return existing === undefined
        ? issuePlatformInvitation(invitationRepository, {
            ...invite,
            seasonId: registeredSeason.id,
            invitedByUserId: actorAccountId,
            now: invitationNow,
            expiresAt,
          })
        : reissuePlatformInvitation(invitationRepository, {
            invitationId: existing.id,
            invitedByUserId: actorAccountId,
            now: invitationNow,
            expiresAt,
          });
    }));
  }

  return {
    status: 200,
    body: {
      season: registeredSeason,
      import: parsedImport,
      memberships,
      pendingInvites,
      invitations,
    },
  };
};
