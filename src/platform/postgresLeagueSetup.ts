import type { Position } from "../../config/league.js";
import type {
  AuctionSettings,
  ExplicitLeagueSeasonSettings,
  FantasyTeam,
  KeeperPolicy,
  League,
  LeagueProvider,
  LeagueSeason,
  LeagueSeasonDraftSchedule,
  LeagueSeasonSetupStatus,
  LineupSettings,
  RosterMaximums,
  RosterRules,
  ScoringSettings,
  SnakeSettings,
} from "./leagueSeason.js";
import {
  defaultScoringSettings,
  normalizeLeagueSeasonSettings,
} from "./leagueSeason.js";
import {
  type ClaimLeagueSeasonTeamRepositoryInput,
  LeagueSetupWriteConflictError,
  type LeagueSetupRepository,
  leagueSeasonSetupRevision,
  type PlatformLeagueMembership,
  type RegisterLeagueSeasonRepositoryInput,
} from "./leagueSetup.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";
import type { WorkspaceRole } from "./workspacePrivacy.js";

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

interface FantasyTeamRow {
  id: string;
  league_season_id: string;
  team_key: string;
  team_name: string;
  owner_name: string;
  abbreviation: string | null;
  manager_names_json: unknown;
  display_order: number;
}

interface MembershipRow {
  id: string;
  league_id: string;
  user_id: string;
  role: string;
}

interface TeamClaimRow {
  owner_user_id: string;
  owner_id: string;
  team_id: string;
}

interface MaxDisplayOrderRow {
  max_display_order: number | null;
}

const positions = ["QB", "RB", "WR", "TE", "K", "DST"] as const satisfies readonly Position[];
const defaultKeeperPolicy: KeeperPolicy = {
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
};
const defaultLineup: LineupSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 7,
};
const defaultRosterMaximums: RosterMaximums = {
  QB: 4,
  RB: 8,
  WR: 8,
  TE: 4,
  K: 2,
  DST: 2,
};

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const teamClaimUniqueConstraint = "fantasy_teams_season_owner_user_key";

const isTeamClaimUniqueViolation = (error: unknown): boolean =>
  error !== null &&
  typeof error === "object" &&
  "code" in error &&
  "constraint" in error &&
  error.code === "23505" &&
  error.constraint === teamClaimUniqueConstraint;

class TeamClaimUnavailableError extends Error {}

const jsonbParameter = (value: unknown): string => JSON.stringify(value);

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonObjectFromDb = (value: unknown): Record<string, unknown> => {
  if (value === undefined || value === null) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return cloneJson(value) as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  return {};
};

const stringArrayFromDb = (value: unknown): string[] => {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }

  return Array.isArray(parsed)
    ? parsed.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
};

const providerFromDb = (value: string | null): LeagueProvider => {
  if (value === "espn" || value === "sleeper" || value === "yahoo" || value === "mockd") return value;

  return "mockd";
};

const statusFromDb = (value: string): LeagueSeasonSetupStatus => {
  if (value === "published" || value === "locked") return value;

  return "draft";
};

const workspaceRoleFromDb = (value: string): WorkspaceRole => {
  if (value === "owner" || value === "admin" || value === "observer") return value;

  return "member";
};

const numberFromObject = (
  record: Record<string, unknown>,
  key: string,
  fallback: number,
): number => {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

const stringFromObject = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const lineupFromDb = (value: unknown): LineupSettings => {
  const record = jsonObjectFromDb(value);
  const candidate = jsonObjectFromDb(record.lineup);
  const lineup: LineupSettings = {};

  for (const [slot, count] of Object.entries(candidate)) {
    if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
      lineup[slot] = count;
    }
  }

  return Object.keys(lineup).length === 0 ? { ...defaultLineup } : lineup;
};

const rosterMaximumsFromDb = (value: unknown): RosterMaximums => {
  const record = jsonObjectFromDb(value);
  const maximums: Partial<RosterMaximums> = {};

  for (const position of positions) {
    const valueForPosition = record[position];
    maximums[position] = typeof valueForPosition === "number" && Number.isFinite(valueForPosition)
      ? valueForPosition
      : defaultRosterMaximums[position];
  }

  return maximums as RosterMaximums;
};

const keeperPolicyFromDb = (value: unknown): KeeperPolicy => {
  const record = jsonObjectFromDb(value);
  const policy = jsonObjectFromDb(record.keeperPolicy);
  if (
    policy.mode === "previous-cost-multiplier" &&
    typeof policy.multiplier === "number" &&
    policy.rounding === "ceil"
  ) {
    return {
      mode: "previous-cost-multiplier",
      multiplier: policy.multiplier,
      rounding: "ceil",
    };
  }

  return { ...defaultKeeperPolicy };
};

const scoringFromDb = (value: unknown): ScoringSettings => {
  const record = jsonObjectFromDb(value);

  return {
    passingYards: numberFromObject(record, "passingYards", defaultScoringSettings.passingYards),
    passingTouchdown: numberFromObject(record, "passingTouchdown", defaultScoringSettings.passingTouchdown),
    rushingYards: numberFromObject(record, "rushingYards", defaultScoringSettings.rushingYards),
    rushingTouchdown: numberFromObject(record, "rushingTouchdown", defaultScoringSettings.rushingTouchdown),
    receivingYards: numberFromObject(record, "receivingYards", defaultScoringSettings.receivingYards),
    receivingTouchdown: numberFromObject(record, "receivingTouchdown", defaultScoringSettings.receivingTouchdown),
    reception: numberFromObject(record, "reception", defaultScoringSettings.reception),
  };
};

const snakeSettingsFromDb = (value: unknown): SnakeSettings => {
  const record = jsonObjectFromDb(value);
  const reversal = record.reversal === "third-round" ? "third-round" : "standard";

  return {
    rounds: numberFromObject(record, "rounds", 0),
    order: stringArrayFromDb(record.order),
    reversal,
  };
};

const draftScheduleFromDb = (value: unknown): LeagueSeasonDraftSchedule | undefined => {
  const record = jsonObjectFromDb(value);
  const draft = jsonObjectFromDb(record.draft);
  const scheduledAt = stringFromObject(draft, "scheduledAt");
  const timezone = stringFromObject(draft, "timezone");

  if (scheduledAt === undefined && timezone === undefined) return undefined;

  return {
    ...(scheduledAt === undefined ? {} : { scheduledAt }),
    ...(timezone === undefined ? {} : { timezone }),
  };
};

const settingsJsonFor = (season: LeagueSeason): Record<string, unknown> => ({
  expectedTeamCount: season.settings.expectedTeamCount,
  keeperPolicy: season.settings.keeperPolicy,
  ...(season.draft === undefined ? {} : { draft: season.draft }),
});

const slotsJsonFor = (rules: RosterRules): Record<string, unknown> => ({
  rosterSize: rules.rosterSize,
  lineup: rules.lineup,
  lineupSlotCount: rules.lineupSlotCount,
});

const teamOwnerUserIdFor = (
  team: FantasyTeam,
  leagueId: string,
  memberships: readonly PlatformLeagueMembership[],
): string | null =>
  memberships.find(membership =>
    membership.ownerId === team.ownerId &&
    membership.teamId === team.id &&
    membership.leagueId === leagueId
  )?.userId ?? null;

const membershipIdFor = (leagueId: string, userId: string): string => `league_membership:${leagueId}:${userId}`;

const rosterRuleSetIdFor = (seasonId: string): string => `${seasonId}:roster-rules`;

const selectLeagueSeasonSql = `
SELECT
  s.id,
  s.league_id,
  s.season_year,
  s.name,
  s.status,
  s.settings_json,
  l.name AS league_name,
  l.provider,
  l.provider_league_id,
  r.draft_format,
  r.budget,
  r.minimum_bid,
  r.snake_json,
  r.slots_json,
  r.position_maximums_json,
  r.scoring_json
FROM league_seasons s
JOIN leagues l ON l.id = s.league_id
LEFT JOIN roster_rule_sets r ON r.league_season_id = s.id
`.trim();

export class PostgresLeagueSetupRepository implements LeagueSetupRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): Promise<LeagueSeason> {
    const now = input.now ?? new Date();
    const season = cloneJson(input.season);
    season.settings = normalizeLeagueSeasonSettings(season.settings);

    return await this.#client.transaction(async transactionClient => {
      if (input.expectedSetupRevision !== undefined) {
        await transactionClient.query(
          "SELECT id FROM league_seasons WHERE id = $1 FOR UPDATE",
          [season.id],
        );
        const currentSeason = await this.#findLeagueSeason(transactionClient, season.id);
        if (
          currentSeason === null ||
          leagueSeasonSetupRevision(currentSeason) !== input.expectedSetupRevision
        ) {
          throw new LeagueSetupWriteConflictError();
        }
      }
      await this.#upsertLeague(transactionClient, season, input.createdByUserId, now);
      await this.#upsertSeason(transactionClient, season, now);
      await this.#replaceTeams(
        transactionClient,
        season,
        input.memberships,
        input.membershipWriteMode === "preserve",
        now,
      );
      await this.#upsertRosterRules(transactionClient, season, now);
      if (input.membershipWriteMode !== "preserve") {
        await this.#replaceMemberships(transactionClient, season.leagueId, input.memberships, now);
      }

      const registeredSeason = await this.#findLeagueSeason(transactionClient, season.id);
      if (registeredSeason === null) {
        throw new Error("Postgres league setup insert did not return a registered season.");
      }

      return registeredSeason;
    });
  }

  async claimLeagueSeasonTeam(input: ClaimLeagueSeasonTeamRepositoryInput): Promise<PlatformLeagueMembership | null> {
    const now = input.now ?? new Date();

    try {
      return await this.#client.transaction(async transactionClient => {
        const membershipResult = await transactionClient.query<MembershipRow>(
          `
SELECT id, league_id, user_id, role
FROM league_memberships
WHERE league_id = $1 AND user_id = $2 AND status = 'active'
LIMIT 1
`.trim(),
          [input.leagueId, input.userId],
        );
        const membership = firstRow(membershipResult);
        if (membership === undefined) return null;

        const targetTeamResult = await transactionClient.query<{ id: string }>(
          `
SELECT id
FROM fantasy_teams
WHERE league_season_id = $1 AND id = $2 AND team_key = $3
LIMIT 1
`.trim(),
          [input.seasonId, input.teamId, input.ownerId],
        );
        if (firstRow(targetTeamResult) === undefined) return null;

        await transactionClient.query(
          `
UPDATE fantasy_teams
SET owner_user_id = NULL,
    updated_at = $4
WHERE league_season_id = $1
  AND owner_user_id = $2
  AND id <> $3;
`.trim(),
          [input.seasonId, input.userId, input.teamId, now],
        );

        const claimedResult = await transactionClient.query<TeamClaimRow>(
          `
UPDATE fantasy_teams
SET owner_user_id = $4,
    updated_at = $5
WHERE league_season_id = $1
  AND id = $2
  AND team_key = $3
  AND (owner_user_id IS NULL OR owner_user_id = $4)
RETURNING owner_user_id, team_key AS owner_id, id AS team_id;
`.trim(),
          [input.seasonId, input.teamId, input.ownerId, input.userId, now],
        );
        const claim = firstRow(claimedResult);
        if (claim === undefined) throw new TeamClaimUnavailableError();

        return {
          userId: membership.user_id,
          leagueId: membership.league_id,
          role: workspaceRoleFromDb(membership.role),
          ownerId: claim.owner_id,
          teamId: claim.team_id,
        };
      });
    } catch (error) {
      if (error instanceof TeamClaimUnavailableError || isTeamClaimUniqueViolation(error)) return null;

      throw error;
    }
  }

  async findLeagueSeason(seasonId: string): Promise<LeagueSeason | null> {
    return await this.#findLeagueSeason(this.#client, seasonId);
  }

  async hasLeagueSeasonForLeague(leagueId: string): Promise<boolean> {
    const result = await this.#client.query<{ id: string }>(
      "SELECT id FROM league_seasons WHERE league_id = $1 LIMIT 1",
      [leagueId],
    );

    return firstRow(result) !== undefined;
  }

  async findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): Promise<LeagueSeason | null> {
    const result = await this.#client.query<LeagueSeasonRow>(
      `${selectLeagueSeasonSql} WHERE s.league_id = $1 AND s.season_year = $2`,
      [leagueId, seasonYear],
    );
    const row = firstRow(result);

    return row === undefined ? null : await this.#seasonFromRow(this.#client, row);
  }

  async findMembership(userId: string, leagueId: string): Promise<PlatformLeagueMembership | null> {
    const memberships = await this.membershipsForLeague(leagueId);

    return memberships.find(membership => membership.userId === userId) ?? null;
  }

  async membershipsForLeague(leagueId: string): Promise<readonly PlatformLeagueMembership[]> {
    const membershipsResult = await this.#client.query<MembershipRow>(
      `
SELECT id, league_id, user_id, role
FROM league_memberships
WHERE league_id = $1 AND status = 'active'
ORDER BY created_at ASC, id ASC
`.trim(),
      [leagueId],
    );
    const claims = await this.#teamClaimsForLeague(this.#client, leagueId);

    return membershipsResult.rows.map(row => {
      const claim = claims.get(row.user_id);

      return {
        userId: row.user_id,
        leagueId: row.league_id,
        role: workspaceRoleFromDb(row.role),
        ...(claim === undefined
          ? {}
          : {
            ownerId: claim.ownerId,
            teamId: claim.teamId,
          }),
      };
    });
  }

  async #upsertLeague(
    client: PostgresQueryClient,
    season: LeagueSeason,
    createdByUserId: string,
    now: Date,
  ): Promise<void> {
    await client.query(
      `
INSERT INTO leagues (
  id,
  name,
  sport,
  provider,
  provider_league_id,
  created_by_user_id,
  created_at,
  updated_at
) VALUES ($1, $2, 'football', $3, $4, $5, $6, $6)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  provider_league_id = EXCLUDED.provider_league_id,
  updated_at = EXCLUDED.updated_at;
`.trim(),
      [
        season.league.id,
        season.league.name,
        season.league.provider,
        season.league.externalLeagueId,
        createdByUserId,
        now,
      ],
    );
  }

  async #upsertSeason(
    client: PostgresQueryClient,
    season: LeagueSeason,
    now: Date,
  ): Promise<void> {
    await client.query(
      `
INSERT INTO league_seasons (
  id,
  league_id,
  season_year,
  name,
  status,
  settings_json,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $7)
ON CONFLICT (id) DO UPDATE SET
  league_id = EXCLUDED.league_id,
  season_year = EXCLUDED.season_year,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  settings_json = EXCLUDED.settings_json,
  updated_at = EXCLUDED.updated_at;
`.trim(),
      [
        season.id,
        season.leagueId,
        season.seasonYear,
        season.league.name,
        season.setupStatus,
        jsonbParameter(settingsJsonFor(season)),
        now,
      ],
    );
  }

  async #replaceTeams(
    client: PostgresQueryClient,
    season: LeagueSeason,
    memberships: readonly PlatformLeagueMembership[],
    preserveTeamClaims: boolean,
    now: Date,
  ): Promise<void> {
    await this.#shiftExistingTeamDisplayOrders(client, season, now);

    for (const team of season.teams) {
      await client.query(
        `
INSERT INTO fantasy_teams (
  id,
  league_season_id,
  team_key,
  team_name,
  owner_name,
  abbreviation,
  manager_names_json,
  owner_user_id,
  display_order,
  aliases_json,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, '[]'::jsonb, $10, $10)
ON CONFLICT (id) DO UPDATE SET
  league_season_id = EXCLUDED.league_season_id,
  team_key = EXCLUDED.team_key,
  team_name = EXCLUDED.team_name,
  owner_name = EXCLUDED.owner_name,
  abbreviation = EXCLUDED.abbreviation,
  manager_names_json = EXCLUDED.manager_names_json,
  owner_user_id = ${preserveTeamClaims ? "fantasy_teams.owner_user_id" : "EXCLUDED.owner_user_id"},
  display_order = EXCLUDED.display_order,
  updated_at = EXCLUDED.updated_at;
`.trim(),
        [
          team.id,
          season.id,
          team.ownerId,
          team.displayName,
          team.ownerDisplayName,
          team.abbreviation ?? null,
          jsonbParameter(team.managerDisplayNames ?? []),
          preserveTeamClaims ? null : teamOwnerUserIdFor(team, season.leagueId, memberships),
          team.draftOrderPosition,
          now,
        ],
      );
    }

    await client.query(
      `
DELETE FROM fantasy_teams
WHERE league_season_id = $1 AND NOT (id = ANY($2::text[]));
`.trim(),
      [season.id, season.teams.map(team => team.id)],
    );
  }

  async #shiftExistingTeamDisplayOrders(
    client: PostgresQueryClient,
    season: LeagueSeason,
    now: Date,
  ): Promise<void> {
    const currentMaxResult = await client.query<MaxDisplayOrderRow>(
      `
SELECT COALESCE(MAX(display_order), 0)::integer AS max_display_order
FROM fantasy_teams
WHERE league_season_id = $1;
`.trim(),
      [season.id],
    );
    const currentMaxDisplayOrder = firstRow(currentMaxResult)?.max_display_order ?? 0;
    if (currentMaxDisplayOrder === 0) return;

    const nextMaxDisplayOrder = season.teams.reduce(
      (max, team) => Math.max(max, team.draftOrderPosition),
      0,
    );
    const offset = currentMaxDisplayOrder + nextMaxDisplayOrder + season.teams.length + 1;

    await client.query(
      `
UPDATE fantasy_teams
SET display_order = display_order + $2,
    updated_at = $3
WHERE league_season_id = $1;
`.trim(),
      [season.id, offset, now],
    );
  }

  async #upsertRosterRules(
    client: PostgresQueryClient,
    season: LeagueSeason,
    now: Date,
  ): Promise<void> {
    await client.query(
      `
INSERT INTO roster_rule_sets (
  id,
  league_season_id,
  draft_format,
  budget,
  minimum_bid,
  snake_json,
  slots_json,
  position_maximums_json,
  scoring_json,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $10)
ON CONFLICT ON CONSTRAINT roster_rule_sets_league_season_key DO UPDATE SET
  draft_format = EXCLUDED.draft_format,
  budget = EXCLUDED.budget,
  minimum_bid = EXCLUDED.minimum_bid,
  snake_json = EXCLUDED.snake_json,
  slots_json = EXCLUDED.slots_json,
  position_maximums_json = EXCLUDED.position_maximums_json,
  scoring_json = EXCLUDED.scoring_json,
  updated_at = EXCLUDED.updated_at;
`.trim(),
      [
        rosterRuleSetIdFor(season.id),
        season.id,
        season.settings.draftFormat,
        season.settings.draftFormat === "auction" ? season.settings.auction.budgetDollars : null,
        season.settings.draftFormat === "auction" ? season.settings.auction.minimumBidDollars : null,
        season.settings.draftFormat === "snake" ? jsonbParameter(season.settings.snake) : null,
        jsonbParameter(slotsJsonFor(season.settings.roster)),
        jsonbParameter(season.settings.roster.rosterMaximums),
        jsonbParameter(season.settings.scoring),
        now,
      ],
    );
  }

  async #replaceMemberships(
    client: PostgresQueryClient,
    leagueId: string,
    memberships: readonly PlatformLeagueMembership[],
    now: Date,
  ): Promise<void> {
    await client.query("DELETE FROM league_memberships WHERE league_id = $1", [leagueId]);

    for (const membership of memberships) {
      await client.query(
        `
INSERT INTO league_memberships (
  id,
  league_id,
  user_id,
  role,
  status,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, 'active', $5, $5);
`.trim(),
        [
          membershipIdFor(membership.leagueId, membership.userId),
          membership.leagueId,
          membership.userId,
          membership.role,
          now,
        ],
      );
    }
  }

  async #findLeagueSeason(
    client: PostgresQueryClient,
    seasonId: string,
  ): Promise<LeagueSeason | null> {
    const result = await client.query<LeagueSeasonRow>(
      `${selectLeagueSeasonSql} WHERE s.id = $1`,
      [seasonId],
    );
    const row = firstRow(result);

    return row === undefined ? null : await this.#seasonFromRow(client, row);
  }

  async #seasonFromRow(
    client: PostgresQueryClient,
    row: LeagueSeasonRow,
  ): Promise<LeagueSeason> {
    const teams = await this.#teamsForSeason(client, row.id);
    const settingsJson = jsonObjectFromDb(row.settings_json);
    const slotsJson = jsonObjectFromDb(row.slots_json);
    const lineup = lineupFromDb(slotsJson);
    const rosterSize = numberFromObject(slotsJson, "rosterSize", Object.values(lineup).reduce((sum, count) => sum + count, 0));
    const lineupSlotCount = numberFromObject(slotsJson, "lineupSlotCount", Object.values(lineup).reduce((sum, count) => sum + count, 0));
    const roster: RosterRules = {
      rosterSize,
      lineup,
      lineupSlotCount,
      rosterMaximums: rosterMaximumsFromDb(row.position_maximums_json),
    };
    const league: League = {
      id: row.league_id,
      externalLeagueId: row.provider_league_id ?? row.league_id,
      name: row.league_name,
      provider: providerFromDb(row.provider),
    };
    const draft = draftScheduleFromDb(row.settings_json);
    const expectedTeamCount = numberFromObject(settingsJson, "expectedTeamCount", teams.length);
    const scoring = scoringFromDb(row.scoring_json);
    const keeperPolicy = keeperPolicyFromDb(settingsJson);
    const settings: ExplicitLeagueSeasonSettings = row.draft_format === "snake"
      ? {
        expectedTeamCount,
        draftFormat: "snake",
        scoring,
        snake: snakeSettingsFromDb(row.snake_json),
        roster,
        keeperPolicy,
      }
      : {
        expectedTeamCount,
        draftFormat: "auction",
        scoring,
        auction: {
          budgetDollars: row.budget ?? 200,
          minimumBidDollars: row.minimum_bid ?? 1,
        } satisfies AuctionSettings,
        roster,
        keeperPolicy,
      };

    return {
      id: row.id,
      league,
      leagueId: row.league_id,
      seasonYear: Number(row.season_year),
      teams,
      settings,
      setupStatus: statusFromDb(row.status),
      ...(draft === undefined ? {} : { draft }),
    };
  }

  async #teamsForSeason(
    client: PostgresQueryClient,
    seasonId: string,
  ): Promise<FantasyTeam[]> {
    const result = await client.query<FantasyTeamRow>(
      `
SELECT id, league_season_id, team_key, team_name, owner_name, abbreviation, manager_names_json, display_order
FROM fantasy_teams
WHERE league_season_id = $1
ORDER BY display_order ASC, id ASC
`.trim(),
      [seasonId],
    );

    return result.rows.map(row => {
      const managerDisplayNames = stringArrayFromDb(row.manager_names_json);
      const abbreviation = typeof row.abbreviation === "string" ? row.abbreviation.trim() : "";

      return {
        id: row.id,
        leagueSeasonId: row.league_season_id,
        ownerId: row.team_key,
        ownerDisplayName: row.owner_name,
        ...(managerDisplayNames.length === 0 ? {} : { managerDisplayNames }),
        ...(abbreviation.length === 0 ? {} : { abbreviation }),
        displayName: row.team_name,
        draftOrderPosition: Number(row.display_order),
      };
    });
  }

  async #teamClaimsForLeague(
    client: PostgresQueryClient,
    leagueId: string,
  ): Promise<ReadonlyMap<string, { ownerId: string; teamId: string }>> {
    const result = await client.query<TeamClaimRow>(
      `
WITH latest_season AS (
  SELECT id
  FROM league_seasons
  WHERE league_id = $1
  ORDER BY season_year DESC, updated_at DESC, id DESC
  LIMIT 1
)
SELECT
  ft.owner_user_id,
  ft.team_key AS owner_id,
  ft.id AS team_id
FROM fantasy_teams ft
JOIN latest_season s ON s.id = ft.league_season_id
WHERE ft.owner_user_id IS NOT NULL
ORDER BY ft.display_order ASC, ft.id ASC
`.trim(),
      [leagueId],
    );
    const claimsByUserId = new Map<string, { ownerId: string; teamId: string }>();

    for (const row of result.rows) {
      if (!claimsByUserId.has(row.owner_user_id)) {
        claimsByUserId.set(row.owner_user_id, {
          ownerId: row.owner_id,
          teamId: row.team_id,
        });
      }
    }

    return claimsByUserId;
  }
}
