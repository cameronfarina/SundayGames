import type { JobRecord, JsonValue } from "./jobs.js";
import {
  normalizeLeagueSeasonSettings,
  type LeagueSeason,
} from "./leagueSeason.js";
import type { InMemoryPlatformStoreSnapshot } from "./platformApp.js";
import { normalizePersistedMockDraftSession } from "./mockSessions.js";

export interface SerializedPlatformStoreSnapshot extends InMemoryPlatformStoreSnapshot {
  schemaVersion: 1;
}

const dateKeys = new Set([
  "abandonedAt",
  "completedAt",
  "committedAt",
  "cancellationRequestedAt",
  "createdAt",
  "endedAt",
  "expiresAt",
  "finishedAt",
  "heartbeatAt",
  "lockedAt",
  "lockExpiresAt",
  "occurredAt",
  "revokedAt",
  "startsAt",
  "startedAt",
  "supersededAt",
  "updatedAt",
]);

export const emptyPlatformStoreSnapshot = (): InMemoryPlatformStoreSnapshot => ({
  auth: {
    accountCredentials: [],
    sessions: [],
  },
  leagueSeasons: [],
  memberships: [],
  mockDraftSessions: [],
  simulationRuns: [],
  practiceShortlistItems: [],
  liveDraftRooms: [],
  liveDraftRoomSetups: [],
  historicalImportBatches: [],
  historicalSaleRecords: [],
  pricingSnapshots: [],
  jobs: [],
  exportArtifacts: [],
  exportArtifactContents: [],
});

const reviveDate = (key: string, value: unknown): unknown => {
  if (typeof value !== "string" || !dateKeys.has(key)) return value;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date;
};

type PricingSnapshot = InMemoryPlatformStoreSnapshot["pricingSnapshots"][number];

const normalizeRevivedJsonValue = (value: unknown): JsonValue | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(item => normalizeRevivedJsonValue(item) ?? null);
  }
  if (typeof value !== "object") {
    return undefined;
  }

  const normalized: Record<string, JsonValue> = {};
  for (const [key, childValue] of Object.entries(value)) {
    const normalizedChildValue = normalizeRevivedJsonValue(childValue);
    if (normalizedChildValue !== undefined) {
      normalized[key] = normalizedChildValue;
    }
  }

  return normalized;
};

const normalizeRevivedJob = (job: JobRecord): JobRecord => ({
  ...job,
  inputJson: normalizeRevivedJsonValue(job.inputJson) ?? null,
  resultSummary: normalizeRevivedJsonValue(job.resultSummary),
});

const normalizePricingSnapshot = (snapshot: PricingSnapshot): PricingSnapshot => {
  const createdAt = snapshot.createdAt as unknown;

  return createdAt instanceof Date
    ? {
      ...snapshot,
      createdAt: createdAt.toISOString(),
    }
    : snapshot;
};

const normalizeLeagueSeason = (season: LeagueSeason): LeagueSeason => ({
  ...season,
  settings: normalizeLeagueSeasonSettings(season.settings),
});

const reviveSnapshotValue = (value: unknown): Partial<SerializedPlatformStoreSnapshot> =>
  JSON.parse(JSON.stringify(value), reviveDate) as Partial<SerializedPlatformStoreSnapshot>;

export const serializePlatformStoreSnapshot = (
  snapshot: InMemoryPlatformStoreSnapshot,
): SerializedPlatformStoreSnapshot => ({
  schemaVersion: 1,
  ...snapshot,
  leagueSeasons: snapshot.leagueSeasons.map(normalizeLeagueSeason),
  mockDraftSessions: snapshot.mockDraftSessions.map(normalizePersistedMockDraftSession),
});

export const deserializePlatformStoreSnapshot = (
  value: unknown,
): InMemoryPlatformStoreSnapshot => {
  const file = reviveSnapshotValue(value);
  const empty = emptyPlatformStoreSnapshot();

  return {
    auth: file.auth ?? empty.auth,
    leagueSeasons: (file.leagueSeasons ?? empty.leagueSeasons).map(normalizeLeagueSeason),
    memberships: file.memberships ?? empty.memberships,
    mockDraftSessions: (file.mockDraftSessions ?? empty.mockDraftSessions).map(normalizePersistedMockDraftSession),
    simulationRuns: file.simulationRuns ?? empty.simulationRuns,
    practiceShortlistItems: file.practiceShortlistItems ?? empty.practiceShortlistItems,
    liveDraftRooms: file.liveDraftRooms ?? empty.liveDraftRooms,
    liveDraftRoomSetups: file.liveDraftRoomSetups ?? empty.liveDraftRoomSetups,
    historicalImportBatches: file.historicalImportBatches ?? empty.historicalImportBatches,
    historicalSaleRecords: file.historicalSaleRecords ?? empty.historicalSaleRecords,
    pricingSnapshots: (file.pricingSnapshots ?? empty.pricingSnapshots).map(normalizePricingSnapshot),
    jobs: (file.jobs ?? empty.jobs).map(normalizeRevivedJob),
    exportArtifacts: file.exportArtifacts ?? empty.exportArtifacts,
    exportArtifactContents: file.exportArtifactContents ?? empty.exportArtifactContents,
  };
};
