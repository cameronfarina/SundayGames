import type { HistoricalImportError } from "../../historicalImports.js";
import type { JobError } from "../../jobs.js";
import type { PlatformAppError } from "../../platformApp.js";
import type { PlatformInvitationError } from "../../platformInvitations.js";

export const platformErrorStatus = (code: PlatformAppError["code"]): number => {
  switch (code) {
    case "auth_required": return 401;
    case "draft_room_not_final":
    case "team_claim_locked":
    case "team_already_claimed": return 409;
    case "league_not_found":
    case "historical_import_not_found":
    case "pricing_snapshot_not_found":
    case "season_not_found":
    case "team_not_found": return 404;
    case "membership_required":
    case "private_resource":
    case "private_team_required":
    case "shared_mutation_denied":
    case "team_claim_required": return 403;
  }
};

export const jobErrorStatus = (code: JobError["code"]): number => {
  switch (code) {
    case "job_not_found": return 404;
    case "idempotency_key_required":
    case "invalid_job_cursor": return 400;
    case "idempotency_conflict":
    case "job_not_claimable":
    case "job_already_active":
    case "job_not_running":
    case "job_not_terminal": return 409;
    case "job_lock_mismatch":
    case "job_owner_required": return 403;
  }
};

export const historicalImportErrorStatus = (code: HistoricalImportError["code"]): number => {
  switch (code) {
    case "batch_not_found": return 404;
    case "batch_blocked":
    case "season_import_conflict": return 409;
  }
};

export const platformInvitationErrorStatus = (code: PlatformInvitationError["code"]): number => {
  switch (code) {
    case "invitation_not_found": return 404;
    case "invitation_email_mismatch": return 403;
    case "invitation_expired": return 410;
    case "invitation_unavailable": return 409;
  }
};
