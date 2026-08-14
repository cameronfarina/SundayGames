import type { SimulationRun, SimulationRunStatus } from "../simulations.js";
import { dateFromDb, requiredDateFromDb } from "./dates.js";
import { requestFromRow } from "./requestCodec.js";
import { resultFromRow } from "./resultCodec.js";
import type { SimulationRunRow } from "./types.js";

const statuses: readonly SimulationRunStatus[] = [
  "requested", "running", "completed", "failed", "canceled",
];

const statusFromDb = (value: string): SimulationRunStatus => {
  const status = statuses.find(candidate => candidate === value);
  if (status === undefined) {
    throw new Error("Postgres simulation row has invalid status.");
  }
  return status;
};

export const runFromRow = (row: SimulationRunRow): SimulationRun => ({
  id: row.id,
  request: requestFromRow(row),
  status: statusFromDb(row.status),
  privacyOwnerUserId: row.user_id,
  createdAt: requiredDateFromDb("created_at", row.created_at),
  startedAt: dateFromDb(row.started_at),
  completedAt: dateFromDb(row.completed_at),
  result: resultFromRow(row),
});
