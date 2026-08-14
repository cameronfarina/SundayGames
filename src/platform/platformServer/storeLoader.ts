import { FilePlatformStore } from "../filePlatformStore.js";
import { InMemoryPlatformStore } from "../platformApp.js";
import { PostgresPlatformStore } from "../postgresPlatformStore.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { LoadedPlatformStore } from "./internalContracts.js";
import { isTransactionalPostgresClient } from "./postgres.js";

export const loadPlatformStore = async (
  options: Pick<
    CreatePlatformServerOptions,
    "dataFilePath" | "initializePostgresSchema" | "now" | "postgresClient" | "postgresSnapshotKey"
  >,
): Promise<LoadedPlatformStore> => {
  if (options.dataFilePath !== undefined && options.postgresClient !== undefined) {
    throw new Error("Configure either dataFilePath or postgresClient, not both.");
  }
  if (options.postgresClient !== undefined) {
    if (options.initializePostgresSchema === true &&
        !isTransactionalPostgresClient(options.postgresClient)) {
      await PostgresPlatformStore.initializeSchema(options.postgresClient);
    }
    const postgresStore = await PostgresPlatformStore.load(options.postgresClient, {
      snapshotKey: options.postgresSnapshotKey,
      now: options.now,
    });
    return { store: postgresStore.store, postgresStore };
  }
  if (options.dataFilePath === undefined) return { store: new InMemoryPlatformStore() };
  const fileStore = await FilePlatformStore.load(options.dataFilePath);
  return { store: fileStore.store, fileStore };
};
