import type { SimulationRequest } from "../simulations.js";
import { requiredDateFromDb } from "./dates.js";
import {
  isRecord,
  jsonValueFromDb,
  numberFromRecord,
  stringFromRecord,
} from "./json.js";
import { strategyFromDb } from "./strategyCodec.js";
import type { SimulationRunRow } from "./types.js";

export const requestFromRow = (row: SimulationRunRow): SimulationRequest => {
  const requestJson = jsonValueFromDb(row.request_json);
  const requestRecord = isRecord(requestJson) ? requestJson : {};
  return {
    id: stringFromRecord(requestRecord, "id", `simreq_${row.id}`),
    userId: row.user_id,
    leagueId: row.league_id,
    seasonId: row.league_season_id,
    ownerId: row.owner_id,
    teamId: row.team_id,
    count: numberFromRecord(requestRecord, "count", 1),
    seedPrefix: stringFromRecord(requestRecord, "seedPrefix", ""),
    idempotencyKey: row.idempotency_key,
    strategy: strategyFromDb(requestRecord.strategy),
    privacyOwnerUserId: row.user_id,
    inputHash: row.input_hash,
    createdAt: requiredDateFromDb("created_at", row.created_at),
  };
};
