import { positions, type Position } from "../../config/league.js";
import type { FantasyTeam, LeagueSeason } from "./leagueSeason.js";

export type HistoricalImportBatchStatus = "previewed" | "blocked" | "committed" | "superseded";
export type HistoricalImportRowStatus = "ready" | "blocked";
export type HistoricalImportIssueSeverity = "blocker" | "warning";

export type HistoricalImportIssueCode =
  | "season_missing"
  | "owner_unknown"
  | "position_invalid"
  | "player_missing"
  | "price_invalid"
  | "player_duplicate"
  | "player_unresolved"
  | "season_spend_mismatch"
  | "keeper_inferred"
  | "acquisition_type_inferred";

export type PlayerResolution =
  | { status: "resolved"; playerId: string }
  | { status: "unresolved"; required: true; candidates?: readonly string[] };

export type HistoricalAcquisitionType = "auction" | "keeper";

export interface HistoricalImportIssue {
  code: HistoricalImportIssueCode;
  severity: HistoricalImportIssueSeverity;
  message: string;
  rowNumber?: number;
}

export interface NormalizedHistoricalImportRow {
  sourceRowNumber: number;
  seasonYear?: number;
  ownerDisplayName?: string;
  playerName?: string;
  playerId?: string;
  position?: string;
  priceDollars?: number;
  playerResolution?: PlayerResolution;
  keeper?: boolean;
  acquisitionType?: HistoricalAcquisitionType;
}

export interface HistoricalSaleRecord {
  id: string;
  batchId: string;
  leagueId: string;
  leagueSeasonId: string;
  seasonYear: number;
  rowNumber: number;
  ownerId: string;
  ownerDisplayName: string;
  playerId: string;
  playerName: string;
  position: Position;
  priceDollars: number;
  keeper: boolean;
  acquisitionType: HistoricalAcquisitionType;
}

export interface HistoricalImportRowPreview {
  rowNumber: number;
  status: HistoricalImportRowStatus;
  blockers: HistoricalImportIssue[];
  warnings: HistoricalImportIssue[];
  record: HistoricalSaleRecord | null;
}

export interface HistoricalImportBatch {
  id: string;
  leagueId: string;
  leagueSeasonId: string | null;
  seasonYear: number;
  fileHash: string;
  status: HistoricalImportBatchStatus;
  replacementRequested: boolean;
  createdAt: Date;
  committedAt?: Date;
  supersededAt?: Date;
  supersededByBatchId?: string;
  blockers: HistoricalImportIssue[];
  warnings: HistoricalImportIssue[];
  rows: HistoricalImportRowPreview[];
}

export interface PreviewHistoricalImportBatchInput {
  repository: HistoricalImportRepository;
  leagueId: string;
  seasonYear: number;
  fileHash: string;
  replacementRequested?: boolean;
  rows: readonly NormalizedHistoricalImportRow[];
  now?: Date;
}

export interface CommitHistoricalImportBatchInput {
  repository: HistoricalImportRepository;
  batchId: string;
  now?: Date;
}

export interface HistoricalImportRepository {
  findLeagueSeason(leagueId: string, seasonYear: number): LeagueSeason | null;
  findBatchById(batchId: string): HistoricalImportBatch | null;
  findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): HistoricalImportBatch | null;
  findCommittedBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): HistoricalImportBatch | null;
  findCurrentCommittedBatch(leagueId: string, seasonYear: number): HistoricalImportBatch | null;
  nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string): number;
  createBatch(batch: HistoricalImportBatch): HistoricalImportBatch;
  updateBatch(batch: HistoricalImportBatch): HistoricalImportBatch;
  addRecords(records: readonly HistoricalSaleRecord[]): void;
}

const positionSet = new Set<string>(positions);

const sanitizeIdSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const issue = (
  code: HistoricalImportIssueCode,
  severity: HistoricalImportIssueSeverity,
  message: string,
  rowNumber?: number,
): HistoricalImportIssue => ({
  code,
  severity,
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
});

const teamForOwner = (
  ownerDisplayName: string | undefined,
  teams: readonly FantasyTeam[],
): FantasyTeam | null => {
  const normalizedOwner = ownerDisplayName?.trim().toLowerCase();

  if (normalizedOwner === undefined || normalizedOwner.length === 0) {
    return null;
  }

  return teams.find(team => team.ownerDisplayName.trim().toLowerCase() === normalizedOwner) ?? null;
};

const resolvePosition = (position: string | undefined): Position | null => {
  if (position === undefined) return null;

  const normalizedPosition = position.trim().toUpperCase();

  return positionSet.has(normalizedPosition) ? normalizedPosition as Position : null;
};

const normalizePlayerId = (playerId: string | undefined): string | null => {
  const normalizedPlayerId = playerId?.trim() ?? "";

  return normalizedPlayerId.length > 0 ? normalizedPlayerId : null;
};

const resolvePlayerId = (row: NormalizedHistoricalImportRow): string | null => {
  if (row.playerResolution?.status === "resolved") {
    return normalizePlayerId(row.playerResolution.playerId);
  }

  return normalizePlayerId(row.playerId);
};

const playerKeyFor = (row: HistoricalImportRowPreview): string | null => {
  if (row.record === null) return null;

  return row.record.playerId.length > 0
    ? `id:${row.record.playerId}`
    : `name:${row.record.playerName.trim().toLowerCase()}`;
};

const addRowBlocker = (
  row: HistoricalImportRowPreview,
  blocker: HistoricalImportIssue,
): HistoricalImportRowPreview => ({
  ...row,
  status: "blocked",
  blockers: [...row.blockers, blocker],
  record: null,
});

const batchBaseId = (leagueId: string, seasonYear: number, fileHash: string): string =>
  `historical-import-${sanitizeIdSegment(leagueId)}-${seasonYear}-${sanitizeIdSegment(fileHash)}`;

export class InMemoryHistoricalImportRepository implements HistoricalImportRepository {
  readonly #leagueSeasons = new Map<string, LeagueSeason>();
  readonly #batchesById = new Map<string, HistoricalImportBatch>();
  readonly #records: HistoricalSaleRecord[] = [];

  constructor(leagueSeasons: readonly LeagueSeason[] = []) {
    for (const season of leagueSeasons) {
      this.#leagueSeasons.set(seasonKey(season.leagueId, season.seasonYear), season);
    }
  }

  findLeagueSeason(leagueId: string, seasonYear: number): LeagueSeason | null {
    return this.#leagueSeasons.get(seasonKey(leagueId, seasonYear)) ?? null;
  }

  findBatchById(batchId: string): HistoricalImportBatch | null {
    return this.#batchesById.get(batchId) ?? null;
  }

  findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): HistoricalImportBatch | null {
    return this.batches().find(batch =>
      batch.leagueId === leagueId
        && batch.seasonYear === seasonYear
        && batch.fileHash === fileHash
        && batch.status !== "superseded"
    ) ?? null;
  }

  findCommittedBatchByFileHash(
    leagueId: string,
    seasonYear: number,
    fileHash: string,
  ): HistoricalImportBatch | null {
    return this.batches().find(batch =>
      batch.leagueId === leagueId
        && batch.seasonYear === seasonYear
        && batch.fileHash === fileHash
        && batch.status === "committed"
    ) ?? null;
  }

  findCurrentCommittedBatch(leagueId: string, seasonYear: number): HistoricalImportBatch | null {
    return this.batches().find(batch =>
      batch.leagueId === leagueId
        && batch.seasonYear === seasonYear
        && batch.status === "committed"
    ) ?? null;
  }

  nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string): number {
    const baseId = batchBaseId(leagueId, seasonYear, fileHash);

    return this.batches().filter(batch => batch.id.startsWith(`${baseId}-`)).length + 1;
  }

  createBatch(batch: HistoricalImportBatch): HistoricalImportBatch {
    this.#batchesById.set(batch.id, batch);
    return batch;
  }

  updateBatch(batch: HistoricalImportBatch): HistoricalImportBatch {
    this.#batchesById.set(batch.id, batch);
    return batch;
  }

  addRecords(records: readonly HistoricalSaleRecord[]): void {
    this.#records.push(...records);
  }

  records(): HistoricalSaleRecord[] {
    return [...this.#records];
  }

  batches(): HistoricalImportBatch[] {
    return [...this.#batchesById.values()];
  }
}

export const previewHistoricalImportBatch = ({
  repository,
  leagueId,
  seasonYear,
  fileHash,
  replacementRequested = false,
  rows,
  now = new Date(),
}: PreviewHistoricalImportBatchInput): HistoricalImportBatch => {
  const existingBatch = replacementRequested
    ? null
    : repository.findBatchByFileHash(leagueId, seasonYear, fileHash);

  if (existingBatch !== null) {
    return existingBatch;
  }

  const season = repository.findLeagueSeason(leagueId, seasonYear);
  const batchId = [
    batchBaseId(leagueId, seasonYear, fileHash),
    String(repository.nextBatchOrdinal(leagueId, seasonYear, fileHash)).padStart(3, "0"),
  ].join("-");

  if (season === null) {
    return repository.createBatch({
      id: batchId,
      leagueId,
      leagueSeasonId: null,
      seasonYear,
      fileHash,
      status: "blocked",
      replacementRequested,
      createdAt: now,
      blockers: [issue("season_missing", "blocker", `No season ${seasonYear} is configured for league ${leagueId}.`)],
      warnings: [],
      rows: rows.map(importRow => ({
        rowNumber: importRow.sourceRowNumber,
        status: "blocked",
        blockers: [],
        warnings: [],
        record: null,
      })),
    });
  }

  const initialRowPreviews = rows.map((importRow, index): HistoricalImportRowPreview => {
    const rowBlockers: HistoricalImportIssue[] = [];
    const rowWarnings: HistoricalImportIssue[] = [];
    const rowNumber = importRow.sourceRowNumber;
    const team = teamForOwner(importRow.ownerDisplayName, season.teams);
    const position = resolvePosition(importRow.position);
    const playerName = importRow.playerName?.trim() ?? "";
    const playerId = resolvePlayerId(importRow);
    const keeper = importRow.keeper ?? false;
    const acquisitionType = importRow.acquisitionType ?? (keeper ? "keeper" : "auction");

    if (importRow.keeper === undefined) {
      rowWarnings.push(issue("keeper_inferred", "warning", "Keeper status was inferred as false.", rowNumber));
    }

    if (importRow.acquisitionType === undefined) {
      rowWarnings.push(issue("acquisition_type_inferred", "warning", `Acquisition type was inferred as ${acquisitionType}.`, rowNumber));
    }

    if (importRow.seasonYear !== undefined && importRow.seasonYear !== seasonYear) {
      rowBlockers.push(issue("season_missing", "blocker", `Row season ${importRow.seasonYear} does not match import season ${seasonYear}.`, rowNumber));
    }

    if (team === null) {
      rowBlockers.push(issue("owner_unknown", "blocker", "Owner does not belong to this league season.", rowNumber));
    }

    if (position === null) {
      rowBlockers.push(issue("position_invalid", "blocker", "Position must be QB, RB, WR, TE, K, or DST.", rowNumber));
    }

    if (playerName.length === 0) {
      rowBlockers.push(issue("player_missing", "blocker", "Player name is required.", rowNumber));
    }

    if (importRow.priceDollars === undefined || !Number.isInteger(importRow.priceDollars) || importRow.priceDollars < 0) {
      rowBlockers.push(issue("price_invalid", "blocker", "Price must be a non-negative whole dollar amount.", rowNumber));
    }

    if (importRow.playerResolution?.status === "unresolved" && importRow.playerResolution.required) {
      rowBlockers.push(issue("player_unresolved", "blocker", "Player must be resolved before import commit.", rowNumber));
    }

    if (playerName.length > 0 && playerId === null && !rowBlockers.some(blocker => blocker.code === "player_unresolved")) {
      rowBlockers.push(issue("player_unresolved", "blocker", "Player must be resolved before import commit.", rowNumber));
    }

    if (rowBlockers.length > 0 || team === null || position === null || playerName.length === 0 || playerId === null || importRow.priceDollars === undefined) {
      return {
        rowNumber,
        status: "blocked",
        blockers: rowBlockers,
        warnings: rowWarnings,
        record: null,
      };
    }

    return {
      rowNumber,
      status: "ready",
      blockers: rowBlockers,
      warnings: rowWarnings,
      record: {
        id: `${batchId}-row-${String(index + 1).padStart(3, "0")}`,
        batchId,
        leagueId,
        leagueSeasonId: season.id,
        seasonYear,
        rowNumber,
        ownerId: team.ownerId,
        ownerDisplayName: team.ownerDisplayName,
        playerId,
        playerName,
        position,
        priceDollars: importRow.priceDollars,
        keeper,
        acquisitionType,
      },
    };
  });
  const playerCounts = initialRowPreviews.reduce<Map<string, number>>((counts, rowPreview) => {
    const playerKey = playerKeyFor(rowPreview);

    if (playerKey !== null) {
      counts.set(playerKey, (counts.get(playerKey) ?? 0) + 1);
    }

    return counts;
  }, new Map<string, number>());
  const rowPreviews = initialRowPreviews.map(rowPreview => {
    const playerKey = playerKeyFor(rowPreview);

    if (playerKey === null || (playerCounts.get(playerKey) ?? 0) < 2) {
      return rowPreview;
    }

    return addRowBlocker(
      rowPreview,
      issue("player_duplicate", "blocker", "Player appears more than once in this league season import.", rowPreview.rowNumber),
    );
  });
  const blockers = rowPreviews.flatMap(rowPreview => rowPreview.blockers);
  const actualSpend = rowPreviews.reduce(
    (total, rowPreview) => total + (rowPreview.record?.priceDollars ?? 0),
    0,
  );
  const expectedSpend = season.teams.length * season.settings.auction.budgetDollars;
  const warnings = actualSpend === expectedSpend
    ? []
    : [issue("season_spend_mismatch", "warning", `Imported spend is $${actualSpend}, expected $${expectedSpend}.`)];

  return repository.createBatch({
    id: batchId,
    leagueId,
    leagueSeasonId: season.id,
    seasonYear,
    fileHash,
    status: blockers.length > 0 ? "blocked" : "previewed",
    replacementRequested,
    createdAt: now,
    blockers,
    warnings,
    rows: rowPreviews,
  });
};

export const commitHistoricalImportBatch = ({
  repository,
  batchId,
  now = new Date(),
}: CommitHistoricalImportBatchInput): HistoricalImportBatch => {
  const batch = repository.findBatchById(batchId);

  if (batch === null) {
    throw new Error(`Historical import batch ${batchId} was not found.`);
  }

  if (batch.status === "committed" || batch.status === "superseded") {
    return batch;
  }

  if (batch.status === "blocked" || batch.blockers.length > 0) {
    throw new Error("Cannot commit historical import batch with blockers.");
  }

  const existingCommittedBatch = batch.replacementRequested
    ? null
    : repository.findCommittedBatchByFileHash(batch.leagueId, batch.seasonYear, batch.fileHash);

  if (existingCommittedBatch !== null) {
    return existingCommittedBatch;
  }

  const currentCommittedBatch = repository.findCurrentCommittedBatch(batch.leagueId, batch.seasonYear);

  if (currentCommittedBatch !== null) {
    repository.updateBatch({
      ...currentCommittedBatch,
      status: "superseded",
      supersededAt: now,
      supersededByBatchId: batch.id,
    });
  }

  const committedBatch = repository.updateBatch({
    ...batch,
    status: "committed",
    committedAt: now,
  });
  const records = committedBatch.rows.flatMap(rowPreview =>
    rowPreview.record === null ? [] : [rowPreview.record],
  );

  repository.addRecords(records);
  return committedBatch;
};

const seasonKey = (leagueId: string, seasonYear: number): string => `${leagueId}:${seasonYear}`;
