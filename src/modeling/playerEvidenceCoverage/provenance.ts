import type { PlayerEvidenceQueueRow } from "../playerEvidenceQueue.js";
import type { EvidenceProvenanceIssue } from "./contracts.js";

type RequiredProvenanceField = "source" | "note";
type OptionalMetadataField = "provider" | "sourceDate" | "sourceQuality";
const requiredFields: readonly RequiredProvenanceField[] = ["source", "note"];
const metadataFields: readonly OptionalMetadataField[] = ["provider", "sourceDate", "sourceQuality"];

const hasText = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

export const missingProvenanceFieldsFor = (
  evidence: NonNullable<PlayerEvidenceQueueRow["currentEvidence"]>[number],
): string[] => {
  const missingFields: string[] = requiredFields
    .filter(field => !hasText(evidence[field]));
  const presentMetadataFields = metadataFields.filter(field => hasText(evidence[field]));
  if (presentMetadataFields.length > 0 && presentMetadataFields.length < metadataFields.length) {
    missingFields.push(...metadataFields.filter(field => !hasText(evidence[field])));
  }
  return missingFields;
};

export const provenanceIssueFor = (
  row: PlayerEvidenceQueueRow,
): EvidenceProvenanceIssue | undefined => {
  const incompleteEvidence = (row.currentEvidence ?? [])
    .map(missingProvenanceFieldsFor)
    .filter(missingFields => missingFields.length > 0);
  if (incompleteEvidence.length === 0) return undefined;
  return {
    priority: row.priority,
    rank: row.rank,
    player: row.player,
    position: row.position,
    incompleteEvidenceCount: incompleteEvidence.length,
    missingFields: [...new Set(incompleteEvidence.flat())],
  };
};
