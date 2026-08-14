import { mkdir, writeFile } from "node:fs/promises";
import { buildPrepOutputArtifacts } from "./buildArtifacts.js";
import type { BuildPrepOutputArtifactsOptions, PrepOutputArtifact } from "./types.js";

export const writePrepOutputArtifacts = async (
  options: BuildPrepOutputArtifactsOptions,
): Promise<PrepOutputArtifact[]> => {
  const artifacts = buildPrepOutputArtifacts(options);
  await mkdir(options.outputDirectory, { recursive: true });

  for (const artifact of artifacts) {
    await writeFile(artifact.path, artifact.content, "utf8");
  }

  return artifacts;
};
