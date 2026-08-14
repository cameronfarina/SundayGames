export type CalibrationGateCategory =
  | "roster_validity"
  | "auction_spend"
  | "high_price_volume"
  | "price_tier_count"
  | "position_count"
  | "position_spend"
  | "owner_spend"
  | "budget_remaining";

export type CalibrationGateStatus = "pass" | "warn" | "fail";
export type CalibrationGateMode = "absolute" | "maximum" | "minimum";

export interface CalibrationGate {
  key: string;
  category: CalibrationGateCategory;
  label: string;
  status: CalibrationGateStatus;
  mode: CalibrationGateMode;
  target: number;
  actual: number;
  delta: number;
  warnThreshold: number;
  failThreshold: number;
}

export interface CalibrationGateSummary {
  status: CalibrationGateStatus;
  credible: boolean;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface CalibrationGates {
  summary: CalibrationGateSummary;
  items: CalibrationGate[];
}
