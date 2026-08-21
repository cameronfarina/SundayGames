// Browser wording differs: Chrome/Firefox mention "dynamically imported
// module", Safari says "Importing a module script failed", and Vite reports
// a stylesheet from an older deploy as "Unable to preload CSS".
const STALE_CHUNK_PATTERNS = [
  /dynamically imported module/iu,
  /importing a module script failed/iu,
  /unable to preload css/iu,
];

const RELOADED_FOR_KEY = "staleChunkReloadedFor";

export const isStaleChunkError = (error: unknown): error is Error => (
  error instanceof Error
  && STALE_CHUNK_PATTERNS.some(pattern => pattern.test(error.message))
);

export const staleChunkReloadSignature = (
  error: Error,
  applicationAssetIdentity: string,
): string => `${applicationAssetIdentity}\n${error.message}`;

export const reloadOnceForStaleChunk = (
  failureSignature: string,
  storage: Pick<Storage, "getItem" | "setItem">,
  reload: () => void,
): boolean => {
  if (storage.getItem(RELOADED_FOR_KEY) === failureSignature) return false;
  storage.setItem(RELOADED_FOR_KEY, failureSignature);
  reload();
  return true;
};
