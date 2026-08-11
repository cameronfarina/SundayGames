import type { AuthRepository } from "./auth.js";
import {
  liveDraftRoomSetupContentHash,
  type LiveDraftRoomSetupRepository,
  type SaveLiveDraftRoomSetupInput,
} from "./liveDraftRoomSetups.js";
import type { LeagueSetupRepository, PlatformLeagueMembership } from "./leagueSetup.js";
import type {
  ProductionProvisioningChange,
  ProductionProvisioningContext,
  ProductionProvisioningInspection,
  ProductionProvisioningRepository,
  ResolvedProductionProvisioningDocument,
} from "./productionProvisioning.js";
import type { PostgresQueryClient } from "./postgresPlatformStore.js";

interface PostgresProductionProvisioningRepositoryOptions {
  client: PostgresQueryClient;
  authRepository: AuthRepository;
  leagueSetupRepository: LeagueSetupRepository;
  draftSetupRepository: LiveDraftRoomSetupRepository;
}

interface PlayerRow {
  id: string;
  provider: string | null;
  provider_player_id: string | null;
  canonical_name: string;
  position: string;
  nfl_team: string | null;
  bye_week: number | null;
  active: boolean;
}

interface KeeperRow {
  id: string;
  fantasy_team_id: string;
  player_id: string;
  player_name: string;
  position: string;
  keeper_cost: number;
  previous_cost: number | null;
  status: string;
  source: string;
}

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
};

const sameValue = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);

const change = (
  resourceType: string,
  resourceId: string,
  action: ProductionProvisioningChange["action"],
): ProductionProvisioningChange => ({ resourceType, resourceId, action });

const normalizedMemberships = (
  memberships: readonly PlatformLeagueMembership[],
): readonly PlatformLeagueMembership[] => [...memberships]
  .map(membership => ({
    userId: membership.userId,
    leagueId: membership.leagueId,
    role: membership.role,
    ...(membership.ownerId === undefined ? {} : { ownerId: membership.ownerId }),
    ...(membership.teamId === undefined ? {} : { teamId: membership.teamId }),
  }))
  .sort((left, right) => left.userId.localeCompare(right.userId));

const draftSetupInputFor = (
  document: ResolvedProductionProvisioningDocument,
): SaveLiveDraftRoomSetupInput => ({
  seasonId: document.season.id,
  sourceVersion: document.provisioningId,
  playerCatalog: document.catalog.map(player => ({
    name: player.name,
    position: player.position,
    expectedPrice: player.expectedPrice,
    ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
    ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
  })),
  initialRosters: document.initialRosters.map(player => ({
    teamId: player.teamId,
    playerName: player.playerName,
    position: player.position,
    price: player.price,
    ...(player.expectedPrice === undefined ? {} : { expectedPrice: player.expectedPrice }),
    ...(player.source === undefined ? {} : { source: player.source }),
  })),
});

const seasonComparable = (document: ResolvedProductionProvisioningDocument): unknown => ({
  id: document.season.id,
  league: document.season.league,
  leagueId: document.season.leagueId,
  seasonYear: document.season.seasonYear,
  teams: document.season.teams,
  settings: document.season.settings,
  setupStatus: document.season.setupStatus,
  ...(document.season.draft === undefined ? {} : { draft: document.season.draft }),
});

export class PostgresProductionProvisioningRepository implements ProductionProvisioningRepository {
  readonly #client: PostgresQueryClient;
  readonly #authRepository: AuthRepository;
  readonly #leagueSetupRepository: LeagueSetupRepository;
  readonly #draftSetupRepository: LiveDraftRoomSetupRepository;

  constructor(options: PostgresProductionProvisioningRepositoryOptions) {
    this.#client = options.client;
    this.#authRepository = options.authRepository;
    this.#leagueSetupRepository = options.leagueSetupRepository;
    this.#draftSetupRepository = options.draftSetupRepository;
  }

  async inspect(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<ProductionProvisioningInspection> {
    const changes: ProductionProvisioningChange[] = [];
    const conflicts: string[] = [];

    for (const account of document.accounts) {
      const [accountById, credentialByEmail] = await Promise.all([
        this.#authRepository.findAccountById(account.id),
        this.#authRepository.findAccountCredentialByEmail(account.email),
      ]);
      if (accountById === null && credentialByEmail === null) {
        changes.push(change("account", account.id, "create"));
        continue;
      }
      if (
        accountById?.email === account.email &&
        credentialByEmail?.account.id === account.id &&
        credentialByEmail.passwordHash === account.passwordHash
      ) {
        changes.push(change("account", account.id, "unchanged"));
        continue;
      }

      conflicts.push(`Account ${account.id} or email ${account.email} already belongs to different production data.`);
      changes.push(change("account", account.id, "unchanged"));
    }

    const [seasonById, seasonForYear, existingMemberships] = await Promise.all([
      this.#leagueSetupRepository.findLeagueSeason(document.season.id),
      this.#leagueSetupRepository.findLeagueSeasonForLeagueYear(
        document.league.id,
        document.season.seasonYear,
      ),
      this.#leagueSetupRepository.membershipsForLeague(document.league.id),
    ]);
    if (seasonById === null) {
      if (seasonForYear !== null) {
        conflicts.push(
          `League ${document.league.id} already has season ${seasonForYear.id} for ${document.season.seasonYear}.`,
        );
      }
      if (existingMemberships.length > 0) {
        conflicts.push(`League ${document.league.id} already has memberships outside this provisioning receipt.`);
      }
      changes.push(change("league-season", document.season.id, "create"));
    } else if (!sameValue(seasonComparable(document), seasonById)) {
      conflicts.push(`League season ${document.season.id} differs from the provisioning document.`);
      changes.push(change("league-season", document.season.id, "unchanged"));
    } else if (!sameValue(normalizedMemberships(existingMemberships), normalizedMemberships(document.memberships))) {
      conflicts.push(`League memberships for ${document.league.id} differ from the provisioning document.`);
      changes.push(change("league-season", document.season.id, "unchanged"));
    } else {
      changes.push(change("league-season", document.season.id, "unchanged"));
    }

    const draftSetupInput = draftSetupInputFor(document);
    const existingDraftSetup = await this.#draftSetupRepository.findForSeason(document.season.id);
    if (existingDraftSetup === null) {
      changes.push(change("season-draft-setup", document.season.id, "create"));
    } else if (
      existingDraftSetup.sourceVersion === draftSetupInput.sourceVersion &&
      existingDraftSetup.contentHash === liveDraftRoomSetupContentHash(draftSetupInput)
    ) {
      changes.push(change("season-draft-setup", document.season.id, "unchanged"));
    } else {
      conflicts.push(`Season draft setup ${document.season.id} differs from the provisioning document.`);
      changes.push(change("season-draft-setup", document.season.id, "unchanged"));
    }

    const playerResult = await this.#client.query<PlayerRow>(
      `
SELECT id, provider, provider_player_id, canonical_name, position, nfl_team, bye_week, active
FROM players
WHERE id = ANY($1::text[])
`.trim(),
      [document.catalog.map(player => player.playerId)],
    );
    const playersById = new Map(playerResult.rows.map(player => [player.id, player]));
    for (const player of document.catalog) {
      const existing = playersById.get(player.playerId);
      if (existing === undefined) {
        changes.push(change("player", player.playerId, "create"));
        continue;
      }
      const expected = {
        id: player.playerId,
        provider: player.provider ?? null,
        provider_player_id: player.providerPlayerId ?? null,
        canonical_name: player.name,
        position: player.position,
        nfl_team: player.teamAbbreviation ?? null,
        bye_week: player.byeWeek ?? null,
        active: true,
      } satisfies PlayerRow;
      if (sameValue(existing, expected)) {
        changes.push(change("player", player.playerId, "unchanged"));
      } else {
        conflicts.push(`Player ${player.playerId} differs from the provisioning document.`);
        changes.push(change("player", player.playerId, "unchanged"));
      }
    }

    const keeperResult = await this.#client.query<KeeperRow>(
      `
SELECT id, fantasy_team_id, player_id, player_name, position, keeper_cost,
       previous_cost, status, source
FROM keeper_declarations
WHERE league_season_id = $1
ORDER BY id ASC
`.trim(),
      [document.season.id],
    );
    const keepersById = new Map(keeperResult.rows.map(keeper => [keeper.id, keeper]));
    if (keeperResult.rows.some(row => !document.keepers.some(keeper => keeper.id === row.id))) {
      conflicts.push(`Season ${document.season.id} has keeper declarations outside the provisioning document.`);
    }
    const catalogById = new Map(document.catalog.map(player => [player.playerId, player]));
    for (const keeper of document.keepers) {
      const player = catalogById.get(keeper.playerId);
      if (player === undefined) throw new Error(`Missing catalog player ${keeper.playerId}.`);
      const expected = {
        id: keeper.id,
        fantasy_team_id: keeper.teamId,
        player_id: keeper.playerId,
        player_name: player.name,
        position: player.position,
        keeper_cost: keeper.keeperCost,
        previous_cost: keeper.previousCost ?? null,
        status: keeper.status,
        source: keeper.source,
      } satisfies KeeperRow;
      const existing = keepersById.get(keeper.id);
      if (existing === undefined) {
        changes.push(change("keeper", keeper.id, "create"));
      } else if (sameValue(existing, expected)) {
        changes.push(change("keeper", keeper.id, "unchanged"));
      } else {
        conflicts.push(`Keeper ${keeper.id} differs from the provisioning document.`);
        changes.push(change("keeper", keeper.id, "unchanged"));
      }
    }

    const auditResult = await this.#client.query<{ id: string }>(
      "SELECT id FROM audit_events WHERE id = $1",
      [context.auditEventId],
    );
    const auditRecorded = auditResult.rows[0] !== undefined;
    changes.push(change(
      "audit-event",
      context.auditEventId,
      auditRecorded ? "unchanged" : "create",
    ));

    return { changes, conflicts, auditRecorded };
  }

  async apply(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<void> {
    for (const account of document.accounts) {
      const existing = await this.#authRepository.findAccountById(account.id);
      if (existing === null) {
        await this.#authRepository.createAccount({
          id: account.id,
          email: account.email,
          passwordHash: account.passwordHash,
          now: context.now,
        });
      }
    }

    const existingSeason = await this.#leagueSetupRepository.findLeagueSeason(document.season.id);
    if (existingSeason === null) {
      await this.#leagueSetupRepository.registerLeagueSeason({
        season: document.season,
        memberships: document.memberships,
        createdByUserId: document.actorAccountId,
        now: context.now,
      });
    }

    for (const player of document.catalog) {
      await this.#client.query(
        `
INSERT INTO players (
  id, provider, provider_player_id, canonical_name, position, nfl_team,
  bye_week, active, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $8)
ON CONFLICT (id) DO NOTHING;
`.trim(),
        [
          player.playerId,
          player.provider ?? null,
          player.providerPlayerId ?? null,
          player.name,
          player.position,
          player.teamAbbreviation ?? null,
          player.byeWeek ?? null,
          context.now,
        ],
      );
    }

    const existingDraftSetup = await this.#draftSetupRepository.findForSeason(document.season.id);
    if (existingDraftSetup === null) {
      await this.#draftSetupRepository.save({
        ...draftSetupInputFor(document),
        updatedAt: context.now,
      });
    }

    const catalogById = new Map(document.catalog.map(player => [player.playerId, player]));
    for (const keeper of document.keepers) {
      const player = catalogById.get(keeper.playerId);
      if (player === undefined) throw new Error(`Missing catalog player ${keeper.playerId}.`);
      await this.#client.query(
        `
INSERT INTO keeper_declarations (
  id, league_season_id, fantasy_team_id, player_id, player_name, position,
  keeper_cost, previous_cost, status, source, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
ON CONFLICT (id) DO NOTHING;
`.trim(),
        [
          keeper.id,
          document.season.id,
          keeper.teamId,
          keeper.playerId,
          player.name,
          player.position,
          keeper.keeperCost,
          keeper.previousCost ?? null,
          keeper.status,
          keeper.source,
          context.now,
        ],
      );
    }

    const beforeAudit = await this.inspect(document, context);
    const incompleteResources = beforeAudit.changes.filter(candidate =>
      candidate.resourceType !== "audit-event" && candidate.action !== "unchanged"
    );
    if (beforeAudit.conflicts.length > 0 || incompleteResources.length > 0) {
      const issues = [
        ...beforeAudit.conflicts,
        ...incompleteResources.map(candidate =>
          `${candidate.resourceType} ${candidate.resourceId} still requires ${candidate.action}.`
        ),
      ];
      throw new Error(`Production provisioning could not record its audit event:\n- ${issues.join("\n- ")}`);
    }

    await this.#client.query(
      `
INSERT INTO audit_events (
  id, league_id, user_id, event_type, resource_type, resource_id,
  metadata_json, created_at
) VALUES ($1, $2, $3, 'production_provisioning_applied', 'league_season', $4, $5::jsonb, $6)
ON CONFLICT (id) DO NOTHING;
`.trim(),
      [
        context.auditEventId,
        document.league.id,
        document.actorAccountId,
        document.season.id,
        JSON.stringify({
          schemaVersion: document.schemaVersion,
          provisioningId: document.provisioningId,
          inputDigest: context.inputDigest,
          accountCount: document.accounts.length,
          membershipCount: document.memberships.length,
          teamCount: document.season.teams.length,
          catalogCount: document.catalog.length,
          initialRosterCount: document.initialRosters.length,
          keeperCount: document.keepers.length,
        }),
        context.now,
      ],
    );
  }

  async verify(
    document: ResolvedProductionProvisioningDocument,
    context: ProductionProvisioningContext,
  ): Promise<readonly string[]> {
    const inspection = await this.inspect(document, context);

    return [
      ...inspection.conflicts,
      ...inspection.changes
        .filter(candidate => candidate.action !== "unchanged")
        .map(candidate => `${candidate.resourceType} ${candidate.resourceId} requires ${candidate.action}.`),
      ...(inspection.auditRecorded ? [] : [`Audit event ${context.auditEventId} is missing.`]),
    ];
  }
}
