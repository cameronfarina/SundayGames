import type { DraftExportError } from "../../draftExport.js";
import type { GenericAuctionMockError } from "../../genericAuctionMockEngine.js";
import type { LiveDraftRoomError } from "../../liveDraftRooms.js";
import type { MockDraftSessionError } from "../../mockSessions.js";
import type { SimulationError } from "../../simulations.js";
import type { SnakeDraftError } from "../../snakeDraftEngine.js";

export const mockSessionErrorStatus = (code: MockDraftSessionError["code"]): number => {
  switch (code) {
    case "access_denied": return 403;
    case "session_not_found": return 404;
    case "session_command_bytes_limit": return 413;
    case "session_creation_rate_limited": return 429;
    case "command_idempotency_conflict":
    case "season_active_session_limit":
    case "session_command_count_limit":
    case "session_not_reusable":
    case "session_not_writable":
    case "stale_command_count":
    case "stale_revision":
    case "user_active_session_limit": return 409;
    case "command_key_required":
    case "command_required":
    case "mock_count_required":
    case "owner_required":
    case "team_required": return 400;
  }
};

export const snakeDraftErrorStatus = (code: SnakeDraftError["code"]): number => {
  switch (code) {
    case "draft_incomplete":
    case "duplicate_player":
    case "invalid_status":
    case "no_pick_to_undo":
    case "not_human_turn":
    case "roster_limit":
    case "stale_revision": return 409;
    case "invalid_config":
    case "invalid_keeper":
    case "player_not_found": return 400;
  }
};

export const auctionMockErrorStatus = (code: GenericAuctionMockError["code"]): number => {
  switch (code) {
    case "draft_incomplete":
    case "duplicate_player":
    case "invalid_decision":
    case "invalid_status":
    case "max_bid_exceeded":
    case "no_decision_to_undo":
    case "no_eligible_player":
    case "position_limit":
    case "roster_full":
    case "roster_limit":
    case "stale_revision": return 409;
    case "invalid_config":
    case "invalid_keeper":
    case "invalid_price":
    case "player_not_found":
    case "team_not_found": return 400;
  }
};

export const simulationErrorStatus = (code: SimulationError["code"]): number => {
  switch (code) {
    case "simulation_not_found": return 404;
    case "idempotency_conflict":
    case "simulation_execution_superseded": return 409;
    case "simulation_capacity_reached": return 429;
    case "duplicate_hard_lock":
    case "invalid_count":
    case "invalid_hard_lock_price":
    case "invalid_simulation_identifier":
    case "invalid_simulation_strategy":
    case "invalid_soft_target_candidate_pool":
    case "invalid_soft_target_label":
    case "invalid_soft_target_max_bid":
    case "missing_hard_lock_player":
    case "simulation_strategy_too_large": return 400;
  }
};

export const liveDraftRoomErrorStatus = (code: LiveDraftRoomError["code"]): number => {
  switch (code) {
    case "access_denied":
    case "mutation_denied": return 403;
    case "room_not_found": return 404;
    case "duplicate_player":
    case "draft_complete":
    case "draft_incomplete":
    case "idempotency_conflict":
    case "out_of_turn":
    case "max_bid_exceeded":
    case "no_sale_to_undo":
    case "position_limit":
    case "room_already_ended":
    case "room_already_exists":
    case "room_already_live":
    case "room_not_live":
    case "room_not_cancellable":
    case "room_not_paused":
    case "room_not_reopenable":
    case "room_paused":
    case "roster_full":
    case "sale_not_active":
    case "season_not_ready":
    case "stale_revision": return 409;
    case "expected_revision_required":
    case "idempotency_key_required":
    case "invalid_sale_price":
    case "owner_not_found":
    case "player_not_found":
    case "team_not_found": return 400;
  }
};

export const draftExportErrorStatus = (code: DraftExportError["code"]): number =>
  code === "duplicate_player" ? 409 : 400;
