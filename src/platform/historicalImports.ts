import { positions, type Position } from "../../config/league.js";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import type { FantasyTeam, LeagueSeason } from "./leagueSeason.js";

type MaybePromise<T> = T | Promise<T>;

export type HistoricalImportBatchStatus = "previewed" | "blocked" | "committed" | "superseded";
export type HistoricalImportRowStatus = "ready" | "blocked";
export type HistoricalImportIssueSeverity = "blocker" | "warning";
export type HistoricalImportErrorCode =
  | "batch_blocked"
  | "batch_not_found"
  | "season_import_conflict";

export class HistoricalImportError extends Error {
  readonly code: HistoricalImportErrorCode;

  constructor(code: HistoricalImportErrorCode, message: string) {
    super(message);
    this.name = "HistoricalImportError";
    this.code = code;
  }
}

export class HistoricalImportTargetError extends Error {
  readonly code = "batch_target_mismatch" as const;

  constructor(message: string) {
    super(message);
    this.name = "HistoricalImportTargetError";
  }
}

export type HistoricalImportIssueCode =
  | "season_missing"
  | "team_count_mismatch"
  | "owner_unknown"
  | "owner_ambiguous"
  | "owner_mapping_not_one_to_one"
  | "owner_fuzzy_match"
  | "position_invalid"
  | "player_missing"
  | "price_invalid"
  | "public_price_invalid"
  | "player_duplicate"
  | "player_ambiguous"
  | "player_unresolved"
  | "player_historical_only"
  | "season_spend_mismatch"
  | "keeper_inferred"
  | "acquisition_type_inferred";

export interface HistoricalImportPlayerCatalogEntry {
  playerId?: string;
  name: string;
  position: Position | string;
  aliases?: readonly string[];
}

export interface HistoricalPlayerResolutionCandidate {
  playerId: string;
  playerName: string;
  position: string;
}

export interface HistoricalOwnerResolutionCandidate {
  teamId: string;
  teamDisplayName: string;
  ownerDisplayName: string;
}

export type HistoricalImportReviewCandidate =
  | HistoricalPlayerResolutionCandidate
  | HistoricalOwnerResolutionCandidate;

export type PlayerResolution =
  | {
      status: "resolved";
      playerId: string;
      playerName?: string;
      position?: string;
    }
  | {
      status: "unresolved";
      required: true;
      candidates?: readonly (HistoricalPlayerResolutionCandidate | string)[];
    }
  | {
      status: "ambiguous";
      required: true;
      candidates: readonly HistoricalPlayerResolutionCandidate[];
    };

export type HistoricalAcquisitionType = "auction" | "keeper";

export interface HistoricalImportIssue {
  code: HistoricalImportIssueCode;
  severity: HistoricalImportIssueSeverity;
  message: string;
  rowNumber?: number;
  sourceValue?: string;
  candidates?: readonly HistoricalImportReviewCandidate[];
}

export interface HistoricalOwnerMapping {
  sourceOwnerOrTeamLabel: string;
  teamId: string;
}

export interface HistoricalImportIdentityAudit {
  sourceOwnerOrTeamLabel: string;
  resolution: "exact" | "explicit" | "fuzzy" | "ambiguous" | "unresolved";
  mappedTeamId?: string;
  mappedCurrentOwnerDisplayName?: string;
  mappedCurrentTeamDisplayName?: string;
  candidates?: readonly HistoricalOwnerResolutionCandidate[];
}

export interface NormalizedHistoricalImportRow {
  sourceRowNumber: number;
  seasonYear?: number;
  ownerDisplayName?: string;
  playerName?: string;
  playerId?: string;
  position?: string;
  priceDollars?: number;
  publicPriceDollars?: number;
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
  publicPriceDollars?: number;
  keeper: boolean;
  acquisitionType: HistoricalAcquisitionType;
}

export interface HistoricalImportRowPreview {
  rowNumber: number;
  status: HistoricalImportRowStatus;
  blockers: HistoricalImportIssue[];
  warnings: HistoricalImportIssue[];
  record: HistoricalSaleRecord | null;
  identityAudit?: HistoricalImportIdentityAudit;
}

export interface HistoricalImportBatch {
  id: string;
  leagueId: string;
  leagueSeasonId: string | null;
  seasonYear: number;
  fileHash: string;
  uploadedByUserId?: string;
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

export interface HistoricalImportSeasonContext {
  currentLeagueSeason: LeagueSeason;
}

export interface PreviewHistoricalImportBatchInput {
  repository: HistoricalImportRepository;
  leagueId: string;
  seasonYear: number;
  seasonContext?: HistoricalImportSeasonContext;
  fileHash: string;
  uploadedByUserId?: string;
  replacementRequested?: boolean;
  ownerMappings?: readonly HistoricalOwnerMapping[];
  requireCompleteTeamMapping?: boolean;
  rows: readonly NormalizedHistoricalImportRow[];
  now?: Date;
}

export interface CommitHistoricalImportBatchInput {
  repository: HistoricalImportRepository;
  batchId: string;
  expectedLeagueId?: string;
  expectedLeagueSeasonId?: string;
  expectedSeasonYear?: number;
  now?: Date;
}

export interface PreparedHistoricalImportCommit {
  batch: HistoricalImportBatch;
  committedRecords: readonly HistoricalSaleRecord[];
}

export interface HistoricalImportRepository {
  withTransaction?<T>(operation: (repository: HistoricalImportRepository) => MaybePromise<T>): MaybePromise<T>;
  findLeagueSeason(leagueId: string, seasonYear: number): MaybePromise<LeagueSeason | null>;
  findBatchById(batchId: string): MaybePromise<HistoricalImportBatch | null>;
  findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): MaybePromise<HistoricalImportBatch | null>;
  findCommittedBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): MaybePromise<HistoricalImportBatch | null>;
  findCurrentCommittedBatch(leagueId: string, seasonYear: number): MaybePromise<HistoricalImportBatch | null>;
  nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string): MaybePromise<number>;
  createBatch(batch: HistoricalImportBatch): MaybePromise<HistoricalImportBatch>;
  updateBatch(batch: HistoricalImportBatch): MaybePromise<HistoricalImportBatch>;
  addRecords(records: readonly HistoricalSaleRecord[]): MaybePromise<void>;
  currentRecords(leagueId: string, seasonYear: number): MaybePromise<HistoricalSaleRecord[]>;
  currentRecordsThroughSeason(leagueId: string, seasonYear: number): MaybePromise<HistoricalSaleRecord[]>;
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
  details: Pick<HistoricalImportIssue, "sourceValue" | "candidates"> = {},
): HistoricalImportIssue => ({
  code,
  severity,
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
  ...details,
});

const normalizeIdentityLabel = (value: string | undefined): string =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[\u0027\u2019]s\b/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const editDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? rightIndex) + 1,
        (previous[rightIndex] ?? leftIndex) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
    }
    previous = current;
  }

  return previous[right.length] ?? Math.max(left.length, right.length);
};

const maximumFuzzyDistanceFor = (length: number): number => {
  if (length < 7) return 1;
  if (length < 14) return 2;

  return 3;
};

const genericIdentityTokens = new Set([
  "draft",
  "league",
  "manager",
  "new",
  "old",
  "owner",
  "team",
  "the",
]);

const identityLabelsFuzzilyMatch = (source: string, candidate: string): boolean => {
  if (source.length < 3 || candidate.length < 3) return false;

  const sourceTokens = source.split(" ");
  const candidateTokens = candidate.split(" ");
  const shorterTokens = sourceTokens.length <= candidateTokens.length ? sourceTokens : candidateTokens;
  const longerTokens = sourceTokens.length <= candidateTokens.length ? candidateTokens : sourceTokens;
  const meaningfulShorterTokens = shorterTokens.filter(token => !genericIdentityTokens.has(token));
  if (
    meaningfulShorterTokens.length > 0
    && meaningfulShorterTokens.every(token => longerTokens.includes(token))
  ) return true;

  const longestLength = Math.max(source.length, candidate.length);
  const distance = editDistance(source, candidate);

  return distance <= maximumFuzzyDistanceFor(longestLength) && distance / longestLength <= 0.2;
};

const ownerCandidateFor = (team: FantasyTeam): HistoricalOwnerResolutionCandidate => ({
  teamId: team.id,
  teamDisplayName: team.displayName,
  ownerDisplayName: team.ownerDisplayName,
});

const identityLabelsFor = (team: FantasyTeam): readonly string[] => [
  team.ownerDisplayName,
  team.displayName,
  ...(team.abbreviation === undefined ? [] : [team.abbreviation]),
  ...(team.managerDisplayNames ?? []),
];

const uniqueTeams = (teams: readonly FantasyTeam[]): FantasyTeam[] =>
  [...new Map(teams.map(team => [team.id, team])).values()];

const teamResolutionForOwner = (
  ownerDisplayName: string | undefined,
  teams: readonly FantasyTeam[],
  mappings: readonly HistoricalOwnerMapping[],
): { team: FantasyTeam | null; audit: HistoricalImportIdentityAudit } => {
  const sourceOwnerOrTeamLabel = ownerDisplayName?.trim() ?? "";
  const normalizedOwner = normalizeIdentityLabel(sourceOwnerOrTeamLabel);
  const allCandidates = teams.map(ownerCandidateFor);

  if (normalizedOwner.length === 0) {
    return {
      team: null,
      audit: {
        sourceOwnerOrTeamLabel,
        resolution: "unresolved",
        candidates: allCandidates,
      },
    };
  }

  const mappedTeamIds = new Set(
    mappings
      .filter(mapping => normalizeIdentityLabel(mapping.sourceOwnerOrTeamLabel) === normalizedOwner)
      .map(mapping => mapping.teamId),
  );
  if (mappedTeamIds.size > 0) {
    const mappedTeams = uniqueTeams(teams.filter(team => mappedTeamIds.has(team.id)));
    if (mappedTeams.length === 1) {
      const team = mappedTeams[0];
      if (team !== undefined) {
        return {
          team,
          audit: {
            sourceOwnerOrTeamLabel,
            resolution: "explicit",
            mappedTeamId: team.id,
            mappedCurrentOwnerDisplayName: team.ownerDisplayName,
            mappedCurrentTeamDisplayName: team.displayName,
          },
        };
      }
    }

    return {
      team: null,
      audit: {
        sourceOwnerOrTeamLabel,
        resolution: mappedTeams.length > 1 ? "ambiguous" : "unresolved",
        candidates: mappedTeams.length > 0 ? mappedTeams.map(ownerCandidateFor) : allCandidates,
      },
    };
  }

  const exactTeams = uniqueTeams(teams.filter(team =>
    identityLabelsFor(team).some(label => normalizeIdentityLabel(label) === normalizedOwner)
  ));
  if (exactTeams.length === 1) {
    const team = exactTeams[0];
    if (team !== undefined) {
      return {
        team,
        audit: {
          sourceOwnerOrTeamLabel,
          resolution: "exact",
          mappedTeamId: team.id,
          mappedCurrentOwnerDisplayName: team.ownerDisplayName,
          mappedCurrentTeamDisplayName: team.displayName,
        },
      };
    }
  }

  if (exactTeams.length > 1) {
    return {
      team: null,
      audit: {
        sourceOwnerOrTeamLabel,
        resolution: "ambiguous",
        candidates: exactTeams.map(ownerCandidateFor),
      },
    };
  }

  const fuzzyTeams = uniqueTeams(teams.filter(team =>
    identityLabelsFor(team).some(label =>
      identityLabelsFuzzilyMatch(normalizedOwner, normalizeIdentityLabel(label))
    )
  ));
  if (fuzzyTeams.length === 1) {
    const team = fuzzyTeams[0];
    if (team !== undefined) {
      return {
        team,
        audit: {
          sourceOwnerOrTeamLabel,
          resolution: "fuzzy",
          mappedTeamId: team.id,
          mappedCurrentOwnerDisplayName: team.ownerDisplayName,
          mappedCurrentTeamDisplayName: team.displayName,
        },
      };
    }
  }

  return {
    team: null,
    audit: {
      sourceOwnerOrTeamLabel,
      resolution: fuzzyTeams.length > 1 ? "ambiguous" : "unresolved",
      candidates: fuzzyTeams.length > 1 ? fuzzyTeams.map(ownerCandidateFor) : allCandidates,
    },
  };
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

const basePlayerIdForCatalogEntry = (entry: HistoricalImportPlayerCatalogEntry): string => {
  const providedId = normalizePlayerId(entry.playerId);
  if (providedId !== null) return providedId;

  const nameSegment = canonicalPlayerIdentityKey(entry.name).replace(/[^a-z0-9]+/gu, "-");
  const positionSegment = entry.position.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-");

  return `player-${nameSegment}-${positionSegment}`;
};

const playerCandidateFor = (
  entry: HistoricalImportPlayerCatalogEntry,
  playerId: string,
): HistoricalPlayerResolutionCandidate => ({
  playerId,
  playerName: entry.name.trim(),
  position: entry.position.trim().toUpperCase(),
});

const catalogCandidatesFor = (
  playerCatalog: readonly HistoricalImportPlayerCatalogEntry[],
): HistoricalPlayerResolutionCandidate[] => {
  const baseIds = playerCatalog.map(basePlayerIdForCatalogEntry);
  const baseIdCounts = baseIds.reduce<Map<string, number>>((counts, playerId) => {
    counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const seenBaseIds = new Map<string, number>();

  return playerCatalog.map((entry, index) => {
    const baseId = baseIds[index] ?? basePlayerIdForCatalogEntry(entry);
    const occurrence = (seenBaseIds.get(baseId) ?? 0) + 1;
    seenBaseIds.set(baseId, occurrence);
    const playerId = normalizePlayerId(entry.playerId) !== null || baseIdCounts.get(baseId) === 1
      ? baseId
      : `${baseId}-${occurrence}`;

    return playerCandidateFor(entry, playerId);
  });
};

const likelyPlayerCandidatesFor = (
  playerName: string,
  position: Position,
  catalog: readonly {
    entry: HistoricalImportPlayerCatalogEntry;
    candidate: HistoricalPlayerResolutionCandidate;
  }[],
): HistoricalPlayerResolutionCandidate[] => {
  const sourceKey = canonicalPlayerIdentityKey(playerName);
  const rankedCandidates = catalog
    .filter(candidate => resolvePosition(candidate.entry.position) === position)
    .map(candidate => {
      const candidateKey = canonicalPlayerIdentityKey(candidate.entry.name);
      return {
        candidate: candidate.candidate,
        distance: editDistance(sourceKey, candidateKey),
        longestLength: Math.max(sourceKey.length, candidateKey.length),
      };
    })
    .filter(({ distance, longestLength }) => {
      return distance > 0
        && distance <= maximumFuzzyDistanceFor(longestLength)
        && distance / longestLength <= 0.2;
    })
    .sort((left, right) =>
      left.distance - right.distance
      || left.candidate.playerName.localeCompare(right.candidate.playerName)
    );
  const closestDistance = rankedCandidates[0]?.distance;

  return rankedCandidates
    .filter(candidate => candidate.distance === closestDistance)
    .slice(0, 3)
    .map(candidate => candidate.candidate);
};

export interface ResolveHistoricalImportPlayersInput {
  rows: readonly NormalizedHistoricalImportRow[];
  playerCatalog: readonly HistoricalImportPlayerCatalogEntry[];
}

export interface ResolveHistoricalImportPlayersResult {
  rows: NormalizedHistoricalImportRow[];
  issues: HistoricalImportIssue[];
}

export const resolveHistoricalImportPlayers = ({
  rows,
  playerCatalog,
}: ResolveHistoricalImportPlayersInput): ResolveHistoricalImportPlayersResult => {
  const issues: HistoricalImportIssue[] = [];
  const catalogCandidates = catalogCandidatesFor(playerCatalog);
  const catalog = playerCatalog.map((entry, index) => ({
    entry,
    candidate: catalogCandidates[index] ?? playerCandidateFor(entry, basePlayerIdForCatalogEntry(entry)),
    nameKeys: new Set([entry.name, ...(entry.aliases ?? [])].map(canonicalPlayerIdentityKey)),
  }));
  const resolvedRows = rows.map(row => {
    const playerName = row.playerName?.trim() ?? "";
    const position = resolvePosition(row.position);
    const suppliedPlayerId = normalizePlayerId(row.playerId);

    if (suppliedPlayerId !== null) {
      const idMatches = catalog.filter(candidate => candidate.candidate.playerId === suppliedPlayerId);
      const match = idMatches.length === 1 ? idMatches[0] : undefined;
      const nameMatches = match?.nameKeys.has(canonicalPlayerIdentityKey(playerName)) ?? false;
      const catalogPosition = match === undefined ? null : resolvePosition(match.entry.position);
      const positionMatches = position !== null && catalogPosition === position;

      if (match !== undefined && nameMatches && positionMatches) {
        return {
          ...row,
          playerId: match.candidate.playerId,
          playerName: match.candidate.playerName,
          position: match.candidate.position,
          playerResolution: {
            status: "resolved" as const,
            playerId: match.candidate.playerId,
            playerName: match.candidate.playerName,
            position: match.candidate.position,
          },
        };
      }

      const message = match === undefined
        ? `Player ID "${suppliedPlayerId}" is not in the current player catalog.`
        : !nameMatches
          ? `Player ID "${suppliedPlayerId}" belongs to ${match.candidate.playerName}, not "${playerName}".`
          : `Player ID "${suppliedPlayerId}" is a ${match.candidate.position}, not ${row.position?.trim().toUpperCase() ?? "the supplied position"}.`;
      issues.push(issue(
        "player_unresolved",
        "blocker",
        `${message} Correct the row or remove the player ID to match by name and position.`,
        row.sourceRowNumber,
        {
          sourceValue: suppliedPlayerId,
          ...(match === undefined ? {} : { candidates: [match.candidate] }),
        },
      ));

      return {
        ...row,
        playerResolution: {
          status: "unresolved" as const,
          required: true as const,
          ...(match === undefined ? {} : { candidates: [match.candidate] }),
        },
      };
    }

    if (playerName.length === 0 || position === null) return { ...row };

    const nameKey = canonicalPlayerIdentityKey(playerName);
    const sameName = catalog.filter(candidate => candidate.nameKeys.has(nameKey));
    const exactCandidates = sameName
      .filter(candidate => resolvePosition(candidate.entry.position) === position)
      .map(candidate => candidate.candidate);

    if (exactCandidates.length === 1) {
      const match = exactCandidates[0];
      if (match !== undefined) {
        return {
          ...row,
          playerId: match.playerId,
          playerName: match.playerName,
          position: match.position,
          playerResolution: {
            status: "resolved" as const,
            playerId: match.playerId,
            playerName: match.playerName,
            position: match.position,
          },
        };
      }
    }

    if (sameName.length === 0) {
      const historicalPlayerId = basePlayerIdForCatalogEntry({
        name: playerName,
        position,
      });
      const likelyCandidates = likelyPlayerCandidatesFor(playerName, position, catalog);
      const likelyMatchCopy = likelyCandidates.length === 0
        ? "If this is a typo, correct the source file and replace this draft year."
        : `Possible current match: ${likelyCandidates
          .map(candidate => `${candidate.playerName} (${candidate.position})`)
          .join(", ")}. Correct the source file and replace this draft year if needed.`;
      issues.push(issue(
        "player_historical_only",
        "warning",
        `${playerName} (${position}) is not in the current player catalog and was imported as a historical-only player. ${likelyMatchCopy}`,
        row.sourceRowNumber,
        {
          sourceValue: playerName,
          ...(likelyCandidates.length === 0 ? {} : { candidates: likelyCandidates }),
        },
      ));
      return {
        ...row,
        playerId: historicalPlayerId,
        playerName,
        position,
        playerResolution: {
          status: "resolved" as const,
          playerId: historicalPlayerId,
          playerName,
          position,
        },
      };
    }

    const candidates = exactCandidates.length > 1
      ? exactCandidates
      : sameName.map(candidate => candidate.candidate);
    const resolution: PlayerResolution = exactCandidates.length > 1
      ? { status: "ambiguous", required: true, candidates }
      : {
          status: "unresolved",
          required: true,
          ...(candidates.length === 0 ? {} : { candidates }),
        };
    const resolutionIssue = issue(
      exactCandidates.length > 1 ? "player_ambiguous" : "player_unresolved",
      "blocker",
      exactCandidates.length > 1
        ? `Multiple ${position} players match "${playerName}". Choose the intended player.`
        : `No ${position} player in the current catalog matches "${playerName}".`,
      row.sourceRowNumber,
      {
        sourceValue: playerName,
        ...(candidates.length === 0 ? {} : { candidates }),
      },
    );
    issues.push(resolutionIssue);

    return {
      ...row,
      playerResolution: resolution,
    };
  });

  return { rows: resolvedRows, issues };
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
    this.replaceLeagueSeasons(leagueSeasons);
  }

  findLeagueSeason(leagueId: string, seasonYear: number): LeagueSeason | null {
    const season = this.#leagueSeasons.get(seasonKey(leagueId, seasonYear));

    return season === undefined ? null : structuredClone(season);
  }

  findBatchById(batchId: string): HistoricalImportBatch | null {
    const batch = this.#batchesById.get(batchId);

    return batch === undefined ? null : structuredClone(batch);
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
    const storedBatch = structuredClone(batch);
    this.#batchesById.set(storedBatch.id, storedBatch);

    return structuredClone(storedBatch);
  }

  updateBatch(batch: HistoricalImportBatch): HistoricalImportBatch {
    const storedBatch = structuredClone(batch);
    this.#batchesById.set(storedBatch.id, storedBatch);

    return structuredClone(storedBatch);
  }

  addRecords(records: readonly HistoricalSaleRecord[]): void {
    this.#records.push(...records.map(record => structuredClone(record)));
  }

  records(): HistoricalSaleRecord[] {
    return this.#records.map(record => structuredClone(record));
  }

  currentRecords(leagueId: string, seasonYear: number): HistoricalSaleRecord[] {
    return this.#currentRecordsFor(batch =>
      batch.leagueId === leagueId
        && batch.seasonYear === seasonYear
        && batch.status === "committed",
    );
  }

  currentRecordsThroughSeason(leagueId: string, seasonYear: number): HistoricalSaleRecord[] {
    return this.#currentRecordsFor(batch =>
      batch.leagueId === leagueId
        && batch.seasonYear <= seasonYear
        && batch.status === "committed",
    );
  }

  #currentRecordsFor(
    batchFilter: (batch: HistoricalImportBatch) => boolean,
  ): HistoricalSaleRecord[] {
    const currentBatchIds = new Set(
      [...this.#batchesById.values()]
        .filter(batchFilter)
        .map(batch => batch.id),
    );

    return this.#records
      .filter(record => currentBatchIds.has(record.batchId))
      .map(record => structuredClone(record));
  }

  batches(): HistoricalImportBatch[] {
    return [...this.#batchesById.values()].map(batch => structuredClone(batch));
  }

  replaceLeagueSeasons(leagueSeasons: readonly LeagueSeason[]): void {
    this.#leagueSeasons.clear();

    for (const season of leagueSeasons) {
      const storedSeason = structuredClone(season);
      this.#leagueSeasons.set(seasonKey(storedSeason.leagueId, storedSeason.seasonYear), storedSeason);
    }
  }

  replaceBatchesAndRecords(
    batches: readonly HistoricalImportBatch[],
    records: readonly HistoricalSaleRecord[],
  ): void {
    this.#batchesById.clear();
    this.#records.length = 0;

    for (const batch of batches) {
      const storedBatch = structuredClone(batch);
      this.#batchesById.set(storedBatch.id, storedBatch);
    }

    this.#records.push(...records.map(record => structuredClone(record)));
  }
}

export const previewHistoricalImportBatch = async ({
  repository,
  leagueId,
  seasonYear,
  seasonContext,
  fileHash,
  uploadedByUserId,
  replacementRequested = false,
  ownerMappings = [],
  requireCompleteTeamMapping = false,
  rows,
  now = new Date(),
}: PreviewHistoricalImportBatchInput): Promise<HistoricalImportBatch> => {
  const existingBatch = replacementRequested
    ? null
    : await repository.findBatchByFileHash(leagueId, seasonYear, fileHash);

  if (existingBatch !== null && existingBatch.status !== "blocked") {
    return existingBatch;
  }

  const exactSeason = seasonContext === undefined
    ? await repository.findLeagueSeason(leagueId, seasonYear)
    : null;
  const season = seasonContext?.currentLeagueSeason ?? exactSeason;
  const seasonTemplateIsValid = season !== null
    && season.leagueId === leagueId
    && season.seasonYear >= seasonYear;
  const batchId = existingBatch?.id ?? [
      batchBaseId(leagueId, seasonYear, fileHash),
      String(await repository.nextBatchOrdinal(leagueId, seasonYear, fileHash)).padStart(3, "0"),
    ].join("-");
  const persistBatch = async (batch: HistoricalImportBatch): Promise<HistoricalImportBatch> =>
    existingBatch === null
      ? await repository.createBatch(batch)
      : await repository.updateBatch(batch);
  const batchCreatedAt = existingBatch?.createdAt ?? now;
  const batchUploader = uploadedByUserId ?? existingBatch?.uploadedByUserId;

  if (!seasonTemplateIsValid || season === null) {
    const blockerMessage = seasonContext === undefined
      ? `No season ${seasonYear} is configured for league ${leagueId}.`
      : `Current season context must belong to league ${leagueId} and cannot predate historical season ${seasonYear}.`;

    return await persistBatch({
      id: batchId,
      leagueId,
      leagueSeasonId: null,
      seasonYear,
      fileHash,
      ...(batchUploader === undefined ? {} : { uploadedByUserId: batchUploader }),
      status: "blocked",
      replacementRequested,
      createdAt: batchCreatedAt,
      blockers: [issue("season_missing", "blocker", blockerMessage)],
      warnings: [],
      rows: rows.map(importRow => ({
        rowNumber: importRow.sourceRowNumber,
        status: "blocked",
        blockers: [],
        warnings: [],
        record: null,
        identityAudit: {
          sourceOwnerOrTeamLabel: importRow.ownerDisplayName?.trim() ?? "",
          resolution: "unresolved",
        },
      })),
    });
  }

  const distinctHistoricalTeams = new Map<string, string>();
  for (const importRow of rows) {
    const sourceLabel = importRow.ownerDisplayName?.trim() ?? "";
    const normalizedLabel = normalizeIdentityLabel(sourceLabel);
    if (normalizedLabel.length > 0 && !distinctHistoricalTeams.has(normalizedLabel)) {
      distinctHistoricalTeams.set(normalizedLabel, sourceLabel);
    }
  }
  if (requireCompleteTeamMapping && distinctHistoricalTeams.size !== season.teams.length) {
    const teamCountBlocker = issue(
      "team_count_mismatch",
      "blocker",
      `This draft file contains ${distinctHistoricalTeams.size} teams, but the current league has ${season.teams.length} teams.`,
    );

    return await persistBatch({
      id: batchId,
      leagueId,
      leagueSeasonId: season.id,
      seasonYear,
      fileHash,
      ...(batchUploader === undefined ? {} : { uploadedByUserId: batchUploader }),
      status: "blocked",
      replacementRequested,
      createdAt: batchCreatedAt,
      blockers: [teamCountBlocker],
      warnings: [],
      rows: rows.map(importRow => ({
        rowNumber: importRow.sourceRowNumber,
        status: "blocked",
        blockers: [],
        warnings: [],
        record: null,
        identityAudit: {
          sourceOwnerOrTeamLabel: importRow.ownerDisplayName?.trim() ?? "",
          resolution: "unresolved",
        },
      })),
    });
  }

  const initialRowPreviews = rows.map((importRow, index): HistoricalImportRowPreview => {
    const rowBlockers: HistoricalImportIssue[] = [];
    const rowWarnings: HistoricalImportIssue[] = [];
    const rowNumber = importRow.sourceRowNumber;
    const teamResolution = teamResolutionForOwner(importRow.ownerDisplayName, season.teams, ownerMappings);
    const team = teamResolution.team;
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

    if (teamResolution.audit.resolution === "fuzzy" && team !== null) {
      rowWarnings.push(issue(
        "owner_fuzzy_match",
        "warning",
        `Matched historical owner or team label "${teamResolution.audit.sourceOwnerOrTeamLabel}" to current team "${team.displayName}".`,
        rowNumber,
        { sourceValue: teamResolution.audit.sourceOwnerOrTeamLabel },
      ));
    }

    if (importRow.seasonYear !== undefined && importRow.seasonYear !== seasonYear) {
      rowBlockers.push(issue("season_missing", "blocker", `Row season ${importRow.seasonYear} does not match import season ${seasonYear}.`, rowNumber));
    }

    if (team === null) {
      const ownerIssueCode = teamResolution.audit.resolution === "ambiguous"
        ? "owner_ambiguous"
        : "owner_unknown";
      rowBlockers.push(issue(
        ownerIssueCode,
        "blocker",
        ownerIssueCode === "owner_ambiguous"
          ? "Owner or team label matches multiple current teams. Choose the intended team."
          : "Owner or team label needs an explicit mapping to a current team.",
        rowNumber,
        {
          sourceValue: teamResolution.audit.sourceOwnerOrTeamLabel,
          ...(teamResolution.audit.candidates === undefined
            ? {}
            : { candidates: teamResolution.audit.candidates }),
        },
      ));
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

    if (
      importRow.publicPriceDollars !== undefined
      && (!Number.isInteger(importRow.publicPriceDollars) || importRow.publicPriceDollars <= 0)
    ) {
      rowBlockers.push(issue(
        "public_price_invalid",
        "blocker",
        "Same-season public value must be a positive whole dollar amount.",
        rowNumber,
      ));
    }

    if (importRow.playerResolution?.status === "ambiguous" && importRow.playerResolution.required) {
      rowBlockers.push(issue(
        "player_ambiguous",
        "blocker",
        "Multiple catalog players match this row. Choose the intended player before import.",
        rowNumber,
        {
          sourceValue: playerName,
          candidates: importRow.playerResolution.candidates,
        },
      ));
    }

    if (importRow.playerResolution?.status === "unresolved" && importRow.playerResolution.required) {
      const candidates = (importRow.playerResolution.candidates ?? [])
        .filter((candidate): candidate is HistoricalPlayerResolutionCandidate => typeof candidate !== "string");
      rowBlockers.push(issue(
        "player_unresolved",
        "blocker",
        "Player must be resolved before import commit.",
        rowNumber,
        {
          sourceValue: playerName,
          ...(candidates.length === 0 ? {} : { candidates }),
        },
      ));
    }

    if (
      playerName.length > 0
      && playerId === null
      && !rowBlockers.some(blocker =>
        blocker.code === "player_unresolved" || blocker.code === "player_ambiguous"
      )
    ) {
      rowBlockers.push(issue("player_unresolved", "blocker", "Player must be resolved before import commit.", rowNumber));
    }

    if (rowBlockers.length > 0 || team === null || position === null || playerName.length === 0 || playerId === null || importRow.priceDollars === undefined) {
      return {
        rowNumber,
        status: "blocked",
        blockers: rowBlockers,
        warnings: rowWarnings,
        record: null,
        identityAudit: teamResolution.audit,
      };
    }

    return {
      rowNumber,
      status: "ready",
      blockers: rowBlockers,
      warnings: rowWarnings,
      identityAudit: teamResolution.audit,
      record: {
        id: `${batchId}-row-${String(index + 1).padStart(3, "0")}`,
        batchId,
        leagueId,
        leagueSeasonId: season.id,
        seasonYear,
        rowNumber,
        ownerId: team.ownerId,
        ownerDisplayName: teamResolution.audit.sourceOwnerOrTeamLabel,
        playerId,
        playerName,
        position,
        priceDollars: importRow.priceDollars,
        ...(importRow.publicPriceDollars === undefined
          ? {}
          : { publicPriceDollars: importRow.publicPriceDollars }),
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
  const resolvedTeamByHistoricalLabel = new Map<string, string>();
  for (const rowPreview of rowPreviews) {
    const normalizedLabel = normalizeIdentityLabel(rowPreview.identityAudit?.sourceOwnerOrTeamLabel);
    const mappedTeamId = rowPreview.identityAudit?.mappedTeamId;
    if (normalizedLabel.length > 0 && mappedTeamId !== undefined) {
      resolvedTeamByHistoricalLabel.set(normalizedLabel, mappedTeamId);
    }
  }
  const resolvedCurrentTeamIds = [...resolvedTeamByHistoricalLabel.values()];
  const ownerMappingBlockers = requireCompleteTeamMapping
    && resolvedTeamByHistoricalLabel.size === distinctHistoricalTeams.size
    && new Set(resolvedCurrentTeamIds).size !== resolvedCurrentTeamIds.length
    ? [issue(
        "owner_mapping_not_one_to_one",
        "blocker",
        "Each historical team must map to a different current team.",
      )]
    : [];
  const blockers = [
    ...ownerMappingBlockers,
    ...rowPreviews.flatMap(rowPreview => rowPreview.blockers),
  ];
  const actualSpend = rowPreviews.reduce(
    (total, rowPreview) => total + (rowPreview.record?.priceDollars ?? 0),
    0,
  );
  const auctionBudget = season.settings.draftFormat === "snake"
    ? null
    : season.settings.auction.budgetDollars;
  const expectedSpend = auctionBudget === null
    ? null
    : season.teams.length * auctionBudget;
  const warnings = expectedSpend === null || actualSpend === expectedSpend
    ? []
    : [issue("season_spend_mismatch", "warning", `Imported spend is $${actualSpend}, expected $${expectedSpend}.`)];

  return await persistBatch({
    id: batchId,
    leagueId,
    leagueSeasonId: season.id,
    seasonYear,
    fileHash,
    ...(batchUploader === undefined ? {} : { uploadedByUserId: batchUploader }),
    status: blockers.length > 0 ? "blocked" : "previewed",
    replacementRequested,
    createdAt: batchCreatedAt,
    blockers,
    warnings,
    rows: rowPreviews,
  });
};

const runHistoricalImportTransaction = async <T>(
  repository: HistoricalImportRepository,
  operation: (repository: HistoricalImportRepository) => MaybePromise<T>,
): Promise<T> => {
  if (repository.withTransaction === undefined) return await operation(repository);

  return await repository.withTransaction(operation);
};

export const prepareHistoricalImportBatchCommit = async ({
  repository,
  batchId,
  expectedLeagueId,
  expectedLeagueSeasonId,
  expectedSeasonYear,
}: Omit<CommitHistoricalImportBatchInput, "now">): Promise<PreparedHistoricalImportCommit> => {
  const batch = await repository.findBatchById(batchId);
  if (batch === null) {
    throw new HistoricalImportError("batch_not_found", `Historical import batch ${batchId} was not found.`);
  }

  const targetMismatches = [
    expectedLeagueId !== undefined && batch.leagueId !== expectedLeagueId
      ? `league ${expectedLeagueId}`
      : null,
    expectedLeagueSeasonId !== undefined && batch.leagueSeasonId !== expectedLeagueSeasonId
      ? `league season ${expectedLeagueSeasonId}`
      : null,
    expectedSeasonYear !== undefined && batch.seasonYear !== expectedSeasonYear
      ? `historical season ${expectedSeasonYear}`
      : null,
  ].filter((mismatch): mismatch is string => mismatch !== null);
  if (targetMismatches.length > 0) {
    throw new HistoricalImportTargetError(
      `Historical import batch ${batchId} does not belong to the requested ${targetMismatches.join(" or ")}.`,
    );
  }

  if (batch.status === "blocked" || batch.blockers.length > 0) {
    throw new HistoricalImportError("batch_blocked", "Cannot commit historical import batch with blockers.");
  }

  const effectiveBatch = batch.status === "committed" || batch.status === "superseded"
    ? batch
    : await repository.findCommittedBatchByFileHash(batch.leagueId, batch.seasonYear, batch.fileHash) ?? batch;
  if (effectiveBatch.status !== "committed" && effectiveBatch.status !== "superseded") {
    const currentCommittedBatch = await repository.findCurrentCommittedBatch(batch.leagueId, batch.seasonYear);
    if (currentCommittedBatch !== null && !batch.replacementRequested) {
      throw new HistoricalImportError(
        "season_import_conflict",
        "Historical import batch already exists for this league season. Request replacement to supersede it.",
      );
    }
  }

  return {
    batch: effectiveBatch,
    committedRecords: effectiveBatch.rows.flatMap(row => row.record === null ? [] : [row.record]),
  };
};

export const commitHistoricalImportBatch = ({
  repository,
  batchId,
  expectedLeagueId,
  expectedLeagueSeasonId,
  expectedSeasonYear,
  now = new Date(),
}: CommitHistoricalImportBatchInput): Promise<HistoricalImportBatch> =>
  runHistoricalImportTransaction(repository, async transactionalRepository => {
    const batch = await transactionalRepository.findBatchById(batchId);

    if (batch === null) {
      throw new HistoricalImportError("batch_not_found", `Historical import batch ${batchId} was not found.`);
    }

    const targetMismatches = [
      expectedLeagueId !== undefined && batch.leagueId !== expectedLeagueId
        ? `league ${expectedLeagueId}`
        : null,
      expectedLeagueSeasonId !== undefined && batch.leagueSeasonId !== expectedLeagueSeasonId
        ? `league season ${expectedLeagueSeasonId}`
        : null,
      expectedSeasonYear !== undefined && batch.seasonYear !== expectedSeasonYear
        ? `historical season ${expectedSeasonYear}`
        : null,
    ].filter((mismatch): mismatch is string => mismatch !== null);
    if (targetMismatches.length > 0) {
      throw new HistoricalImportTargetError(
        `Historical import batch ${batchId} does not belong to the requested ${targetMismatches.join(" or ")}.`,
      );
    }

    if (batch.status === "committed" || batch.status === "superseded") {
      return batch;
    }

    if (batch.status === "blocked" || batch.blockers.length > 0) {
      throw new HistoricalImportError("batch_blocked", "Cannot commit historical import batch with blockers.");
    }

    const existingCommittedBatch = batch.replacementRequested
      ? null
      : await transactionalRepository.findCommittedBatchByFileHash(batch.leagueId, batch.seasonYear, batch.fileHash);

    if (existingCommittedBatch !== null) {
      return existingCommittedBatch;
    }

    const currentCommittedBatch = await transactionalRepository.findCurrentCommittedBatch(batch.leagueId, batch.seasonYear);

    if (currentCommittedBatch !== null) {
      if (!batch.replacementRequested) {
        throw new HistoricalImportError(
          "season_import_conflict",
          "Historical import batch already exists for this league season. Request replacement to supersede it.",
        );
      }

      await transactionalRepository.updateBatch({
        ...currentCommittedBatch,
        status: "superseded",
        supersededAt: now,
        supersededByBatchId: batch.id,
      });
    }

    const committedBatch = await transactionalRepository.updateBatch({
      ...batch,
      status: "committed",
      committedAt: now,
    });
    const records = committedBatch.rows.flatMap(rowPreview =>
      rowPreview.record === null ? [] : [rowPreview.record],
    );

    await transactionalRepository.addRecords(records);
    return committedBatch;
  });

const seasonKey = (leagueId: string, seasonYear: number): string => `${leagueId}:${seasonYear}`;
