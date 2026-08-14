import type { EvidenceCoverageAudit } from "./contracts.js";

type CsvValue = string | number | boolean | undefined;
const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

export const playerEvidenceCoverageGatesCsv = (audit: EvidenceCoverageAudit): string => [
  ["key", "label", "status", "target", "actual", "delta", "warn_threshold", "fail_threshold"]
    .map(csvCell).join(","),
  ...audit.gates.items.map(gate => [
    gate.key,
    gate.label,
    gate.status,
    gate.target,
    gate.actual,
    gate.delta,
    gate.warnThreshold,
    gate.failThreshold,
  ].map(csvCell).join(",")),
].join("\n");
