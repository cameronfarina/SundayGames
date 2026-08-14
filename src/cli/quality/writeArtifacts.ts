import { writePrepOutputArtifacts } from "../../modeling/prepOutputs.js";
import type { buildPrepRun } from "./prepRun.js";

type PrepRun = Awaited<ReturnType<typeof buildPrepRun>>;

export const writePrepArtifacts = (
  prep: PrepRun,
  outputDirectory: string,
) => writePrepOutputArtifacts({
  batch: prep.batch,
  audit: prep.calibration,
  smokeReport: prep.smokeReport,
  historicalBacktest: prep.historicalBacktest,
  evidenceQueue: prep.evidenceQueue,
  evidenceCoverageAudit: prep.evidenceCoverageAudit,
  outlierQueue: prep.outlierQueue,
  keeperScenarioSensitivity: prep.keeperScenarioSensitivity,
  outputDirectory,
});
