import { draftExportSlotOrder, type DraftExportRosterSlotKey } from "../draftExport.js";
import type { JobRecord } from "../jobs.js";
import { platformJobTypes } from "../platformJobOrchestrator.js";

const draftExportSlotKeys = new Set<string>(draftExportSlotOrder);

export const cloneForRead = <T>(value: T): T => structuredClone(value);

export const isExportSlotKey = (slot: string): slot is DraftExportRosterSlotKey =>
  draftExportSlotKeys.has(slot);

interface JobInputRecord {
  readonly type?: unknown;
  readonly simulationRunId?: unknown;
}

const isJobInputRecord = (value: unknown): value is JobInputRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const simulationRunIdForJob = (job: JobRecord): string | null => {
  if (!isJobInputRecord(job.inputJson)) return null;

  return (job.inputJson.type === platformJobTypes.simulationRunExecution ||
      job.inputJson.type === platformJobTypes.seasonSimulationExecution)
      && typeof job.inputJson.simulationRunId === "string"
    ? job.inputJson.simulationRunId
    : null;
};
