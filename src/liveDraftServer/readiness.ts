import type {
  LiveDraftReadiness,
  LiveDraftReadinessCheck,
  LiveDraftReadinessStatus,
} from "../modeling/liveDraft.js";
import type { LiveDraftSessionStatus } from "../liveDraftSessionStore.js";

const statusFor = (checks: readonly LiveDraftReadinessCheck[]): LiveDraftReadinessStatus => {
  if (checks.some(check => check.status === "fail")) return "fail";
  if (checks.some(check => check.status === "warn")) return "warn";
  return "pass";
};

export const readinessWithSession = (
  readiness: LiveDraftReadiness,
  session: LiveDraftSessionStatus,
): LiveDraftReadiness => {
  const checks: LiveDraftReadinessCheck[] = [
    ...readiness.checks,
    {
      key: "session-store",
      label: "Session store",
      status: "pass",
      detail: `${session.commandCount} command${session.commandCount === 1 ? "" : "s"} loaded from disk.`,
    },
    { key: "sale-log", label: "Sale log", status: "pass", detail: session.paths.logPath },
    { key: "backup-file", label: "Backup file", status: "pass", detail: session.paths.backupPath },
  ];
  return { status: statusFor(checks), checks };
};
