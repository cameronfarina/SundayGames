import { join } from "node:path";
import { FileBackedLiveDraftSessionStore } from "../liveDraftSessionStore.js";
import { interactiveMockSessionDirectoryName, scratchSessionPrefix } from "./constants.js";
import type { LiveDraftSessionMode } from "./contracts.js";
import { ScratchSessionsDisabledError } from "./http.js";
import type { StoreService } from "./runtimeContracts.js";
import { draftSessionDirectoryFor } from "./sessionInput.js";

interface StorePair {
  real: FileBackedLiveDraftSessionStore;
  interactiveMock: FileBackedLiveDraftSessionStore;
}

export const createStoreService = async ({
  baseDirectory,
  scratchSessionsEnabled,
  initialSessionKey,
}: {
  baseDirectory: string;
  scratchSessionsEnabled: boolean;
  initialSessionKey: string;
}): Promise<StoreService> => {
  const pairs = new Map<string, Promise<StorePair>>();
  const mutationQueues = new Map<string, Promise<void>>();

  const assertEnabled = (draftSessionKey: string): void => {
    if (!scratchSessionsEnabled && draftSessionKey.startsWith(scratchSessionPrefix)) {
      throw new ScratchSessionsDisabledError();
    }
  };

  const pairFor = (draftSessionKey: string): Promise<StorePair> => {
    assertEnabled(draftSessionKey);
    const existing = pairs.get(draftSessionKey);
    if (existing) return existing;
    const sessionDirectory = draftSessionDirectoryFor(baseDirectory, draftSessionKey);
    const real = new FileBackedLiveDraftSessionStore({ directory: sessionDirectory });
    const interactiveMock = new FileBackedLiveDraftSessionStore({
      directory: join(sessionDirectory, interactiveMockSessionDirectoryName),
    });
    const loaded = Promise.all([real.load(), interactiveMock.load()])
      .then(() => ({ real, interactiveMock }));
    pairs.set(draftSessionKey, loaded);
    return loaded;
  };

  const storeFor = async (
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
  ): Promise<FileBackedLiveDraftSessionStore> => {
    const pair = await pairFor(draftSessionKey);
    return mode === "interactive-mock" ? pair.interactiveMock : pair.real;
  };

  const runQueuedMutation = async <T>(
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
    mutation: () => Promise<T>,
  ): Promise<T> => {
    const key = `${draftSessionKey}\u0000${mode}`;
    const previous = mutationQueues.get(key) ?? Promise.resolve();
    const queued = previous.then(mutation, mutation);
    mutationQueues.set(key, queued.then(() => undefined, () => undefined));
    return queued;
  };

  await pairFor(initialSessionKey);
  return { storeFor, runQueuedMutation };
};
