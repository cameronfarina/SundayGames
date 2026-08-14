import type { PlayerEvidenceQueue, PlayerEvidenceQueueRow } from "../playerEvidenceQueue.js";
import type { EvidenceCoverageAudit, EvidenceCoverageGate, MissingEvidencePlayer } from "./contracts.js";
import {
  failingCompleteEvidenceRate,
  failingCoverageRate,
  failingProvenanceRate,
  gateSummary,
  minimumCompleteEvidenceRate,
  minimumCoverageRate,
  minimumProvenanceRate,
  rate,
  rateGateStatus,
  roundToTwo,
} from "./gates.js";
import { missingProvenanceFieldsFor, provenanceIssueFor } from "./provenance.js";

const missingPlayerFor = (row: PlayerEvidenceQueueRow): MissingEvidencePlayer => ({
  priority: row.priority,
  rank: row.rank,
  player: row.player,
  position: row.position,
  scenarioPrice: row.scenarioPrice,
  categories: row.categories,
});

const rateGate = (
  key: string,
  label: string,
  actual: number,
  target: number,
  failThreshold: number,
): EvidenceCoverageGate => ({
  key,
  label,
  status: rateGateStatus(actual, target, failThreshold),
  target,
  actual,
  delta: roundToTwo(actual - target),
  warnThreshold: target,
  failThreshold,
});

export const buildPlayerEvidenceCoverageAudit = (queue: PlayerEvidenceQueue): EvidenceCoverageAudit => {
  const playerCount = queue.rows.length;
  const missingRows = queue.rows.filter(row => row.evidenceStatus === "missing");
  const partialEvidenceCount = queue.rows.filter(row => row.evidenceStatus === "partial").length;
  const completeEvidenceCount = queue.rows.filter(row => row.evidenceStatus === "present").length;
  const coveredPlayerCount = partialEvidenceCount + completeEvidenceCount;
  const highPriorityMissingCount = missingRows.filter(row => row.priority === "high").length;
  const coverageRate = rate(coveredPlayerCount, playerCount);
  const completeEvidenceRate = rate(completeEvidenceCount, playerCount);
  const evidenceRows = queue.rows.flatMap(row => row.currentEvidence ?? []);
  const evidenceRowCount = evidenceRows.length;
  const provenanceIncompleteEvidenceCount = evidenceRows
    .filter(evidence => missingProvenanceFieldsFor(evidence).length > 0).length;
  const provenanceCompleteEvidenceCount = evidenceRowCount - provenanceIncompleteEvidenceCount;
  const provenanceCompleteEvidenceRate = rate(provenanceCompleteEvidenceCount, evidenceRowCount);
  const gates: EvidenceCoverageGate[] = [
    {
      key: "high-priority-missing",
      label: "High-priority missing evidence",
      status: highPriorityMissingCount > 0 ? "fail" : "pass",
      target: 0,
      actual: highPriorityMissingCount,
      delta: highPriorityMissingCount,
      warnThreshold: 1,
      failThreshold: 1,
    },
    rateGate("evidence-coverage-rate", "Evidence coverage rate", coverageRate,
      minimumCoverageRate, failingCoverageRate),
    rateGate("complete-evidence-rate", "Complete evidence rate", completeEvidenceRate,
      minimumCompleteEvidenceRate, failingCompleteEvidenceRate),
    rateGate("evidence-provenance-rate", "Evidence provenance rate", provenanceCompleteEvidenceRate,
      minimumProvenanceRate, failingProvenanceRate),
  ];
  const summary = gateSummary(gates);
  return {
    summary: {
      status: summary.status,
      playerCount,
      coveredPlayerCount,
      completeEvidenceCount,
      missingEvidenceCount: missingRows.length,
      partialEvidenceCount,
      highPriorityMissingCount,
      evidenceRowCount,
      provenanceCompleteEvidenceCount,
      provenanceIncompleteEvidenceCount,
      coverageRate,
      completeEvidenceRate,
      provenanceCompleteEvidenceRate,
    },
    gates: { summary, items: gates },
    missingPlayers: missingRows.map(missingPlayerFor),
    provenanceIssues: queue.rows.flatMap(row => {
      const issue = provenanceIssueFor(row);
      return issue === undefined ? [] : [issue];
    }),
  };
};
