import { lstat } from "node:fs/promises";

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

export const requireMissingPath = async (path: string, label: string): Promise<void> => {
  try {
    await lstat(path);
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }

  throw new Error(`${label} already exists: ${path}`);
};
