import type { QaCheck, QaEvidenceCoverageInput } from "./contracts.js";

export const evidenceCoverageCheck = (coverage: QaEvidenceCoverageInput): QaCheck => ({
  key: "evidence-coverage",
  label: "Evidence coverage",
  status: coverage.summary.status,
  severity: "advisory",
  message: [
    `${coverage.summary.missingEvidenceCount} player(s) still missing evidence`,
    `${coverage.summary.highPriorityMissingCount} high-priority missing`,
    `${coverage.summary.provenanceIncompleteEvidenceCount ?? 0} evidence row(s) have incomplete provenance`,
  ].join("; ") + ".",
  topItems: [],
});
