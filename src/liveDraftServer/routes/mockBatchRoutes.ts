import { MockBatchCapacityError } from "../../mockBatchResourceManager.js";
import { canonicalizeMockDraftScript, type MockDraftScript } from "../../modeling/mockScript.js";
import { parseJsonBody, sendJson } from "../http.js";
import {
  batchRunsPerScenarioFromValue,
  mockDraftScriptForOwner,
  mockDraftScriptFromBody,
  seedPrefixFromValue,
} from "../mockInput.js";
import { strategyKeyFromBody } from "../routeHelpers.js";
import type { RouteHandler } from "../runtimeContracts.js";
import { watchOwnerFromBody, watchOwnerFromQuery } from "../sessionInput.js";

export const handleMockBatchRoutes: RouteHandler = async ({ request, response, url, context }) => {
  const isBatchRoute = url.pathname === "/api/mock-batch" ||
    url.pathname === "/api/mock-batch/latest" || url.pathname.startsWith("/api/mock-batch/");
  if (!isBatchRoute) return false;
  if (!context.legacyMockBatchEnabled) {
    sendJson(response, 404, {
      error: { code: "legacy_mock_batch_disabled", message: "Legacy mock batch jobs are disabled." },
    });
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/mock-batch") {
    const body = await parseJsonBody(request, context.bodyLimitForPath(url.pathname));
    const strategyKey = strategyKeyFromBody(body);
    const draftSessionKey = context.enabledDraftSessionKeyFromBody(body);
    const watchOwner = watchOwnerFromBody(body);
    let script: MockDraftScript | undefined;
    try {
      script = mockDraftScriptFromBody(body);
      if (script) {
        script = canonicalizeMockDraftScript(
          mockDraftScriptForOwner(script, watchOwner),
          context.data.projections.map(projection => projection.name),
        );
      }
    } catch (error) {
      sendJson(response, 422, {
        error: error instanceof Error ? error.message : "Mock script could not be read.",
      });
      return true;
    }
    const requestedRuns = batchRunsPerScenarioFromValue(body.runs ?? body.runsPerScenario);
    const runsPerScenario = script?.runsPerScenario === undefined
      ? requestedRuns
      : batchRunsPerScenarioFromValue(script.runsPerScenario);
    try {
      const job = context.batches.start({
        draftSessionKey,
        watchOwner,
        strategyKey,
        runsPerScenario,
        seedPrefix: seedPrefixFromValue(body.seedPrefix),
        ...(script === undefined ? {} : { script }),
      });
      sendJson(response, 202, context.batches.responseFor(job));
    } catch (error) {
      if (!(error instanceof MockBatchCapacityError)) throw error;
      sendJson(response, error.status, { error: error.message, code: error.code }, {
        "Retry-After": String(error.retryAfterSeconds),
      });
    }
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/mock-batch/latest") {
    context.batches.prune();
    const job = context.batches.latestJob(
      context.enabledDraftSessionKeyFromQuery(url),
      watchOwnerFromQuery(url),
    );
    sendJson(response, 200, job ? context.batches.responseFor(job) : null);
    return true;
  }
  if (request.method === "GET" && url.pathname.startsWith("/api/mock-batch/")) {
    context.batches.prune();
    const jobId = decodeURIComponent(url.pathname.slice("/api/mock-batch/".length));
    const job = context.batches.job(jobId);
    const draftSessionKey = context.enabledDraftSessionKeyFromQuery(url);
    const watchOwner = watchOwnerFromQuery(url);
    if (!job || job.draftSessionKey !== draftSessionKey || job.watchOwner !== watchOwner) {
      sendJson(response, 404, { error: `Unknown mock batch job "${jobId}".` });
    } else {
      sendJson(response, 200, context.batches.responseFor(job));
    }
    return true;
  }
  return false;
};
