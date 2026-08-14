import { join } from "node:path";
import { calibrationArtifacts } from "./calibrationArtifacts.js";
import { coreArtifacts } from "./coreArtifacts.js";
import { diagnosticArtifacts } from "./diagnosticArtifacts.js";
import { evidenceArtifacts } from "./evidenceArtifacts.js";
import type { BuildPrepOutputArtifactsOptions, PrepOutputArtifact } from "./types.js";

export const buildPrepOutputArtifacts = (
  options: BuildPrepOutputArtifactsOptions,
): PrepOutputArtifact[] => [
  ...coreArtifacts(options),
  ...evidenceArtifacts(options),
  ...diagnosticArtifacts(options),
  ...calibrationArtifacts(options),
].map(file => ({
  ...file,
  path: join(options.outputDirectory, file.filename),
}));
