// Browser wording differs: Chrome/Firefox mention "dynamically imported
// module", Safari says "Importing a module script failed."
const STALE_CHUNK_PATTERNS = [
  /dynamically imported module/iu,
  /importing a module script failed/iu,
];

const RELOADED_AT_KEY = "staleChunkReloadedAt";
const RELOAD_LOOP_WINDOW_MS = 10_000;

export const isStaleChunkError = (error: unknown): boolean => (
  error instanceof Error
  && STALE_CHUNK_PATTERNS.some(pattern => pattern.test(error.message))
);

export const reloadOnceForStaleChunk = (
  storage: Pick<Storage, "getItem" | "setItem">,
  now: () => number,
  reload: () => void,
): boolean => {
  const reloadedAt = Number(storage.getItem(RELOADED_AT_KEY));
  const withinLoopWindow = Number.isFinite(reloadedAt)
    && now() - reloadedAt < RELOAD_LOOP_WINDOW_MS;
  if (withinLoopWindow) return false;
  storage.setItem(RELOADED_AT_KEY, String(now()));
  reload();
  return true;
};
