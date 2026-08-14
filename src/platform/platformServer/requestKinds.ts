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
