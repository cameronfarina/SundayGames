import {
  InMemoryPlatformStore,
  type InMemoryPlatformStoreSnapshot,
} from "../platformApp.js";
import {
  containsAuthRecords,
  readPlatformAuthSnapshot,
  writePlatformAuthSnapshot,
} from "./authSnapshot.js";
import { migrateLegacyPlatformAuthSnapshot } from "./migration.js";
import {
  readPlatformStoreSnapshot,
  withoutEmbeddedAuth,
  writePlatformStoreSnapshot,
} from "./workspaceSnapshot.js";

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
