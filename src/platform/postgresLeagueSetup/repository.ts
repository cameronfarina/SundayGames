import type { LeagueSeason } from "../leagueSeason.js";
import {
  defaultLeagueCreationLimits,
  normalizeLeagueCreationLimits,
  type ArchiveLeagueRepositoryInput,
  type ClaimLeagueSeasonTeamRepositoryInput,
  type JoinLeagueSeasonTeamRepositoryInput,
  type LeagueCreationLimits,
  type LeagueSetupRepository,
  type PlatformLeagueMembership,
  type RegisterLeagueSeasonRepositoryInput,
} from "../leagueSetup.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { claimLeagueSeasonTeam } from "./claimTeam.js";
import { joinLeagueSeasonTeam } from "./joinTeam.js";
import { archiveLeague, isLeagueArchived } from "./leagueWrites.js";
import { findMembership, membershipsForLeague } from "./membershipReads.js";
import {
  registerLeagueSeason,
  registerLeagueSeasonInTransaction,
} from "./registerLeagueSeason.js";
import {
  findLeagueSeason,
  findLeagueSeasonForLeagueYear,
  hasLeagueSeasonForLeague,
} from "./seasonReads.js";

export class PostgresLeagueSetupRepository implements LeagueSetupRepository {
  readonly #client: PostgresTransactionalQueryClient;
  readonly #leagueCreationLimits: LeagueCreationLimits;

  constructor(
    client: PostgresTransactionalQueryClient,
    leagueCreationLimits: LeagueCreationLimits = defaultLeagueCreationLimits,
  ) {
    this.#client = client;
    this.#leagueCreationLimits = normalizeLeagueCreationLimits(leagueCreationLimits);
  }

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): Promise<LeagueSeason> {
    return await registerLeagueSeason(this.#client, this.#leagueCreationLimits, input);
  }

  async registerLeagueSeasonWithConnection(
    input: RegisterLeagueSeasonRepositoryInput,
    leagueConnectionId: string,
  ): Promise<LeagueSeason> {
    return await this.#client.transaction(async transactionClient => {
      const season = await registerLeagueSeasonInTransaction(
        transactionClient,
        this.#leagueCreationLimits,
        input,
      );
      const linked = await transactionClient.query<{ id: string }>(`
UPDATE league_connections
SET league_season_id = $2,
    updated_at = $4
WHERE id = $1
  AND account_id = $3
RETURNING id;
`.trim(), [
        leagueConnectionId,
        season.id,
        input.createdByUserId,
        input.now ?? new Date(),
      ]);
      if (linked.rows[0] === undefined) {
        throw new Error("League connection disappeared before its imported season was linked.");
      }
      return season;
    });
  }

  async archiveLeague(input: ArchiveLeagueRepositoryInput): Promise<boolean> {
    return await archiveLeague(this.#client, input);
  }

  async isLeagueArchived(leagueId: string): Promise<boolean> {
    return await isLeagueArchived(this.#client, leagueId);
  }

  async claimLeagueSeasonTeam(
    input: ClaimLeagueSeasonTeamRepositoryInput,
  ): Promise<PlatformLeagueMembership | null> {
    return await claimLeagueSeasonTeam(this.#client, input);
  }

  async joinLeagueSeasonTeam(
    input: JoinLeagueSeasonTeamRepositoryInput,
  ): Promise<PlatformLeagueMembership | null> {
    return await joinLeagueSeasonTeam(this.#client, input);
  }

  async findLeagueSeason(seasonId: string): Promise<LeagueSeason | null> {
    return await findLeagueSeason(this.#client, seasonId);
  }

  async hasLeagueSeasonForLeague(leagueId: string): Promise<boolean> {
    return await hasLeagueSeasonForLeague(this.#client, leagueId);
  }

  async findLeagueSeasonForLeagueYear(
    leagueId: string,
    seasonYear: number,
  ): Promise<LeagueSeason | null> {
    return await findLeagueSeasonForLeagueYear(this.#client, leagueId, seasonYear);
  }

  async findMembership(
    userId: string,
    leagueId: string,
  ): Promise<PlatformLeagueMembership | null> {
    return await findMembership(this.#client, userId, leagueId);
  }

  async membershipsForLeague(
    leagueId: string,
  ): Promise<readonly PlatformLeagueMembership[]> {
    return await membershipsForLeague(this.#client, leagueId);
  }
}
