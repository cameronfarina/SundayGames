export type LiveDraftReadinessStatus = "pass" | "warn" | "fail";

export interface LiveDraftReadinessCheck {
  key: string;
  label: string;
  status: LiveDraftReadinessStatus;
  detail: string;
}

export interface LiveDraftReadiness {
  status: LiveDraftReadinessStatus;
  checks: LiveDraftReadinessCheck[];
}
