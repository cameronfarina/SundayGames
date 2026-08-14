import { readFile, rm, writeFile } from "node:fs/promises";

const hasErrorCode = (error: unknown): error is Error & { code: unknown } =>
  error instanceof Error && "code" in error;

const isMissingFileError = (error: unknown): boolean =>
  hasErrorCode(error) && error.code === "ENOENT";

export const auditLineCount = async (path: string): Promise<number> => {
  try {
    const content = await readFile(path, "utf8");
    const trimmed = content.trim();
    return trimmed ? trimmed.split("\n").length : 0;
  } catch (error) {
    if (isMissingFileError(error)) return 0;
    throw error;
  }
};

export const readFileIfPresent = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
};

export const restoreFile = async (path: string, content: string | undefined): Promise<void> => {
  if (content === undefined) {
    await rm(path, { force: true });
    return;
  }
  await writeFile(path, content, "utf8");
};
