import type { Position } from "../../../../config/league.js";
import type { WorkspaceRole } from "../../workspacePrivacy.js";
import { invalidSnapshot, stringValue } from "./primitives.js";

export const positionValue = (value: unknown, path: string): Position => {
  if (value === "QB" || value === "RB" || value === "WR"
    || value === "TE" || value === "K" || value === "DST") return value;
  return invalidSnapshot(path);
};

export const roleValue = (value: unknown, path: string): WorkspaceRole => {
  if (value === "owner" || value === "admin" || value === "member" || value === "observer") {
    return value;
  }
  return invalidSnapshot(path);
};

export const optionalString = (value: unknown, path: string): string | undefined =>
  value === undefined || value === null ? undefined : stringValue(value, path);
