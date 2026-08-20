import { dispatchNextPlatformJob } from "../../../src/platform/platformJobOrchestrator.js";
import { createPlatformJobHandlers } from "../../../src/platform/platformJobHandlers.js";
import type { PlatformApp, PlatformHttpResponse } from "../../../src/platform/platformHttp.js";
import { expectBodyRecord, expectString } from "./assertions.js";

export const dispatchQueuedSeasonSimulation = async (
  app: PlatformApp,
  response: PlatformHttpResponse,
): Promise<string> => {
  const body = expectBodyRecord(response.body);
  const historyId = expectString(body.historyId);
  const completedHistoryId = await dispatchNextQueuedSeasonSimulation(app);
  if (completedHistoryId !== historyId) throw new Error("Completed the wrong season simulation run.");
  return historyId;
};

export const dispatchNextQueuedSeasonSimulation = async (
  app: PlatformApp,
): Promise<string> => {
  const completed = await dispatchNextPlatformJob({
    repository: app.store.jobs,
    workerId: "platform-http-season-simulation-test-worker",
    handlers: createPlatformJobHandlers({ app }),
  });
  if (completed === null) throw new Error("Expected a queued season simulation job.");
  const summary = expectBodyRecord(completed.resultSummary);
  return expectString(summary.simulationRunId);
};
