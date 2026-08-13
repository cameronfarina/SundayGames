import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type AnyLeagueSeason,
  type LeagueSeason,
} from "../src/platform/leagueSeason.js";
import type {
  PlatformLeagueMembership,
} from "../src/platform/leagueSetup.js";
import {
  LeagueCreationLimitError,
  LeagueSetupWriteConflictError,
  leagueSeasonSetupRevision,
} from "../src/platform/leagueSetup.js";
import { PlatformInvitationError } from "../src/platform/platformInvitations.js";
import { PostgresLeagueSetupRepository } from "../src/platform/postgresLeagueSetup.js";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const now = new Date("2026-08-09T12:00:00.000Z");

interface LeagueRow {
  id: string;
  name: string;
  provider: string | null;
  provider_league_id: string | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}

interface SeasonRow {
  id: string;
  league_id: string;
  season_year: number;
  name: string;
  status: string;
  settings_json: unknown;
  created_at: Date;
  updated_at: Date;
}

interface TeamRow {
  id: string;
  league_season_id: string;
  team_key: string;
  team_name: string;
  owner_name: string;
  abbreviation: string | null;
  manager_names_json: unknown;
  owner_user_id: string | null;
  display_order: number;
  aliases_json: unknown;
  created_at: Date;
  updated_at: Date;
}

interface RosterRuleRow {
  id: string;
  league_season_id: string;
  draft_format: string;
  budget: number | null;
  minimum_bid: number | null;
  snake_json: unknown;
  slots_json: unknown;
  position_maximums_json: unknown;
  scoring_json: unknown;
  created_at: Date;
  updated_at: Date;
}

interface MembershipRow {
  id: string;
  league_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneDate = (date: Date): Date => new Date(date.getTime());

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonValue = (value: unknown): unknown => typeof value === "string"
  ? JSON.parse(value)
  : cloneJson(value);

const cloneLeague = (row: LeagueRow): LeagueRow => ({
  ...row,
  created_at: cloneDate(row.created_at),
  updated_at: cloneDate(row.updated_at),
});

const cloneSeason = (row: SeasonRow): SeasonRow => ({
  ...row,
  settings_json: jsonValue(row.settings_json),
  created_at: cloneDate(row.created_at),
  updated_at: cloneDate(row.updated_at),
});

const cloneTeam = (row: TeamRow): TeamRow => ({
  ...row,
  aliases_json: jsonValue(row.aliases_json),
  manager_names_json: jsonValue(row.manager_names_json),
  created_at: cloneDate(row.created_at),
  updated_at: cloneDate(row.updated_at),
});

const cloneRosterRule = (row: RosterRuleRow): RosterRuleRow => ({
  ...row,
  snake_json: jsonValue(row.snake_json),
  slots_json: jsonValue(row.slots_json),
  position_maximums_json: jsonValue(row.position_maximums_json),
  scoring_json: jsonValue(row.scoring_json),
  created_at: cloneDate(row.created_at),
  updated_at: cloneDate(row.updated_at),
});

const cloneMembership = (row: MembershipRow): MembershipRow => ({
  ...row,
  created_at: cloneDate(row.created_at),
  updated_at: cloneDate(row.updated_at),
});

class FakePostgresLeagueSetupClient implements PostgresTransactionalQueryClient {
  readonly leagues = new Map<string, LeagueRow>();
  readonly seasons = new Map<string, SeasonRow>();
  readonly teams = new Map<string, TeamRow>();
  readonly rosterRulesBySeason = new Map<string, RosterRuleRow>();
  readonly memberships = new Map<string, MembershipRow>();
  readonly referencedTeamIds = new Set<string>();
  readonly queries: Array<{ text: string; values: readonly unknown[]; inTransaction: boolean }> = [];
  failNextTeamClaimWithUniqueViolation = false;
  invitationAvailable = true;
  transactionCount = 0;

  #inTransaction = false;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const leagues = new Map([...this.leagues].map(([id, row]) => [id, cloneLeague(row)]));
    const seasons = new Map([...this.seasons].map(([id, row]) => [id, cloneSeason(row)]));
    const teams = new Map([...this.teams].map(([id, row]) => [id, cloneTeam(row)]));
    const rosterRules = new Map(
      [...this.rosterRulesBySeason].map(([id, row]) => [id, cloneRosterRule(row)]),
    );
    const memberships = new Map(
      [...this.memberships].map(([id, row]) => [id, cloneMembership(row)]),
    );
    this.#inTransaction = true;
    try {
      return await operation(this);
    } catch (error) {
      this.leagues.clear();
      this.seasons.clear();
      this.teams.clear();
      this.rosterRulesBySeason.clear();
      this.memberships.clear();
      for (const [id, row] of leagues) this.leagues.set(id, row);
      for (const [id, row] of seasons) this.seasons.set(id, row);
      for (const [id, row] of teams) this.teams.set(id, row);
      for (const [id, row] of rosterRules) this.rosterRulesBySeason.set(id, row);
      for (const [id, row] of memberships) this.memberships.set(id, row);
      throw error;
    } finally {
      this.#inTransaction = false;
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values, inTransaction: this.#inTransaction });
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("SELECT pg_advisory_xact_lock")) {
      return { rows: [] };
    }

    if (normalizedSql === "SELECT id FROM leagues WHERE id = $1 LIMIT 1") {
      const [leagueId] = values as readonly [string];
      return { rows: this.leagues.has(leagueId) ? [{ id: leagueId } as TRow] : [] };
    }

    if (normalizedSql.startsWith("SELECT COUNT(*)::integer AS active_league_count")) {
      const [createdByUserId, windowStartedAt] = values as readonly [string, Date];
      const leagues = [...this.leagues.values()].filter(
        league => league.created_by_user_id === createdByUserId,
      );
      return {
        rows: [{
          active_league_count: leagues.length,
          recent_league_count: leagues.filter(league => league.created_at >= windowStartedAt).length,
          oldest_recent_created_at: leagues
            .filter(league => league.created_at >= windowStartedAt)
            .sort((left, right) => left.created_at.getTime() - right.created_at.getTime())[0]
            ?.created_at ?? null,
        } as TRow],
      };
    }

    if (normalizedSql.startsWith("SELECT id FROM league_invitations")) {
      return { rows: this.invitationAvailable ? [{ id: "invite_league" } as TRow] : [] };
    }

    if (normalizedSql.startsWith("INSERT INTO leagues")) {
      const [id, name, provider, providerLeagueId, createdByUserId, updatedAt] =
        values as readonly [string, string, string, string, string, Date];
      const existing = this.leagues.get(id);
      this.leagues.set(id, {
        id,
        name,
        provider,
        provider_league_id: providerLeagueId,
        created_by_user_id: existing?.created_by_user_id ?? createdByUserId,
        created_at: existing?.created_at ?? updatedAt,
        updated_at: updatedAt,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO league_seasons")) {
      const [id, leagueId, seasonYear, name, status, settingsJson, updatedAt] =
        values as readonly [string, string, number, string, string, string, Date];
      const existing = this.seasons.get(id);
      this.seasons.set(id, {
        id,
        league_id: leagueId,
        season_year: seasonYear,
        name,
        status,
        settings_json: jsonValue(settingsJson),
        created_at: existing?.created_at ?? updatedAt,
        updated_at: updatedAt,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT COALESCE(MAX(display_order)")) {
      const [seasonId] = values as readonly [string];
      const maxDisplayOrder = [...this.teams.values()]
        .filter(team => team.league_season_id === seasonId)
        .reduce((max, team) => Math.max(max, team.display_order), 0);

      return { rows: [{ max_display_order: maxDisplayOrder } as TRow] };
    }

    if (normalizedSql.startsWith("UPDATE fantasy_teams SET display_order = display_order + $2")) {
      const [seasonId, offset, updatedAt] = values as readonly [string, number, Date];
      for (const [teamId, team] of this.teams) {
        if (team.league_season_id === seasonId) {
          this.teams.set(teamId, {
            ...team,
            display_order: team.display_order + offset,
            updated_at: updatedAt,
          });
        }
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("DELETE FROM fantasy_teams WHERE league_season_id = $1 AND NOT")) {
      const [seasonId, retainedTeamIds] = values as readonly [string, readonly string[]];
      const retainedTeamIdSet = new Set(retainedTeamIds);
      for (const [teamId, team] of this.teams) {
        if (team.league_season_id !== seasonId || retainedTeamIdSet.has(teamId)) continue;
        if (this.referencedTeamIds.has(teamId)) {
          throw new Error(`Cannot delete referenced fake fantasy team ${teamId}.`);
        }
        this.teams.delete(teamId);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO fantasy_teams")) {
      const [id, seasonId, teamKey, teamName, ownerName, abbreviation, managerNamesJson, ownerUserId, displayOrder, updatedAt] =
        values as readonly [string, string, string, string, string, string | null, string, string | null, number, Date];
      const existing = this.teams.get(id);
      const persistedOwnerUserId = normalizedSql.includes("owner_user_id = fantasy_teams.owner_user_id")
        ? existing?.owner_user_id ?? null
        : ownerUserId;
      this.teams.set(id, {
        id,
        league_season_id: seasonId,
        team_key: teamKey,
        team_name: teamName,
        owner_name: ownerName,
        abbreviation,
        manager_names_json: jsonValue(managerNamesJson),
        owner_user_id: persistedOwnerUserId,
        display_order: displayOrder,
        aliases_json: [],
        created_at: existing?.created_at ?? updatedAt,
        updated_at: updatedAt,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO roster_rule_sets")) {
      const [
        id,
        seasonId,
        draftFormat,
        budget,
        minimumBid,
        snakeJson,
        slotsJson,
        positionMaximumsJson,
        scoringJson,
        updatedAt,
      ] = values as readonly [
        string,
        string,
        string,
        number | null,
        number | null,
        string | null,
        string,
        string,
        string,
        Date,
      ];
      const existing = this.rosterRulesBySeason.get(seasonId);
      this.rosterRulesBySeason.set(seasonId, {
        id,
        league_season_id: seasonId,
        draft_format: draftFormat,
        budget,
        minimum_bid: minimumBid,
        snake_json: jsonValue(snakeJson),
        slots_json: jsonValue(slotsJson),
        position_maximums_json: jsonValue(positionMaximumsJson),
        scoring_json: jsonValue(scoringJson),
        created_at: existing?.created_at ?? updatedAt,
        updated_at: updatedAt,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql === "DELETE FROM league_memberships WHERE league_id = $1") {
      const [leagueId] = values as readonly [string];
      for (const [membershipId, membership] of this.memberships) {
        if (membership.league_id === leagueId) this.memberships.delete(membershipId);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO league_memberships")) {
      const [id, leagueId, userId, role, updatedAt] =
        values as readonly [string, string, string, string, Date];
      const existing = [...this.memberships.values()].find(membership =>
        membership.league_id === leagueId && membership.user_id === userId
      );
      const stored = {
        id: existing?.id ?? id,
        league_id: leagueId,
        user_id: userId,
        role: existing?.role ?? role,
        status: "active",
        created_at: existing?.created_at ?? updatedAt,
        updated_at: updatedAt,
      };
      this.memberships.set(stored.id, stored);

      return { rows: [cloneMembership(stored) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT id FROM league_seasons WHERE league_id = $1")) {
      const [leagueId] = values as readonly [string];
      const row = [...this.seasons.values()].find(season => season.league_id === leagueId);

      return { rows: row === undefined ? [] : [{ id: row.id } as TRow] };
    }

    if (normalizedSql.startsWith("SELECT id FROM league_seasons WHERE id = $1 FOR UPDATE")) {
      const [seasonId] = values as readonly [string];
      return { rows: this.seasons.has(seasonId) ? [{ id: seasonId } as TRow] : [] };
    }

    if (normalizedSql.startsWith("SELECT s.id")) {
      const row = this.seasonRowForQuery(normalizedSql, values);

      return { rows: row === undefined ? [] : [row as TRow] };
    }

    if (normalizedSql.startsWith("SELECT id, league_season_id, team_key")) {
      const [seasonId] = values as readonly [string];
      const rows = [...this.teams.values()]
        .filter(team => team.league_season_id === seasonId)
        .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id))
        .map(cloneTeam);

      return { rows: rows as TRow[] };
    }

    if (normalizedSql.startsWith("SELECT id, league_id, user_id, role FROM league_memberships")
      && normalizedSql.includes("user_id = $2")) {
      const [leagueId, userId] = values as readonly [string, string];
      const row = [...this.memberships.values()]
        .find(membership =>
          membership.league_id === leagueId &&
          membership.user_id === userId &&
          membership.status === "active"
        );

      return { rows: row === undefined ? [] : [cloneMembership(row) as TRow] };
    }

    if (normalizedSql.startsWith("SELECT id FROM fantasy_teams WHERE league_season_id = $1")) {
      if (normalizedSql.includes("owner_user_id = $2") && normalizedSql.includes("id <> $3")) {
        const [seasonId, userId, targetTeamId] = values as readonly [string, string, string];
        const row = [...this.teams.values()].find(team =>
          team.league_season_id === seasonId &&
          team.owner_user_id === userId &&
          team.id !== targetTeamId
        );
        return { rows: row === undefined ? [] : [{ id: row.id } as TRow] };
      }
      const [seasonId, teamId, ownerId] = values as readonly [string, string, string];
      const row = this.teams.get(teamId);
      const matches = row?.league_season_id === seasonId && row.team_key === ownerId;

      return { rows: matches ? [{ id: teamId } as TRow] : [] };
    }

    if (normalizedSql.startsWith("UPDATE fantasy_teams SET owner_user_id = NULL")) {
      const [seasonId, userId, targetTeamId, updatedAt] = values as readonly [string, string, string, Date];
      for (const [teamId, team] of this.teams) {
        if (team.league_season_id !== seasonId || team.owner_user_id !== userId || team.id === targetTeamId) {
          continue;
        }

        this.teams.set(teamId, { ...team, owner_user_id: null, updated_at: updatedAt });
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE fantasy_teams SET owner_user_id = $4")) {
      if (this.failNextTeamClaimWithUniqueViolation) {
        this.failNextTeamClaimWithUniqueViolation = false;
        throw Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
          constraint: "fantasy_teams_season_owner_user_key",
        });
      }

      const [seasonId, teamId, ownerId, userId, updatedAt] =
        values as readonly [string, string, string, string, Date];
      const team = this.teams.get(teamId);
      if (
        team === undefined ||
        team.league_season_id !== seasonId ||
        team.team_key !== ownerId ||
        (team.owner_user_id !== null && team.owner_user_id !== userId)
      ) {
        return { rows: [], rowCount: 0 };
      }

      const claimed = { ...team, owner_user_id: userId, updated_at: updatedAt };
      this.teams.set(teamId, claimed);

      return {
        rows: [{
          owner_user_id: userId,
          owner_id: ownerId,
          team_id: teamId,
        } as TRow],
        rowCount: 1,
      };
    }

    if (normalizedSql.startsWith("SELECT id, league_id, user_id, role FROM league_memberships")) {
      const [leagueId] = values as readonly [string];
      const rows = [...this.memberships.values()]
        .filter(membership => membership.league_id === leagueId && membership.status === "active")
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.id.localeCompare(b.id))
        .map(cloneMembership);

      return { rows: rows as TRow[] };
    }

    if (normalizedSql.startsWith("WITH latest_season AS")) {
      const [leagueId] = values as readonly [string];
      const latestSeason = [...this.seasons.values()]
        .filter(season => season.league_id === leagueId)
        .sort((a, b) =>
          b.season_year - a.season_year ||
          b.updated_at.getTime() - a.updated_at.getTime() ||
          b.id.localeCompare(a.id)
        )[0];
      if (latestSeason === undefined) return { rows: [] };
      const rows = [...this.teams.values()]
        .filter(team =>
          team.league_season_id === latestSeason.id && team.owner_user_id !== null
        )
        .sort((a, b) => a.display_order - b.display_order || a.id.localeCompare(b.id))
        .map(team => ({
          owner_user_id: team.owner_user_id,
          owner_id: team.team_key,
          team_id: team.id,
        } as TRow));

      return { rows };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }

  seasonRowForQuery(
    normalizedSql: string,
    values: readonly unknown[],
  ): (LeagueSeasonRow & Record<string, unknown>) | undefined {
    const season = normalizedSql.includes("WHERE s.id = $1")
      ? this.seasons.get(values[0] as string)
      : [...this.seasons.values()].find(candidate =>
        candidate.league_id === values[0] && candidate.season_year === values[1]
      );
    if (season === undefined) return undefined;
    const league = this.leagues.get(season.league_id);
    const rosterRules = this.rosterRulesBySeason.get(season.id);
    if (league === undefined) throw new Error("Missing fake league row.");

    return {
      id: season.id,
      league_id: season.league_id,
      season_year: season.season_year,
      name: season.name,
      status: season.status,
      settings_json: cloneSeason(season).settings_json,
      league_name: league.name,
      provider: league.provider,
      provider_league_id: league.provider_league_id,
      draft_format: rosterRules?.draft_format ?? null,
      budget: rosterRules?.budget ?? null,
      minimum_bid: rosterRules?.minimum_bid ?? null,
      snake_json: rosterRules === undefined ? null : cloneRosterRule(rosterRules).snake_json,
      slots_json: rosterRules === undefined ? null : cloneRosterRule(rosterRules).slots_json,
      position_maximums_json: rosterRules === undefined ? null : cloneRosterRule(rosterRules).position_maximums_json,
      scoring_json: rosterRules === undefined ? null : cloneRosterRule(rosterRules).scoring_json,
    };
  }
}

interface LeagueSeasonRow {
  id: string;
  league_id: string;
  season_year: number;
  name: string;
  status: string;
  settings_json: unknown;
  league_name: string;
  provider: string | null;
  provider_league_id: string | null;
  draft_format: string | null;
  budget: number | null;
  minimum_bid: number | null;
  snake_json: unknown;
  slots_json: unknown;
  position_maximums_json: unknown;
  scoring_json: unknown;
}

const buildSeason = (options: { seasonYear?: number; leagueName?: string } = {}): LeagueSeason =>
  buildCurrentMockdLeagueSeason(
    ownerOrder,
    leagueConfig,
    {
      ...(options.seasonYear === undefined ? {} : { seasonYear: options.seasonYear }),
      leagueName: options.leagueName ?? "League 214674",
      setupStatus: "published",
      draft: {
        scheduledAt: "2026-08-30T18:00:00.000Z",
        timezone: "America/New_York",
      },
    },
  );

const membershipsFor = (
  season: LeagueSeason,
  teamOwners: readonly string[],
): PlatformLeagueMembership[] =>
  teamOwners.map((owner, index) => {
    const team = season.teams.find(candidate => candidate.ownerDisplayName === owner);
    if (team === undefined) throw new Error(`Missing ${owner} team.`);

    return {
      userId: `acct_${owner.toLowerCase()}`,
      leagueId: season.leagueId,
      role: index === 0 ? "owner" : "member",
      ownerId: team.ownerId,
      teamId: team.id,
    };
  });

describe("Postgres league setup repository", () => {
  it("locks and enforces per-account league creation limits inside the registration transaction", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client, {
      maxActiveLeaguesPerAccount: 1,
      maxCreatedLeaguesPerWindow: 10,
      creationWindowMs: 60 * 60 * 1_000,
    });
    const firstSeason = buildSeason();
    await repository.registerLeagueSeason({
      season: firstSeason,
      memberships: membershipsFor(firstSeason, ["Cam"]),
      createdByUserId: "acct_cam",
      now,
    });
    const secondLeagueId = `${firstSeason.leagueId}-second`;
    const secondSeason = {
      ...firstSeason,
      id: `${firstSeason.id}-second`,
      leagueId: secondLeagueId,
      league: { ...firstSeason.league, id: secondLeagueId },
      teams: firstSeason.teams.map(team => ({
        ...team,
        id: `${team.id}-second`,
        leagueSeasonId: `${firstSeason.id}-second`,
      })),
    };

    await expect(repository.registerLeagueSeason({
      season: secondSeason,
      memberships: [{ userId: "acct_cam", leagueId: secondLeagueId, role: "owner" }],
      createdByUserId: "acct_cam",
      now: new Date(now.getTime() + 1),
    })).rejects.toThrow(new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    ));
    expect(client.queries.filter(query =>
      normalizeSql(query.text).startsWith("SELECT pg_advisory_xact_lock")
    )).toHaveLength(2);
    expect(client.leagues.has(secondLeagueId)).toBe(false);
  });

  it("round-trips seasons, teams, settings, and membership claims through normalized rows", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const memberships = membershipsFor(season, ["Cam", "Seth"]);

    const registered = await repository.registerLeagueSeason({
      season,
      memberships,
      createdByUserId: "acct_cam",
      now,
    });

    expect(registered).toEqual(season);
    expect(client.transactionCount).toBe(1);
    expect(client.leagues.get(season.leagueId)).toMatchObject({
      id: season.leagueId,
      name: "League 214674",
      provider: "mockd",
      provider_league_id: String(leagueConfig.leagueId),
      created_by_user_id: "acct_cam",
    });
    expect(client.seasons.get(season.id)).toMatchObject({
      id: season.id,
      league_id: season.leagueId,
      season_year: 2026,
      status: "published",
    });
    expect(client.rosterRulesBySeason.get(season.id)).toMatchObject({
      budget: leagueConfig.auctionBudget,
      minimum_bid: 1,
    });
    expect([...client.teams.values()]).toHaveLength(season.teams.length);
    expect([...client.memberships.values()]).toHaveLength(2);

    await expect(repository.findLeagueSeason(season.id)).resolves.toEqual(season);
    await expect(repository.findLeagueSeasonForLeagueYear(season.leagueId, 2026)).resolves.toEqual(season);
    await expect(repository.hasLeagueSeasonForLeague(season.leagueId)).resolves.toBe(true);
    await expect(repository.findMembership("acct_cam", season.leagueId)).resolves.toEqual(memberships[0]);
    await expect(repository.membershipsForLeague(season.leagueId)).resolves.toEqual(memberships);
  });

  it("round trips snake format, scoring, order, and reversal without auction settings", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const auctionSeason = buildSeason();
    const snakeSeason: AnyLeagueSeason = {
      ...auctionSeason,
      settings: {
        expectedTeamCount: auctionSeason.settings.expectedTeamCount,
        draftFormat: "snake",
        scoring: {
          ...auctionSeason.settings.scoring,
          passingTouchdown: 6,
          reception: 1,
        },
        snake: {
          rounds: 18,
          order: auctionSeason.teams.map(team => team.id),
          reversal: "third-round",
        },
        roster: auctionSeason.settings.roster,
        keeperPolicy: auctionSeason.settings.keeperPolicy,
      },
    };

    await repository.registerLeagueSeason({
      season: snakeSeason,
      memberships: [],
      createdByUserId: "acct_cam",
      now,
    });

    await expect(repository.findLeagueSeason(snakeSeason.id)).resolves.toEqual(snakeSeason);
    expect(client.rosterRulesBySeason.get(snakeSeason.id)).toMatchObject({
      budget: null,
      minimum_bid: null,
      draft_format: "snake",
      snake_json: snakeSeason.settings.snake,
      scoring_json: snakeSeason.settings.scoring,
    });
  });

  it("normalizes legacy auction settings before writing normalized rows", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const { draftFormat: _draftFormat, scoring: _scoring, ...legacySettings } = season.settings;
    const legacySeason: LeagueSeason = {
      ...season,
      settings: legacySettings,
    };

    const registered = await repository.registerLeagueSeason({
      season: legacySeason,
      memberships: [],
      createdByUserId: "acct_cam",
      now,
    });

    expect(registered).toEqual(season);
    expect(client.rosterRulesBySeason.get(season.id)).toMatchObject({
      draft_format: "auction",
      snake_json: null,
      scoring_json: leagueConfig.scoring,
    });
  });

  it("replaces same-league memberships and same-season teams without deleting other seasons", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season2026 = buildSeason();
    const season2027 = buildSeason({ seasonYear: 2027, leagueName: "League 214674 2027" });
    const camOnly = membershipsFor(season2026, ["Cam"]);
    const sethOnly = membershipsFor(season2027, ["Seth"]);

    await repository.registerLeagueSeason({
      season: season2026,
      memberships: camOnly,
      createdByUserId: "acct_cam",
      now,
    });
    for (const team of season2026.teams) {
      client.referencedTeamIds.add(team.id);
    }
    await repository.registerLeagueSeason({
      season: {
        ...season2026,
        teams: season2026.teams.map(team =>
          team.ownerDisplayName === "Cam" ? { ...team, displayName: "Cam Rebranded" } : team
        ),
      },
      memberships: camOnly,
      createdByUserId: "acct_cam",
      now: new Date(now.getTime() + 1_000),
    });
    await repository.registerLeagueSeason({
      season: season2027,
      memberships: sethOnly,
      createdByUserId: "acct_seth",
      now: new Date(now.getTime() + 2_000),
    });

    expect(client.seasons.has(season2026.id)).toBe(true);
    expect(client.seasons.has(season2027.id)).toBe(true);
    expect([...client.teams.values()].filter(team => team.league_season_id === season2026.id)).toHaveLength(season2026.teams.length);
    await expect(repository.membershipsForLeague(season2026.leagueId)).resolves.toEqual(sethOnly);
    await expect(repository.findLeagueSeason(season2026.id)).resolves.toMatchObject({
      id: season2026.id,
      teams: expect.arrayContaining([
        expect.objectContaining({
          ownerDisplayName: "Cam",
          displayName: "Cam Rebranded",
        }),
      ]),
    });
    await expect(repository.findLeagueSeason(season2027.id)).resolves.toEqual(season2027);
  });

  it("locks and rejects a setup write when the reviewed season changed", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const memberships = membershipsFor(season, ["Cam"]);
    await repository.registerLeagueSeason({ season, memberships, createdByUserId: "acct_cam", now });
    const reviewedRevision = leagueSeasonSetupRevision(season);
    await repository.registerLeagueSeason({
      season: { ...season, league: { ...season.league, name: "Changed elsewhere" } },
      memberships,
      createdByUserId: "acct_cam",
      now: new Date(now.getTime() + 1_000),
    });

    await expect(repository.registerLeagueSeason({
      season,
      memberships,
      createdByUserId: "acct_cam",
      expectedSetupRevision: reviewedRevision,
      now: new Date(now.getTime() + 2_000),
    })).rejects.toBeInstanceOf(LeagueSetupWriteConflictError);
    expect(client.queries.some(query =>
      normalizeSql(query.text).startsWith("SELECT id FROM league_seasons WHERE id = $1 FOR UPDATE")
        && query.inTransaction
    )).toBe(true);
  });

  it("preserves memberships and team claims during a reviewed identity-only setup update", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const initialMemberships = membershipsFor(season, ["Cam"]);
    await repository.registerLeagueSeason({
      season,
      memberships: initialMemberships,
      createdByUserId: "acct_cam",
      now,
    });
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (sethTeam === undefined) throw new Error("Expected Seth team.");
    client.memberships.set("membership-concurrent", {
      id: "membership-concurrent",
      league_id: season.leagueId,
      user_id: "acct_seth",
      role: "member",
      status: "active",
      created_at: new Date(now.getTime() + 500),
      updated_at: new Date(now.getTime() + 500),
    });
    client.teams.set(sethTeam.id, {
      ...client.teams.get(sethTeam.id)!,
      owner_user_id: "acct_seth",
    });

    await repository.registerLeagueSeason({
      season: {
        ...season,
        teams: season.teams.map(team => team.id === sethTeam.id
          ? { ...team, displayName: "Imported Seth Team", managerDisplayNames: ["Seth Manager"] }
          : team),
      },
      memberships: initialMemberships,
      membershipWriteMode: "preserve",
      expectedSetupRevision: leagueSeasonSetupRevision(season),
      createdByUserId: "acct_cam",
      now: new Date(now.getTime() + 1_000),
    });

    expect([...client.memberships.values()].map(row => row.user_id).sort()).toEqual(["acct_cam", "acct_seth"]);
    expect(client.teams.get(sethTeam.id)?.owner_user_id).toBe("acct_seth");
  });

  it("round trips imported abbreviations and co-manager identities", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    season.teams[0] = {
      ...season.teams[0]!,
      abbreviation: "CAM",
      managerDisplayNames: ["Cam Farina", "Co Manager"],
    };

    await repository.registerLeagueSeason({
      season,
      memberships: membershipsFor(season, ["Cam"]),
      createdByUserId: "acct_cam",
      now,
    });

    await expect(repository.findLeagueSeason(season.id)).resolves.toEqual(season);
  });

  it("does not resurrect an older team claim when the latest season leaves a member unclaimed", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season2026 = buildSeason();
    const season2027 = buildSeason({ seasonYear: 2027, leagueName: "League 214674 2027" });
    const camClaimed = membershipsFor(season2026, ["Cam"]);
    const camUnclaimed = [{
      userId: "acct_cam",
      leagueId: season2027.leagueId,
      role: "owner" as const,
    }];

    await repository.registerLeagueSeason({
      season: season2026,
      memberships: camClaimed,
      createdByUserId: "acct_cam",
      now,
    });
    await repository.registerLeagueSeason({
      season: season2027,
      memberships: camUnclaimed,
      createdByUserId: "acct_cam",
      now: new Date(now.getTime() + 1_000),
    });

    await expect(repository.membershipsForLeague(season2027.leagueId)).resolves.toEqual(camUnclaimed);
    await expect(repository.findMembership("acct_cam", season2027.leagueId)).resolves.toEqual(camUnclaimed[0]);
  });

  it("returns null when a concurrent same-user team claim hits the unique claim guard", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const camMembership = {
      userId: "acct_cam",
      leagueId: season.leagueId,
      role: "owner" as const,
    };
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    if (camTeam === undefined) throw new Error("Expected Cam team.");

    await repository.registerLeagueSeason({
      season,
      memberships: [camMembership],
      createdByUserId: "acct_cam",
      now,
    });

    client.failNextTeamClaimWithUniqueViolation = true;

    await expect(repository.claimLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: "acct_cam",
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      now: new Date(now.getTime() + 1_000),
    })).resolves.toBeNull();
  });

  it("keeps the existing team claim when switching to an unavailable team", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const camTeam = season.teams.find(team => team.ownerDisplayName === "Cam");
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (camTeam === undefined || sethTeam === undefined) throw new Error("Expected fixture teams.");
    await repository.registerLeagueSeason({
      season,
      memberships: [{ userId: "acct_cam", leagueId: season.leagueId, role: "owner" }],
      createdByUserId: "acct_cam",
      now,
    });
    await repository.claimLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: "acct_cam",
      ownerId: camTeam.ownerId,
      teamId: camTeam.id,
      now,
    });
    const unavailableTeam = client.teams.get(sethTeam.id);
    if (unavailableTeam === undefined) throw new Error("Expected target team row.");
    client.teams.set(sethTeam.id, { ...unavailableTeam, owner_user_id: "acct_seth" });

    await expect(repository.claimLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: "acct_cam",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      now: new Date(now.getTime() + 1_000),
    })).resolves.toBeNull();
    expect(client.teams.get(camTeam.id)?.owner_user_id).toBe("acct_cam");
    expect(client.teams.get(sethTeam.id)?.owner_user_id).toBe("acct_seth");
  });

  it("joins a league and claims its team in one transaction", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (sethTeam === undefined) throw new Error("Expected Seth team.");
    await repository.registerLeagueSeason({
      season,
      memberships: membershipsFor(season, ["Cam"]),
      createdByUserId: "acct_cam",
      now,
    });

    await expect(repository.joinLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: "acct_seth",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      role: "member",
      invitationTokenHash: "shared_token_hash",
      now: new Date(now.getTime() + 1_000),
    })).resolves.toEqual({
      userId: "acct_seth",
      leagueId: season.leagueId,
      role: "member",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
    });
    expect(client.teams.get(sethTeam.id)?.owner_user_id).toBe("acct_seth");
    expect([...client.memberships.values()]).toContainEqual(expect.objectContaining({
      league_id: season.leagueId,
      user_id: "acct_seth",
    }));
    expect(client.queries.slice(-4).every(query => query.inTransaction)).toBe(true);
    expect(client.queries.at(-4)?.text).toContain("FOR UPDATE");
  });

  it("does not create membership when a shared-link team claim loses a race", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (sethTeam === undefined) throw new Error("Expected Seth team.");
    await repository.registerLeagueSeason({
      season,
      memberships: membershipsFor(season, ["Cam"]),
      createdByUserId: "acct_cam",
      now,
    });
    client.teams.set(sethTeam.id, {
      ...client.teams.get(sethTeam.id)!,
      owner_user_id: "acct_winner",
    });

    await expect(repository.joinLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: "acct_loser",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      role: "member",
      invitationTokenHash: "shared_token_hash",
      now: new Date(now.getTime() + 1_000),
    })).resolves.toBeNull();
    expect([...client.memberships.values()].some(membership => membership.user_id === "acct_loser"))
      .toBe(false);
  });

  it("rejects a shared-link claim when its invitation is revoked before the transaction lock", async () => {
    const client = new FakePostgresLeagueSetupClient();
    const repository = new PostgresLeagueSetupRepository(client);
    const season = buildSeason();
    const sethTeam = season.teams.find(team => team.ownerDisplayName === "Seth");
    if (sethTeam === undefined) throw new Error("Expected Seth team.");
    await repository.registerLeagueSeason({
      season,
      memberships: membershipsFor(season, ["Cam"]),
      createdByUserId: "acct_cam",
      now,
    });
    client.invitationAvailable = false;

    await expect(repository.joinLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: "acct_seth",
      ownerId: sethTeam.ownerId,
      teamId: sethTeam.id,
      role: "member",
      invitationTokenHash: "revoked_token_hash",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toMatchObject({
      code: "invitation_unavailable",
    } satisfies Partial<PlatformInvitationError>);
    expect(client.teams.get(sethTeam.id)?.owner_user_id).toBeNull();
    expect([...client.memberships.values()].some(membership => membership.user_id === "acct_seth"))
      .toBe(false);
  });
});
