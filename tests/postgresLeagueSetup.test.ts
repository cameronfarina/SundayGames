import { describe, expect, it } from "vitest";
import { leagueConfig, ownerOrder } from "../config/league.js";
import {
  buildCurrentMockdLeagueSeason,
  type LeagueSeason,
} from "../src/platform/leagueSeason.js";
import type {
  PlatformLeagueMembership,
} from "../src/platform/leagueSetup.js";
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
  owner_user_id: string | null;
  display_order: number;
  aliases_json: unknown;
  created_at: Date;
  updated_at: Date;
}

interface RosterRuleRow {
  id: string;
  league_season_id: string;
  budget: number;
  minimum_bid: number;
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
  created_at: cloneDate(row.created_at),
  updated_at: cloneDate(row.updated_at),
});

const cloneRosterRule = (row: RosterRuleRow): RosterRuleRow => ({
  ...row,
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
  transactionCount = 0;

  #inTransaction = false;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    this.#inTransaction = true;
    try {
      return await operation(this);
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
      const [id, seasonId, teamKey, teamName, ownerName, ownerUserId, displayOrder, updatedAt] =
        values as readonly [string, string, string, string, string, string | null, number, Date];
      const existing = this.teams.get(id);
      this.teams.set(id, {
        id,
        league_season_id: seasonId,
        team_key: teamKey,
        team_name: teamName,
        owner_name: ownerName,
        owner_user_id: ownerUserId,
        display_order: displayOrder,
        aliases_json: [],
        created_at: existing?.created_at ?? updatedAt,
        updated_at: updatedAt,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("INSERT INTO roster_rule_sets")) {
      const [id, seasonId, budget, minimumBid, slotsJson, positionMaximumsJson, updatedAt] =
        values as readonly [string, string, number, number, string, string, Date];
      const existing = this.rosterRulesBySeason.get(seasonId);
      this.rosterRulesBySeason.set(seasonId, {
        id,
        league_season_id: seasonId,
        budget,
        minimum_bid: minimumBid,
        slots_json: jsonValue(slotsJson),
        position_maximums_json: jsonValue(positionMaximumsJson),
        scoring_json: {},
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
      this.memberships.set(id, {
        id,
        league_id: leagueId,
        user_id: userId,
        role,
        status: "active",
        created_at: updatedAt,
        updated_at: updatedAt,
      });

      return { rows: [], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT id FROM league_seasons WHERE league_id = $1")) {
      const [leagueId] = values as readonly [string];
      const row = [...this.seasons.values()].find(season => season.league_id === leagueId);

      return { rows: row === undefined ? [] : [{ id: row.id } as TRow] };
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
      budget: rosterRules?.budget ?? null,
      minimum_bid: rosterRules?.minimum_bid ?? null,
      slots_json: rosterRules === undefined ? null : cloneRosterRule(rosterRules).slots_json,
      position_maximums_json: rosterRules === undefined ? null : cloneRosterRule(rosterRules).position_maximums_json,
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
  budget: number | null;
  minimum_bid: number | null;
  slots_json: unknown;
  position_maximums_json: unknown;
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
});
