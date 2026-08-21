import type { PlatformHttpRequest } from "../platformHttp.js";
import { pathSegmentsFor } from "./requestPath.js";

export const liveRoomMutationActions = new Set([
  "start",
  "pause",
  "resume",
  "reopen",
  "sales",
  "sale",
  "corrections",
  "correction",
  "undo",
  "end",
]);

export const isJobOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "simulations" &&
    segments.length === 3 && (segments[2] === "jobs" || segments[2] === "enqueue");
};

export const isSimulationOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "simulations" &&
    (segments.length === 1 || (segments.length === 3 && segments[2] === "execute"));
};

export const isPracticeShortlistOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  const method = request.method.toUpperCase();
  if (method !== "PUT" && method !== "DELETE") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments.length === 1 && segments[0] === "practice-shortlist";
};

export const isPracticeShortlistRequest = (request: PlatformHttpRequest): boolean => {
  const segments = pathSegmentsFor(request);
  return segments !== null && segments.length === 1 && segments[0] === "practice-shortlist";
};

export const isMockDraftSessionOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  if (segments === null) return false;
  if (segments.length === 1) {
    return segments[0] === "mock-sessions" || segments[0] === "season-mock-drafts";
  }
  return segments.length === 3 && (
    (segments[0] === "mock-sessions" &&
      (segments[2] === "commands" || segments[2] === "append" || segments[2] === "reset")) ||
    (segments[0] === "season-mock-drafts" &&
      (segments[2] === "commands" || segments[2] === "abandon"))
  );
};

export const isMockDraftSessionRequest = (request: PlatformHttpRequest): boolean => {
  const segments = pathSegmentsFor(request);
  return segments !== null &&
    (segments[0] === "mock-sessions" || segments[0] === "season-mock-drafts");
};

export const isSimulationRequest = (request: PlatformHttpRequest): boolean => {
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "simulations";
};

export const isJobRequest = (request: PlatformHttpRequest): boolean => {
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "jobs";
};

export const isLiveDraftRoomOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  if (segments === null || segments[0] !== "live-rooms") return false;
  return segments.length === 1 ||
    (segments.length === 3 && liveRoomMutationActions.has(segments[2] ?? ""));
};

export const isExportArtifactOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments.length === 3 && segments[0] === "live-rooms" &&
    (segments[2] === "export-artifacts" || segments[2] === "export-artifact");
};

export const isJobAndSimulationOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "jobs" && segments.length === 3 &&
    (segments[2] === "cancel" || segments[2] === "rerun");
};

export const isLeagueMembersScreenshotAnalysisRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  if (segments === null) return false;
  return (segments.length === 4 && segments[0] === "seasons" &&
      segments[2] === "setup-import" && segments[3] === "screenshot-analyze") ||
    (segments.length === 3 && segments[0] === "league-imports" &&
      segments[1] === "espn" && segments[2] === "members-screenshot-review");
};

export const isSeasonSimulationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments.length === 1 && segments[0] === "season-simulations";
};

export const isSeasonSimulationOutcomeMutationRequest = (
  request: PlatformHttpRequest,
): boolean => {
  if (request.method.toUpperCase() !== "PATCH") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments.length === 4 &&
    segments[0] === "season-simulations" && segments[2] === "runs";
};

export const isSeasonSimulationResourceRequest = (request: PlatformHttpRequest): boolean => {
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "season-simulations";
};

export const isLeagueConnectionOnlyMutationRequest = (
  request: PlatformHttpRequest,
): boolean => {
  const method = request.method.toUpperCase();
  const segments = pathSegmentsFor(request);
  if (segments === null || segments[0] !== "league-connections") return false;
  return (method === "POST" && segments.length === 1) ||
    (method === "POST" && segments.length === 2 && segments[1] === "discover") ||
    (method === "DELETE" && segments.length === 2);
};

export const isLeagueConnectionSyncRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "league-connections" &&
    segments.length === 3 && segments[2] === "sync";
};

export const isLeagueConnectionImportRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments[0] === "league-connections" &&
    segments.length === 3 && segments[2] === "import";
};
