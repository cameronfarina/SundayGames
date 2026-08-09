import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
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
    if (isNotFoundError(error)) return emptyPlatformStoreSnapshot();

    throw error;
  }

  return deserializePlatformStoreSnapshot(JSON.parse(content) as Partial<FilePlatformStoreSnapshot>);
};

export const writePlatformStoreSnapshot = async (
  path: string,
  snapshot: InMemoryPlatformStoreSnapshot,
): Promise<void> => {
  await writeJsonAtomically(path, `${JSON.stringify(serializePlatformStoreSnapshot(snapshot), null, 2)}\n`);
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
