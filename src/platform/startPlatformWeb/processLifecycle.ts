export interface ClosePlatformWebRuntimeDependencies {
  stopObserving: () => void;
  closeServer: () => Promise<void>;
  closePostgres: (() => Promise<void>) | undefined;
}

export const closePlatformWebRuntime = async (
  dependencies: ClosePlatformWebRuntimeDependencies,
): Promise<void> => {
  dependencies.stopObserving();
  try {
    await dependencies.closeServer();
  } finally {
    await dependencies.closePostgres?.();
  }
};

export const closePostgresAfterStartupFailure = async (
  closePostgres: (() => Promise<void>) | undefined,
): Promise<void> => {
  try {
    await closePostgres?.();
  } catch {
    // Preserve the startup failure; cleanup errors must not replace its cause.
  }
};
