import type { LeagueSyncReadOnlyPolicy } from "./contracts.js";

export const leagueSyncReadOnlyPolicy: LeagueSyncReadOnlyPolicy = {
  mode: "read-only",
  allowedActions: ["recommend", "sync"],
  blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
};
