import type { DraftLeagueSetupRow } from "./internalTypes.js";
import type {
  LeagueSetupImportRowPreview,
  LeagueSetupTeamRecord,
} from "./types.js";

const recordFor = (draft: DraftLeagueSetupRow): LeagueSetupTeamRecord | null => {
  if (draft.blockers.length > 0 || draft.role === null) return null;

  return {
    sourceRowNumber: draft.rowNumber,
    ownerDisplayName: draft.ownerDisplayName,
    teamDisplayName: draft.teamDisplayName,
    ...(draft.existingTeamId === undefined ? {} : { existingTeamId: draft.existingTeamId }),
    ...(draft.email === undefined ? {} : { email: draft.email }),
    ...(draft.draftOrderPosition === undefined
      ? {}
      : { draftOrderPosition: draft.draftOrderPosition }),
    role: draft.role,
  };
};

export const rowPreviewFor = (draft: DraftLeagueSetupRow): LeagueSetupImportRowPreview => {
  const record = recordFor(draft);

  return {
    rowNumber: draft.rowNumber,
    status: record === null ? "blocked" : "ready",
    blockers: [...draft.blockers],
    record,
  };
};
