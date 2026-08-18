import type { WorkspaceRole } from "../workspacePrivacy.js";
import { cellValue, headerCellValue } from "./headerMap.js";
import type {
  DraftLeagueSetupRow,
  LeagueSetupColumn,
  RawLeagueSetupRow,
} from "./internalTypes.js";
import { normalizeEmail } from "./normalization.js";

const roleFor = (role: string): WorkspaceRole | null => {
  const normalizedRole = role.trim().toLowerCase();

  if (normalizedRole.length === 0) return "member";
  if (normalizedRole === "owner") return "owner";
  if (normalizedRole === "admin") return "admin";
  if (normalizedRole === "member") return "member";
  if (normalizedRole === "observer") return "observer";
  return null;
};

const draftOrderFor = (rawDraftOrder: string): number | undefined => {
  if (rawDraftOrder.length === 0) return undefined;
  const parsed = Number(rawDraftOrder);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const draftRowFor = (
  row: RawLeagueSetupRow,
  headerMap: ReadonlyMap<LeagueSetupColumn, number> | null,
): DraftLeagueSetupRow => {
  const ownerDisplayName = cellValue(row, headerMap, "owner", 0);
  const rawTeamDisplayName = cellValue(row, headerMap, "team", 1);
  const email = normalizeEmail(cellValue(row, headerMap, "email", 2));
  const rawRole = cellValue(row, headerMap, "role", 3);
  const existingTeamId = headerCellValue(row, headerMap, "teamId");
  const rawDraftOrder = headerCellValue(row, headerMap, "draftOrder") ?? "";
  const draftOrderPosition = draftOrderFor(rawDraftOrder);

  return {
    rowNumber: row.rowNumber,
    ownerDisplayName,
    teamDisplayName: rawTeamDisplayName.length > 0 ? rawTeamDisplayName : ownerDisplayName,
    ...(existingTeamId === undefined ? {} : { existingTeamId }),
    ...(email === undefined ? {} : { email }),
    role: roleFor(rawRole),
    rawRole,
    ...(draftOrderPosition === undefined ? {} : { draftOrderPosition }),
    rawDraftOrder,
    blockers: [...row.blockers],
  };
};
