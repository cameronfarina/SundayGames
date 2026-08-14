import type { PlayerEvidenceQueuePriority, PlayerEvidenceQueueRow } from "../playerEvidenceQueue.js";

export type EvidenceCoverageStatus = "pass" | "warn" | "fail";

export interface EvidenceCoverageGate {
  key: string;
  label: string;
  status: EvidenceCoverageStatus;
  target: number;
  actual: number;
  delta: number;
  warnThreshold: number;
  failThreshold: number;
}

export interface MissingEvidencePlayer {
  priority: PlayerEvidenceQueuePriority;
  rank: number;
  player: string;
  position: string;
  scenarioPrice: number;
  categories: PlayerEvidenceQueueRow["categories"];
}

export interface EvidenceProvenanceIssue {
  priority: PlayerEvidenceQueuePriority;
  rank: number;
  player: string;
  position: string;
  incompleteEvidenceCount: number;
  missingFields: string[];
}

export interface EvidenceCoverageAudit {
  summary: EvidenceCoverageSummary;
  gates: { summary: EvidenceCoverageGateSummary; items: EvidenceCoverageGate[] };
  missingPlayers: MissingEvidencePlayer[];
  provenanceIssues: EvidenceProvenanceIssue[];
}

export interface EvidenceCoverageSummary {
  status: EvidenceCoverageStatus;
  playerCount: number;
  coveredPlayerCount: number;
  completeEvidenceCount: number;
  missingEvidenceCount: number;
  partialEvidenceCount: number;
  highPriorityMissingCount: number;
  evidenceRowCount: number;
  provenanceCompleteEvidenceCount: number;
  provenanceIncompleteEvidenceCount: number;
  coverageRate: number;
  completeEvidenceRate: number;
  provenanceCompleteEvidenceRate: number;
}

export interface EvidenceCoverageGateSummary {
  status: EvidenceCoverageStatus;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}
