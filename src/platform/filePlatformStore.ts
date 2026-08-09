import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  InMemoryPlatformStore,
  type InMemoryPlatformStoreSnapshot,
} from "./platformApp.js";

export interface FilePlatformStoreSnapshot extends InMemoryPlatformStoreSnapshot {
  schemaVersion: 1;
}

const dateKeys = new Set([
  "abandonedAt",
  "completedAt",
  "createdAt",
  "endedAt",
  "expiresAt",
  "occurredAt",
  "revokedAt",
  "startsAt",
  "startedAt",
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

const snapshotFromFile = (file: Partial<FilePlatformStoreSnapshot>): InMemoryPlatformStoreSnapshot => {
  const empty = emptySnapshot();

  return {
    auth: file.auth ?? empty.auth,
    leagueSeasons: file.leagueSeasons ?? empty.leagueSeasons,
    memberships: file.memberships ?? empty.memberships,
    mockDraftSessions: file.mockDraftSessions ?? empty.mockDraftSessions,
    simulationRuns: file.simulationRuns ?? empty.simulationRuns,
    liveDraftRooms: file.liveDraftRooms ?? empty.liveDraftRooms,
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
