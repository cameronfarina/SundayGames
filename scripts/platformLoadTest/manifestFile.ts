import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

const isWithin = (parent: string, child: string): boolean => {
  const pathFromParent = relative(parent, child);
  return pathFromParent === "" || (!pathFromParent.startsWith("..") && !isAbsolute(pathFromParent));
};

export const validatedLoadManifestPath = async (
  manifestPath: string,
  repositoryPath = process.cwd(),
): Promise<string> => {
  const [resolvedManifest, resolvedRepository] = await Promise.all([
    realpath(manifestPath),
    realpath(repositoryPath),
  ]);
  if (isWithin(resolvedRepository, resolvedManifest)) {
    throw new Error("Store the platform load-test manifest outside the repository.");
  }
  const manifestStat = await stat(resolvedManifest);
  if ((manifestStat.mode & 0o777) !== 0o600) {
    throw new Error("Platform load-test manifest permissions must be mode 0600.");
  }
  return resolvedManifest;
};
