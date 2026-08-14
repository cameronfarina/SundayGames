import { z } from "zod";
import type {
  HistoricalImportIdentityAudit,
  HistoricalImportRowPreview,
} from "../historicalImports.js";
import { issuesFromDb } from "./issueCodec.js";
import { jsonArrayFromDb, jsonObjectFromDb } from "./jsonValues.js";
import { saleRecordFromUnknown } from "./saleCodec.js";

const identityCandidateSchema = z.object({
  teamId: z.string(),
  teamDisplayName: z.string(),
  ownerDisplayName: z.string(),
});

const identitySchema = z.object({
  sourceOwnerOrTeamLabel: z.string(),
  resolution: z.enum(["exact", "explicit", "fuzzy", "ambiguous", "unresolved"]),
  mappedTeamId: z.string().optional(),
  mappedCurrentOwnerDisplayName: z.string().optional(),
  mappedCurrentTeamDisplayName: z.string().optional(),
  candidates: z.array(identityCandidateSchema).optional(),
});

const identityFromUnknown = (value: unknown): HistoricalImportIdentityAudit | undefined => {
  const parsed = identitySchema.safeParse(value);
  if (!parsed.success) return undefined;
  const audit = parsed.data;
  return {
    sourceOwnerOrTeamLabel: audit.sourceOwnerOrTeamLabel,
    resolution: audit.resolution,
    ...(audit.mappedTeamId === undefined ? {} : { mappedTeamId: audit.mappedTeamId }),
    ...(audit.mappedCurrentOwnerDisplayName === undefined
      ? {}
      : { mappedCurrentOwnerDisplayName: audit.mappedCurrentOwnerDisplayName }),
    ...(audit.mappedCurrentTeamDisplayName === undefined
      ? {}
      : { mappedCurrentTeamDisplayName: audit.mappedCurrentTeamDisplayName }),
    ...(audit.candidates === undefined ? {} : { candidates: structuredClone(audit.candidates) }),
  };
};

const rowPreviewFromUnknown = (value: unknown): HistoricalImportRowPreview | undefined => {
  const row = jsonObjectFromDb(value);
  const rowNumber = row.rowNumber;
  const status = row.status;
  if (typeof rowNumber !== "number" || (status !== "ready" && status !== "blocked")) {
    return undefined;
  }
  const identityAudit = identityFromUnknown(row.identityAudit);
  return {
    rowNumber,
    status,
    blockers: issuesFromDb(row.blockers),
    warnings: issuesFromDb(row.warnings),
    record: row.record === null ? null : saleRecordFromUnknown(row.record),
    ...(identityAudit === undefined ? {} : { identityAudit }),
  };
};

export const rowPreviewsFromDb = (value: unknown): HistoricalImportRowPreview[] => {
  const rows = jsonObjectFromDb(value).rows;
  return jsonArrayFromDb(rows).flatMap(entry => {
    const preview = rowPreviewFromUnknown(entry);
    return preview === undefined ? [] : [preview];
  });
};
