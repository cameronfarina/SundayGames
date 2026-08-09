import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  InMemoryPlatformStore,
  type InMemoryPlatformStoreSnapshot,
} from "./platformApp.js";
import type { JobRecord, JsonValue } from "./jobs.js";

export interface FilePlatformStoreSnapshot extends InMemoryPlatformStoreSnapshot {
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

const emptySnapshot = (): InMemoryPlatformStoreSnapshot => ({
  auth: {
    accountCredentials: [],
    sessions: [],
  },
  leagueSeasons: [],
  memberships: [],
  mockDraftSessions: [],
  simulationRuns: [],
  liveDraftRooms: [],
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

const snapshotFileFor = (snapshot: InMemoryPlatformStoreSnapshot): FilePlatformStoreSnapshot => ({
  schemaVersion: 1,
  ...snapshot,
});

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

const snapshotFromFile = (file: Partial<FilePlatformStoreSnapshot>): InMemoryPlatformStoreSnapshot => {
  const empty = emptySnapshot();

  return {
    auth: file.auth ?? empty.auth,
    leagueSeasons: file.leagueSeasons ?? empty.leagueSeasons,
    memberships: file.memberships ?? empty.memberships,
    mockDraftSessions: file.mockDraftSessions ?? empty.mockDraftSessions,
    simulationRuns: file.simulationRuns ?? empty.simulationRuns,
    liveDraftRooms: file.liveDraftRooms ?? empty.liveDraftRooms,
    historicalImportBatches: file.historicalImportBatches ?? empty.historicalImportBatches,
    historicalSaleRecords: file.historicalSaleRecords ?? empty.historicalSaleRecords,
    pricingSnapshots: (file.pricingSnapshots ?? empty.pricingSnapshots).map(normalizePricingSnapshot),
    jobs: (file.jobs ?? empty.jobs).map(normalizeRevivedJob),
    exportArtifacts: file.exportArtifacts ?? empty.exportArtifacts,
    exportArtifactContents: file.exportArtifactContents ?? empty.exportArtifactContents,
  };
};

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const writeJsonAtomically = async (path: string, content: string): Promise<void> => {
  const directory = dirname(path);
  const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, content, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
};

export const readPlatformStoreSnapshot = async (path: string): Promise<InMemoryPlatformStoreSnapshot> => {
  let content: string;

  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) return emptySnapshot();

    throw error;
  }

  return snapshotFromFile(JSON.parse(content, reviveDate) as Partial<FilePlatformStoreSnapshot>);
};

export const writePlatformStoreSnapshot = async (
  path: string,
  snapshot: InMemoryPlatformStoreSnapshot,
): Promise<void> => {
  await writeJsonAtomically(path, `${JSON.stringify(snapshotFileFor(snapshot), null, 2)}\n`);
};

export class FilePlatformStore {
  readonly store: InMemoryPlatformStore;

  constructor(
    readonly path: string,
    store = new InMemoryPlatformStore(),
  ) {
    this.store = store;
  }

  static async load(path: string): Promise<FilePlatformStore> {
    return new FilePlatformStore(path, new InMemoryPlatformStore(await readPlatformStoreSnapshot(path)));
  }

  save(): Promise<void> {
    return writePlatformStoreSnapshot(this.path, this.store.snapshot());
  }
}
