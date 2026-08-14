import { AuthError } from "../../auth.js";
import { DraftExportError } from "../../draftExport.js";
import { ExportArtifactError } from "../../exportArtifacts.js";
import {
  HistoricalImportError,
  HistoricalImportTargetError,
} from "../../historicalImports.js";
import { HistoricalImportDocumentLimitError } from "../../historicalImportLimits.js";
import { HistoricalSpreadsheetUploadError } from "../../historicalSpreadsheetImport.js";
import { JobError } from "../../jobs.js";
import { LeagueCreationError } from "../../leagueCreation.js";
import { LeagueCreationLimitError, LeagueSetupWriteConflictError } from "../../leagueSetup.js";
import { LiveDraftRoomError } from "../../liveDraftRooms.js";
import { LiveDraftRoomSetupWriteConflictError } from "../../liveDraftRoomSetups.js";
import { MockDraftSessionError } from "../../mockSessions.js";
import { LeagueMembersScreenshotAnalyzerError } from "../../openAiLeagueMembersScreenshotAnalyzer.js";
import { PlatformAppError } from "../../platformApp.js";
import { PlatformInvitationError } from "../../platformInvitations.js";
import { PostDraftLiveRoomAdapterError } from "../../postDraftLiveRoomAdapter.js";
import { PricingSnapshotError } from "../../pricingSnapshots.js";
import { SeasonAuctionMockError } from "../../seasonAuctionMock.js";
import { SeasonKeeperSetupError } from "../../seasonKeeperSetup.js";
import { SeasonMockConfigurationSnapshotError } from "../../seasonMockSnapshot.js";
import { SeasonSimulationError } from "../../seasonSimulationEngine.js";
import { SeasonSnakeMockError } from "../../seasonSnakeMock.js";
import { SimulationError } from "../../simulations.js";
import { SnakeDraftError } from "../../snakeDraftEngine.js";
import { GenericAuctionMockError } from "../../genericAuctionMockEngine.js";
import type { PlatformHttpErrorBody, PlatformHttpResponse } from "../contracts.js";
import { knownError } from "../responses.js";
import {
  auctionMockErrorStatus,
  draftExportErrorStatus,
  liveDraftRoomErrorStatus,
  mockSessionErrorStatus,
  simulationErrorStatus,
  snakeDraftErrorStatus,
} from "./draftStatus.js";
import {
  historicalImportErrorStatus,
  jobErrorStatus,
  platformErrorStatus,
  platformInvitationErrorStatus,
} from "./resourceStatus.js";

export const errorResponseFor = (
  error: unknown,
): PlatformHttpResponse<PlatformHttpErrorBody> => {
  if (error instanceof URIError) return knownError(400, "invalid_request", "Request path is invalid.");
  if (error instanceof AuthError) {
    const status = error.code === "auth_required" ? 401
      : error.code === "invalid_current_password" || error.code === "email_unverified" ? 403
        : error.code === "duplicate_email" || error.code === "password_change_conflict" ? 409 : 400;
    return knownError(status, error.code, error.message);
  }
  if (error instanceof PlatformAppError) {
    return knownError(platformErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof MockDraftSessionError) {
    const response = knownError(mockSessionErrorStatus(error.code), error.code, error.message);
    return error.retryAfterSeconds === undefined
      ? response
      : { ...response, headers: { "Retry-After": String(error.retryAfterSeconds) } };
  }
  if (error instanceof SeasonMockConfigurationSnapshotError) {
    return knownError(error.code === "snapshot_migration_required" ? 409 : 400, error.code, error.message);
  }
  if (error instanceof SeasonSnakeMockError || error instanceof SeasonAuctionMockError) {
    const status = error.code === "human_team_missing" ? 403
      : error.code === "invalid_command_log" ? 400 : 409;
    return knownError(status, error.code, error.message);
  }
  if (error instanceof SnakeDraftError) {
    return knownError(snakeDraftErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof GenericAuctionMockError) {
    return knownError(auctionMockErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof SeasonSimulationError) {
    const status = error.code === "human_team_missing" ? 403
      : error.code === "invalid_configuration" ? 409
        : error.code === "simulation_account_queue_full" ? 429
          : error.code === "simulation_busy" || error.code === "simulation_timeout" ? 503
            : error.code === "simulation_canceled" ? 408
              : error.code === "simulation_failed" ? 500 : 400;
    const response = knownError(status, error.code, error.message);
    return error.code === "simulation_busy" || error.code === "simulation_account_queue_full"
      ? { ...response, headers: { "Retry-After": "5" } } : response;
  }
  if (error instanceof SimulationError) {
    const response = knownError(simulationErrorStatus(error.code), error.code, error.message);
    return error.code === "simulation_capacity_reached"
      ? { ...response, headers: { "Retry-After": "5" } } : response;
  }
  if (error instanceof LiveDraftRoomError) {
    return knownError(liveDraftRoomErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof DraftExportError) {
    return knownError(draftExportErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof JobError) return knownError(jobErrorStatus(error.code), error.code, error.message);
  if (error instanceof ExportArtifactError) return knownError(409, error.code, error.message);
  if (error instanceof HistoricalImportError) {
    return knownError(historicalImportErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof HistoricalImportTargetError) return knownError(409, error.code, error.message);
  if (error instanceof HistoricalImportDocumentLimitError) return knownError(422, error.code, error.message);
  if (error instanceof HistoricalSpreadsheetUploadError) {
    return knownError(400, "invalid_historical_upload", error.message);
  }
  if (error instanceof SeasonKeeperSetupError) return knownError(409, error.code, error.message);
  if (error instanceof PostDraftLiveRoomAdapterError) {
    const status = error.code === "private_owner_mismatch" || error.code === "owned_team_mismatch" ? 403 : 409;
    return knownError(status, error.code, error.message);
  }
  if (error instanceof PricingSnapshotError) return knownError(409, error.code, error.message);
  if (error instanceof PlatformInvitationError) {
    return knownError(platformInvitationErrorStatus(error.code), error.code, error.message);
  }
  if (error instanceof LeagueMembersScreenshotAnalyzerError) {
    const status = error.code === "invalid_image" ? 400 : error.code === "provider_unavailable" ? 503 : 422;
    return knownError(status, error.code, error.message);
  }
  if (error instanceof LeagueSetupWriteConflictError) {
    return knownError(409, "league_setup_write_conflict", error.message);
  }
  if (error instanceof LeagueCreationLimitError) {
    const response = knownError(
      error.code === "league_creation_rate_limited" ? 429 : 409,
      error.code,
      error.message,
    );
    return error.retryAfterSeconds > 0
      ? { ...response, headers: { "Retry-After": String(error.retryAfterSeconds) } } : response;
  }
  if (error instanceof LiveDraftRoomSetupWriteConflictError) {
    return knownError(409, "draft_setup_write_conflict", error.message);
  }
  if (error instanceof LeagueCreationError) return knownError(400, "invalid_league_setup", error.message);
  return knownError(500, "internal_error", "Something went wrong.");
};
