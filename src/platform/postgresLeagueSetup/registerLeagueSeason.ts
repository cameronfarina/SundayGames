import type { LeagueSeason } from "../leagueSeason.js";
import { normalizeLeagueSeasonSettings } from "../leagueSeason.js";
import {
  LeagueSetupWriteConflictError,
  leagueSeasonSetupRevision,
  type LeagueCreationLimits,
  type RegisterLeagueSeasonRepositoryInput,
} from "../leagueSetup.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { assertLeagueCreationAllowed } from "./creationLimits.js";
import { firstRow } from "./databaseValues.js";
import { upsertLeague, upsertSeason } from "./leagueWrites.js";
import { replaceMemberships } from "./membershipWrites.js";
import { upsertRosterRules } from "./rosterRulesWrite.js";
import { findLeagueSeason } from "./seasonReads.js";
import { replaceTeams } from "./teamWrites.js";

export const registerLeagueSeason = async (
  client: PostgresTransactionalQueryClient,
  limits: LeagueCreationLimits,
  input: RegisterLeagueSeasonRepositoryInput,
): Promise<LeagueSeason> => {
  const now = input.now ?? new Date();
  const season: LeagueSeason = {
    ...input.season,
    settings: normalizeLeagueSeasonSettings(input.season.settings),
  };
  return await client.transaction(async transactionClient => {
    await transactionClient.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`mockd:league-create:${input.createdByUserId}`],
    );
    const existingLeague = await transactionClient.query<{ id: string }>(
      "SELECT id FROM leagues WHERE id = $1 LIMIT 1",
      [season.leagueId],
    );
    if (firstRow(existingLeague) === undefined && input.enforceCreationLimits !== false) {
      await assertLeagueCreationAllowed(
        transactionClient,
        limits,
        input.createdByUserId,
        now,
        input.enforceCreationRateLimit ?? true,
      );
    }
    if (input.expectedSetupRevision !== undefined) {
      await transactionClient.query(
        "SELECT id FROM league_seasons WHERE id = $1 FOR UPDATE",
        [season.id],
      );
      const currentSeason = await findLeagueSeason(transactionClient, season.id);
      if (
        currentSeason === null ||
        leagueSeasonSetupRevision(currentSeason) !== input.expectedSetupRevision
      ) {
        throw new LeagueSetupWriteConflictError();
      }
    }
    await upsertLeague(transactionClient, season, input.createdByUserId, now);
    await upsertSeason(transactionClient, season, now);
    await replaceTeams(
      transactionClient,
      season,
      input.memberships,
      input.membershipWriteMode === "preserve",
      now,
    );
    await upsertRosterRules(transactionClient, season, now);
    if (input.membershipWriteMode !== "preserve") {
      await replaceMemberships(transactionClient, season.leagueId, input.memberships, now);
    }
    const registeredSeason = await findLeagueSeason(transactionClient, season.id);
    if (registeredSeason === null) {
      throw new Error("Postgres league setup insert did not return a registered season.");
    }
    return registeredSeason;
  });
};
