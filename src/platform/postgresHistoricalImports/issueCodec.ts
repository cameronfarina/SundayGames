import { z } from "zod";
import type { HistoricalImportIssue } from "../historicalImports.js";
import { jsonArrayFromDb } from "./jsonValues.js";

const issueCodeSchema = z.enum([
  "season_missing", "team_count_mismatch", "owner_unknown", "owner_ambiguous",
  "owner_mapping_not_one_to_one", "owner_fuzzy_match", "owner_unmapped", "position_invalid",
  "player_missing", "price_invalid", "public_price_invalid", "player_duplicate",
  "player_ambiguous", "player_unresolved", "player_historical_only",
  "season_spend_mismatch", "keeper_inferred", "acquisition_type_inferred",
]);

const playerCandidateSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.string(),
});

const ownerCandidateSchema = z.object({
  teamId: z.string(),
  teamDisplayName: z.string(),
  ownerDisplayName: z.string(),
});

const issueSchema = z.object({
  code: issueCodeSchema,
  severity: z.enum(["blocker", "warning"]),
  message: z.string(),
  rowNumber: z.number().optional(),
  sourceValue: z.string().optional(),
  candidates: z.array(z.union([playerCandidateSchema, ownerCandidateSchema])).optional(),
});

const issueFromUnknown = (value: unknown): HistoricalImportIssue | undefined => {
  const parsed = issueSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const issue = parsed.data;
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    ...(issue.rowNumber === undefined ? {} : { rowNumber: issue.rowNumber }),
    ...(issue.sourceValue === undefined ? {} : { sourceValue: issue.sourceValue }),
    ...(issue.candidates === undefined ? {} : { candidates: structuredClone(issue.candidates) }),
  };
};

export const issuesFromDb = (value: unknown): HistoricalImportIssue[] =>
  jsonArrayFromDb(value).flatMap(entry => {
    const issue = issueFromUnknown(entry);
    return issue === undefined ? [] : [issue];
  });
