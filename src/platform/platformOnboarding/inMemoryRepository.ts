import type {
  InMemoryPlatformOnboardingSource,
  PlatformOnboardingLeague,
  PlatformOnboardingRepository,
  PlatformReadinessState,
} from "./contracts.js";

const readinessState = (ready: boolean): PlatformReadinessState =>
  ready ? "ready" : "needs_attention";

export class InMemoryPlatformOnboardingRepository implements PlatformOnboardingRepository {
  constructor(private readonly source: () => InMemoryPlatformOnboardingSource) {}

  async listForUser(userId: string): Promise<readonly PlatformOnboardingLeague[]> {
    const source = this.source();
    const archivedLeagueIds = new Set(
      (source.leagueCreationRecords ?? [])
        .filter(record => record.archivedAt !== undefined)
        .map(record => record.leagueId),
    );

    return source.memberships
      .filter(membership =>
        membership.userId === userId && !archivedLeagueIds.has(membership.leagueId)
      )
      .flatMap(membership => {
        const season = source.leagueSeasons
          .filter(candidate => candidate.leagueId === membership.leagueId)
          .sort((left, right) => right.seasonYear - left.seasonYear)[0];
        if (season === undefined) return [];

        const team = season.teams.find(candidate => candidate.id === membership.teamId);
        const room = source.liveDraftRooms
          .filter(candidate => candidate.seasonId === season.id)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
        const nextDraftAt = room?.startsAt?.toISOString() ?? season.draft?.scheduledAt;

        return [{
          leagueId: season.leagueId,
          leagueName: season.league.name,
          seasonId: season.id,
          seasonYear: season.seasonYear,
          membership: {
            role: membership.role,
            ...(membership.ownerId === undefined ? {} : { ownerId: membership.ownerId }),
            ...(membership.teamId === undefined ? {} : { teamId: membership.teamId }),
            ...(team === undefined ? {} : {
              ownerDisplayName: team.ownerDisplayName,
              teamDisplayName: team.displayName,
            }),
          },
          canManageLeague: membership.role === "owner" || membership.role === "admin",
          readiness: {
            leagueSetup: readinessState(
              season.setupStatus === "published" || season.setupStatus === "locked",
            ),
            teamClaim: readinessState(team !== undefined),
            liveDraft: readinessState(room !== undefined),
          },
          ...(nextDraftAt === undefined ? {} : { nextDraftAt }),
          liveDraft: room === undefined ? null : { roomId: room.roomId, status: room.status },
        }];
      })
      .sort((left, right) => left.leagueName.localeCompare(right.leagueName));
  }
}
