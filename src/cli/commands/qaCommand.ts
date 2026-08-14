import { buildQaReport } from "../../modeling/qaReport.js";
import type { CliArguments } from "../arguments.js";
import { buildPrepRun } from "../quality/prepRun.js";
import { writePrepArtifacts } from "../quality/writeArtifacts.js";

export const runQaCommand = async (arguments_: CliArguments): Promise<number> => {
  const prep = await buildPrepRun(arguments_, "qa");
  const outputDirectory = arguments_.option("--out");
  const artifacts = outputDirectory
    ? await writePrepArtifacts(prep, outputDirectory)
    : [];
  const report = buildQaReport({
    options: prep.batch.options,
    smoke: prep.smokeReport,
    calibration: prep.calibration,
    backtest: prep.historicalBacktest,
    evidenceCoverage: prep.evidenceCoverageAudit,
    artifactPaths: artifacts.map(artifact => artifact.path),
  });
  console.log(JSON.stringify(report, null, 2));
  return report.recommendedExitCode;
};
