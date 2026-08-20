import type { JobKind } from "../jobs.js";

export const defaultPostgresPoolSize = 5;
export const defaultWorkerJobKinds: readonly JobKind[] = ["simulation"];
export const defaultWorkerPollIntervalMs = 1_000;
export const defaultWorkerLockTtlMs = 60_000;
export const defaultDraftToolsSessionDirectory = "data/platform-draft-tools";
export const defaultScreenshotImportModel = "gpt-5.6-terra";
export const defaultScreenshotImportTimeoutMs = 30_000;
export const defaultScreenshotImportMaxImageBytes = 5 * 1024 * 1024;
export const defaultScreenshotImportMaxConcurrency = 2;
export const defaultFantasyProsSeason = 2026;
export const launchWorkerJobKinds: readonly JobKind[] = ["simulation", "season_simulation"];

export const productionReadinessNextSteps: readonly string[] = [
  "Run `npm run platform:migrate` against the production DATABASE_URL before starting the web process.",
  "Set `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` to a writable scratch directory; do not attach a persistent disk, because that disables zero-downtime deploys.",
  "Verify a Resend sender and configure `RESEND_API_KEY`, `MOCKD_EMAIL_FROM`, and `MOCKD_PUBLIC_BASE_URL`.",
  "Configure the versioned ESPN credential keyring, then run `npm run platform:credentials:backfill` after the new web release is stable.",
  "Create a commissioner account, import a staging league, and verify its settings, members, keepers, and pricing; use `npm run platform:seed:e2e` only for local rehearsal fixtures.",
  "Start `npm run platform:web` behind the domain/proxy.",
  "Run `npm run smoke` after deploy and keep the output with the release notes.",
  "Optional: set MOCKD_SCREENSHOT_IMPORT_MODE=openai and configure OPENAI_API_KEY to enable commissioner screenshot analysis.",
  "Optional: configure FANTASYPROS_API_KEY to enable the FantasyPros rankings, projections, and player-catalog sync; the feature stays dark without it.",
];
