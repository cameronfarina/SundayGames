export const defaultMaxAttempts = 3;
export const defaultLockTtlMs = 60_000;

export const queuedProgress = (): { completed: number; total: number; message: string } => ({
  completed: 0,
  total: 1,
  message: "Queued",
});
