# Fantasy Draft Platform Schema Outline

This is the proposed Postgres shape for the platform PRs. Names can change during implementation, but these ownership, idempotency, revision, uniqueness, privacy, and event/projection constraints should survive.

## Shared League Truth

### `users`

- `id`, `email`, `email_normalized`, `password_hash`, `display_name`, `status`, `created_at`, `updated_at`
- Constraints:
  - unique `email_normalized`
  - valid `status`

### `sessions`

- `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `last_used_at`, `created_at`
- Constraints/indexes:
  - unique `token_hash`
  - index `user_id`
  - index `expires_at`

### `leagues`

- `id`, `name`, `sport`, `provider`, `provider_league_id`, `created_by_user_id`, `created_at`, `updated_at`
- Constraints/indexes:
  - optional unique `(provider, provider_league_id)` when both are present
  - index `created_by_user_id`

### `league_memberships`

- `id`, `league_id`, `user_id`, `role`, `status`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(league_id, user_id)`
  - index `(user_id, status)`
  - valid `role`: `owner`, `admin`, `member`, `observer`
  - valid `status`

### `league_seasons`

- `id`, `league_id`, `season_year`, `name`, `status`, `published_at`, `locked_at`, `active_model_run_id`, `active_pricing_snapshot_id`, `settings_json`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(league_id, season_year)`
  - index `(league_id, status)`
  - published seasons require complete setup checks in application code

### `fantasy_teams`

- `id`, `league_season_id`, `team_key`, `team_name`, `owner_name`, `owner_user_id`, `display_order`, `aliases_json`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(league_season_id, team_key)`
  - unique `(league_season_id, display_order)`
  - index `owner_user_id`
  - team names and owner names are stored separately

### `roster_rule_sets`

- `id`, `league_season_id`, `budget`, `minimum_bid`, `slots_json`, `position_maximums_json`, `scoring_json`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `league_season_id`
  - budget and minimum bid are positive integers

### `keeper_declarations`

- `id`, `league_season_id`, `fantasy_team_id`, `player_id`, `player_name`, `position`, `keeper_cost`, `previous_cost`, `status`, `source`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(league_season_id, player_id)` for active/published keepers
  - index `(league_season_id, fantasy_team_id)`
  - non-negative integer costs

### `players`

- `id`, `provider`, `provider_player_id`, `canonical_name`, `position`, `nfl_team`, `bye_week`, `active`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(provider, provider_player_id)` when provider ID exists
  - index `(canonical_name, position)`

### `player_aliases`

- `id`, `player_id`, `league_id`, `alias_normalized`, `source`, `created_at`
- Constraints/indexes:
  - unique `(league_id, alias_normalized, player_id)`
  - index `(alias_normalized)`

## Historical Imports And Pricing

### `historical_import_batches`

- `id`, `league_id`, `league_season_id`, `season_year`, `uploaded_by_user_id`, `file_name`, `file_hash`, `status`, `mapping_json`, `warnings_json`, `blockers_json`, `committed_at`, `superseded_by_batch_id`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(league_id, season_year, file_hash)` unless explicitly replacing
  - index `(league_id, season_year, status)`
  - committed batch cannot be mutated except to mark superseded

### `historical_draft_sales`

- `id`, `league_id`, `season_year`, `import_batch_id`, `fantasy_team_key`, `owner_name`, `player_id`, `original_player_name`, `position`, `price`, `slot_type`, `source_row_number`, `created_at`
- Constraints/indexes:
  - index `(league_id, season_year)`
  - index `(import_batch_id)`
  - index `(player_id)`
  - price is a non-negative integer

### `model_runs`

- `id`, `league_id`, `league_season_id`, `model_version`, `input_snapshot_id`, `input_hash`, `status`, `created_by_user_id`, `started_at`, `completed_at`, `error_summary`, `created_at`
- Constraints/indexes:
  - unique `(league_season_id, model_version, input_hash)`
  - index `(league_season_id, status)`
  - immutable after completion

### `pricing_snapshots`

- `id`, `model_run_id`, `league_season_id`, `scenario_id`, `snapshot_hash`, `created_at`
- Constraints/indexes:
  - unique `(model_run_id, scenario_id)`
  - unique `snapshot_hash`
  - immutable rows

### `player_prices`

- `id`, `pricing_snapshot_id`, `player_id`, `market_price`, `scenario_price`, `live_price`, `personal_value`, `recommended_max_bid`, `explanation_json`, `created_at`
- Constraints/indexes:
  - unique `(pricing_snapshot_id, player_id)`
  - index `(player_id)`
  - price fields are separate so market, live, personal, and max bid values do not overwrite each other

## Private Prep

Privacy ownership invariant: every private prep table has `user_id`, requires league membership for the linked league, and requires exact `user_id` ownership for reads and writes. Commissioner/admin role does not bypass private prep privacy.

### `strategy_plans`

- `id`, `league_id`, `league_season_id`, `user_id`, `title`, `status`, `current_version_id`, `created_at`, `updated_at`
- Constraints/indexes:
  - index `(user_id, league_season_id, status)`
  - foreign key `current_version_id` points to this plan's versions

### `strategy_plan_versions`

- `id`, `strategy_plan_id`, `version_number`, `prompt`, `summary`, `commands_json`, `locks_json`, `targets_json`, `guardrails_json`, `created_at`
- Constraints/indexes:
  - unique `(strategy_plan_id, version_number)`
  - immutable versions

### `coach_conversations`

- `id`, `league_id`, `league_season_id`, `user_id`, `title`, `created_at`, `updated_at`
- Constraints/indexes:
  - index `(user_id, league_season_id, updated_at)`

### `coach_messages`

- `id`, `conversation_id`, `role`, `content`, `context_refs_json`, `created_at`
- Constraints/indexes:
  - index `(conversation_id, created_at)`
  - do not store other users' private context refs

### `mock_sessions`

- `id`, `league_id`, `league_season_id`, `user_id`, `model_run_id`, `pricing_snapshot_id`, `status`, `version`, `seed`, `created_at`, `updated_at`, `completed_at`
- Constraints/indexes:
  - index `(user_id, league_season_id, status)`
  - `version` increments with commands/reset to reject stale tabs

### `mock_session_events`

- `id`, `mock_session_id`, `sequence`, `event_type`, `command`, `payload_json`, `idempotency_key`, `created_at`
- Constraints/indexes:
  - unique `(mock_session_id, sequence)`
  - unique `(mock_session_id, idempotency_key)` when idempotency key exists

### `simulation_runs`

- `id`, `league_id`, `league_season_id`, `user_id`, `job_id`, `model_run_id`, `pricing_snapshot_id`, `idempotency_key`, `input_hash`, `request_json`, `status`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(user_id, league_id, league_season_id, idempotency_key)`
  - index `(user_id, league_season_id, status)`
  - same idempotency key with different `input_hash` is a conflict

### `simulation_results`

- `id`, `simulation_run_id`, `summary_json`, `result_set_json`, `created_at`
- Constraints/indexes:
  - unique `simulation_run_id`
  - result is private through parent `simulation_runs.user_id`

## Live Draft Room

### `draft_rooms`

- `id`, `league_id`, `league_season_id`, `room_type`, `status`, `created_by_user_id`, `active_model_run_id`, `active_pricing_snapshot_id`, `current_revision`, `starts_at`, `started_at`, `ended_at`, `created_at`, `updated_at`
- Constraints/indexes:
  - index `(league_season_id, status)`
  - `current_revision` is monotonic
  - room must reference a published league season before start

### `draft_room_participants`

- `id`, `draft_room_id`, `user_id`, `selected_team_id`, `role`, `last_seen_revision`, `connected_at`, `disconnected_at`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(draft_room_id, user_id)`
  - index `(draft_room_id, selected_team_id)`

### `draft_room_events`

- `id`, `draft_room_id`, `revision`, `sequence`, `event_type`, `actor_user_id`, `idempotency_key`, `expected_revision`, `raw_command`, `payload_json`, `validation_json`, `occurred_at`
- Constraints/indexes:
  - unique `(draft_room_id, revision)`
  - unique `(draft_room_id, sequence)`
  - unique `(draft_room_id, idempotency_key)` when idempotency key exists
  - index `(draft_room_id, occurred_at)`
  - authoritative event log; do not delete rows

### `draft_room_sales`

- `id`, `draft_room_id`, `source_event_id`, `fantasy_team_id`, `player_id`, `player_name`, `position`, `price`, `expected_price`, `live_price`, `status`, `voided_by_event_id`, `corrected_by_event_id`, `created_at`
- Constraints/indexes:
  - unique `(draft_room_id, player_id)` for active sales
  - unique `source_event_id`
  - index `(draft_room_id, fantasy_team_id)`
  - price is a positive integer for auction sales

### `draft_room_team_states`

- `id`, `draft_room_id`, `fantasy_team_id`, `spent`, `remaining_budget`, `max_bid`, `roster_slots_remaining`, `position_counts_json`, `roster_json`, `validity_json`, `revision`, `updated_at`
- Constraints/indexes:
  - unique `(draft_room_id, fantasy_team_id)`
  - index `(draft_room_id, revision)`
  - projection row, rebuildable from `draft_room_events`

### `draft_room_player_states`

- `id`, `draft_room_id`, `player_id`, `state`, `fantasy_team_id`, `price`, `revision`, `updated_at`
- Constraints/indexes:
  - unique `(draft_room_id, player_id)`
  - index `(draft_room_id, state)`
  - projection row, rebuildable from `draft_room_events`

### `draft_room_snapshots`

- `id`, `draft_room_id`, `revision`, `snapshot_json`, `snapshot_hash`, `created_at`
- Constraints/indexes:
  - unique `(draft_room_id, revision)`
  - optional checkpoint for fast reloads and stale SSE recovery

Event/projection rule: sale, undo, correction, start, and end mutations append an event and update projections in one transaction. SSE and polling publish/read the committed `revision`.

## Jobs, Exports, And Auth Support

### `jobs`

- `id`, `user_id`, `league_id`, `league_season_id`, `kind`, `status`, `idempotency_key`, `input_hash`, `input_json`, `progress_json`, `result_summary_json`, `attempt_count`, `max_attempts`, `locked_by`, `locked_at`, `heartbeat_at`, `available_at`, `finished_at`, `error_summary`, `created_at`, `updated_at`
- Constraints/indexes:
  - unique `(user_id, league_id, league_season_id, idempotency_key)`
  - index `(status, available_at, created_at)`
  - index `(locked_by, locked_at)`
  - same idempotency key with different input hash is a conflict

### `export_artifacts`

- `id`, `league_id`, `league_season_id`, `draft_room_id`, `created_by_user_id`, `job_id`, `artifact_type`, `status`, `storage_key`, `payload_hash`, `source_revision`, `metadata_json`, `created_at`, `completed_at`
- Constraints/indexes:
  - unique `(draft_room_id, source_revision, artifact_type)` for completed final exports
  - index `(league_season_id, status)`
  - export is generated from committed Postgres state only

### `audit_events`

- `id`, `league_id`, `user_id`, `event_type`, `resource_type`, `resource_id`, `metadata_json`, `created_at`
- Constraints/indexes:
  - index `(league_id, created_at)`
  - index `(user_id, created_at)`
  - log auth-sensitive, membership, setup, import commit, model publish, live draft, export, and admin actions

## ESPN And Final Results

ESPN import/writeback is not a launch dependency. The schema should store optional provider identifiers when known, but must not require ESPN to set up a league or finish a draft.

Final roster entry into ESPN is manual. The launch export is one sheet for manual entry/reference, generated from `draft_room_sales` and `draft_room_team_states` at a committed `source_revision`.
