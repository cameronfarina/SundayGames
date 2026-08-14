import type { CliArguments } from "../arguments.js";
import { buildPrepRun } from "../quality/prepRun.js";
import { writePrepArtifacts } from "../quality/writeArtifacts.js";

export const runOutputsCommand = async (arguments_: CliArguments): Promise<void> => {
  const prep = await buildPrepRun(arguments_, "mockd");
  const outputDirectory = arguments_.option("--out") ?? "data/processed/mock-prep";
  const artifacts = await writePrepArtifacts(prep, outputDirectory);
  console.log(JSON.stringify({
    options: prep.batch.options,
    outputDirectory,
    files: artifacts.map(artifact => ({
      filename: artifact.filename,
      path: artifact.path,
    })),
  }, null, 2));
};
