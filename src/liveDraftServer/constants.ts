import type {
  LiveDraftModeDescriptor,
  LiveDraftSessionDescriptor,
} from "./contracts.js";

export const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
export const playerNewsEvidencePath = "data/raw/player-evidence-2026-initial.csv";
export const defaultDraftApiPort = 4317;
export const liveTargetLimit = 500;
export const defaultLiveDraftSessionMode = "real";
export const defaultLiveDraftSessionKey = "live";
export const defaultLiveDraftSessionDirectory = "data/live-draft";
export const interactiveMockSessionDirectoryName = "interactive-mock";
export const maximumBatchRunsPerScenario = 250;
export const scratchSessionPrefix = "scratch:";

export const obsoleteFrontendPaths = new Set([
  "/",
  "/draft-room",
  "/mock-results",
  "/mock-simulations",
  "/my-expert",
  "/player-news",
]);

export const liveDraftNightLockReason =
  "Live session is locked for mock draft advances. Switch to a practice session to run interactive mocks.";

export const liveDraftModes: readonly LiveDraftModeDescriptor[] = [
  {
    key: "real",
    label: "Real draft",
    description: "Draft-night logger. Writes to the real live-draft files.",
  },
  {
    key: "interactive-mock",
    label: "Mock draft",
    description: "Practice room. You control your team while AI owners bid and nominate.",
  },
];

export const presetDraftSessions: readonly LiveDraftSessionDescriptor[] = [
  {
    key: "live",
    label: "Live",
    description: "Draft-night room. Writes to the main live-draft files.",
  },
  {
    key: "practice-3rb",
    label: "Practice 3RB",
    description: "Practice room for true-three-RB prep.",
  },
  {
    key: "practice-wr-heavy",
    label: "Practice WR Heavy",
    description: "Practice room for receiver-heavy builds.",
  },
];

export const defaultLiveDraftJsonBodyLimitBytes = 1_048_576;
export const defaultLiveDraftImportBodyLimitBytes = 7_100_000;
export const defaultCompletedMockBatchJobTtlMs = 24 * 60 * 60 * 1_000;
export const defaultMaxCompletedMockBatchJobs = 50;
