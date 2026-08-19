export type ReadinessStatus = "pass" | "warn" | "fail";
export type ReadinessSeverity = "blocker" | "warning";

export interface LeagueSeasonReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  severity: ReadinessSeverity;
  message: string;
}

export interface LeagueSeasonReadiness {
  status: ReadinessStatus;
  canPublish: boolean;
  canLock: boolean;
  blockers: string[];
  warnings: string[];
  checks: LeagueSeasonReadinessCheck[];
}
