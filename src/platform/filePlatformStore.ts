import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
  serializePlatformStoreSnapshot,
  type SerializedPlatformStoreSnapshot,
} from "./platformStoreSnapshotCodec.js";
import {
  InMemoryPlatformStore,
  type InMemoryPlatformStoreSnapshot,
} from "./platformApp.js";

export interface FilePlatformStoreSnapshot extends SerializedPlatformStoreSnapshot {}

interface FilePlatformAuthSnapshot {
  readonly schemaVersion: 1;
  readonly auth: InMemoryPlatformStoreSnapshot["auth"];
}

const writePlatformAuthSnapshot = async (
  path: string,
  auth: InMemoryPlatformStoreSnapshot["auth"],
): Promise<void> => {
  const value: FilePlatformAuthSnapshot = { schemaVersion: 1, auth };
  await writeJsonAtomically(path, `${JSON.stringify(value)}\n`);
};

const emptyAuthSnapshot = (): InMemoryPlatformStoreSnapshot["auth"] => ({
  accountCredentials: [],
  sessions: [],
});

const containsAuthRecords = (auth: InMemoryPlatformStoreSnapshot["auth"]): boolean =>
  auth.accountCredentials.length > 0 || auth.sessions.length > 0;

const withoutEmbeddedAuth = (
  snapshot: InMemoryPlatformStoreSnapshot,
): InMemoryPlatformStoreSnapshot => ({
  ...snapshot,
  auth: emptyAuthSnapshot(),
});

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const writeJsonAtomically = async (path: string, content: string): Promise<void> => {
  const directory = dirname(path);
  const temporaryPath = join(directory, `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);

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
    if (isNotFoundError(error)) return emptyPlatformStoreSnapshot();

    throw error;
  }
  if (content.trim().length === 0) return emptyPlatformStoreSnapshot();

  return deserializePlatformStoreSnapshot(JSON.parse(content) as Partial<FilePlatformStoreSnapshot>);
};

export const writePlatformStoreSnapshot = async (
  path: string,
  snapshot: InMemoryPlatformStoreSnapshot,
): Promise<void> => {
  await writeJsonAtomically(path, `${JSON.stringify(serializePlatformStoreSnapshot(snapshot))}\n`);
};

const readPlatformAuthSnapshot = async (
  path: string,
): Promise<InMemoryPlatformStoreSnapshot["auth"] | null> => {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
  if (content.trim().length === 0) return null;

  const value = JSON.parse(content) as Partial<FilePlatformAuthSnapshot>;
  return value.auth === undefined
    ? null
    : deserializePlatformStoreSnapshot(value).auth;
};

export const migrateLegacyPlatformAuthSnapshot = async (
  path: string,
  snapshot: InMemoryPlatformStoreSnapshot,
): Promise<void> => {
  await writePlatformAuthSnapshot(`${path}.auth.json`, snapshot.auth);
  await writePlatformStoreSnapshot(path, withoutEmbeddedAuth(snapshot));
};

export class FilePlatformStore {
  readonly store: InMemoryPlatformStore;
  readonly authPath: string;
  #saveQueue: Promise<void> = Promise.resolve();

  constructor(
    readonly path: string,
    store = new InMemoryPlatformStore(),
  ) {
    this.store = store;
    this.authPath = `${path}.auth.json`;
  }

  static async load(path: string): Promise<FilePlatformStore> {
    const snapshot = await readPlatformStoreSnapshot(path);
    const auth = await readPlatformAuthSnapshot(`${path}.auth.json`);
    const fileStore = new FilePlatformStore(path, new InMemoryPlatformStore({
      ...snapshot,
      ...(auth === null ? {} : { auth }),
    }));

    // Migrate legacy snapshots once so deleting the auth sidecar can never
    // resurrect credentials or sessions embedded in the workspace file.
    if (containsAuthRecords(snapshot.auth)) {
      await migrateLegacyPlatformAuthSnapshot(path, {
        ...snapshot,
        auth: fileStore.store.authSnapshot(),
      });
    }

    return fileStore;
  }

  async save(): Promise<void> {
    const snapshot = this.store.snapshot();
    await this.#enqueueSave(async () => {
      await this.#writeAuth(snapshot.auth);
      await writePlatformStoreSnapshot(this.path, withoutEmbeddedAuth(snapshot));
    });
  }

  saveAuth(auth = this.store.authSnapshot()): Promise<void> {
    return this.#enqueueSave(() => this.#writeAuth(auth));
  }

  #writeAuth(auth: InMemoryPlatformStoreSnapshot["auth"]): Promise<void> {
    return writePlatformAuthSnapshot(this.authPath, auth);
  }

  #enqueueSave(operation: () => Promise<void>): Promise<void> {
    const queued = this.#saveQueue.then(operation, operation);
    this.#saveQueue = queued.catch(() => undefined);
    return queued;
  }
}
