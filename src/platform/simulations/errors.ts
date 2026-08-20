export type SimulationErrorCode =
  | "duplicate_hard_lock"
  | "idempotency_conflict"
  | "invalid_count"
  | "invalid_hard_lock_price"
  | "invalid_simulation_strategy"
  | "invalid_soft_target_candidate_pool"
  | "invalid_soft_target_label"
  | "invalid_soft_target_max_bid"
  | "missing_hard_lock_player"
  | "invalid_simulation_identifier"
  | "simulation_capacity_reached"
  | "simulation_execution_superseded"
  | "simulation_strategy_too_large"
  | "simulation_not_found";

export class SimulationError extends Error {
  readonly code: SimulationErrorCode;

  constructor(code: SimulationErrorCode, message: string) {
    super(message);
    this.name = "SimulationError";
    this.code = code;
  }
}
