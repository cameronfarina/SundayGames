import { z } from "zod";
import type { PlatformFetch } from "../../../../../shared/api/http/requestPlatformJson";
import {
  league,
  player,
  simulationRunFixture,
  simulationSummaryFixture,
  target,
} from "./practiceFixtures";

export { simulationSummaryFixture } from "./practiceFixtures";

interface PracticeFetchOptions {
  readonly catalogEmpty?: boolean;
  readonly catalogError?: boolean;
  readonly contextError?: boolean;
  readonly detailError?: boolean;
  readonly hasLeague?: boolean;
  readonly historyError?: boolean;
  readonly runCount?: number;
  readonly runDetailError?: boolean;
  readonly targetError?: boolean;
  readonly teamClaimed?: boolean;
}

const bodySchema = z.object({
  maxBid: z.number().optional(),
  playerName: z.string(),
  position: z.string().optional(),
});

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

export const createPracticeFetch = (options: PracticeFetchOptions = {}): PlatformFetch => {
  let shortlist = options.hasLeague === false ? [] : [target];
  let catalogFailures = options.catalogError === true ? 1 : 0;
  let contextFailures = options.contextError === true ? 1 : 0;
  let historyFailures = options.historyError === true ? 1 : 0;
  const simulationSummary = {
    ...simulationSummaryFixture,
    completedCount: options.runCount ?? simulationSummaryFixture.completedCount,
    runCount: options.runCount ?? simulationSummaryFixture.runCount,
  };
  return async (input, init) => {
    const requestUrl = input instanceof Request
      ? input.url
      : input instanceof URL ? input.href : input;
    const url = new URL(requestUrl, "http://mockd.test");
    const method = init?.method ?? "GET";
    if (url.pathname === "/onboarding") {
      if (contextFailures > 0) {
        contextFailures -= 1;
        return response({ error: { code: "unavailable", message: "Try again." } }, 503);
      }
      return response({
        account: { email: "user@example.com", id: "user-1" },
        leagues: options.hasLeague === false ? [] : [league(options.teamClaimed !== false)],
      });
    }
    if (url.pathname === "/player-catalog") {
      if (catalogFailures > 0) {
        catalogFailures -= 1;
        return response({ error: { code: "catalog_unavailable", message: "Catalog unavailable." } }, 503);
      }
      return response({
        draftFormat: "auction",
        personalized: url.searchParams.has("seasonId"),
        players: options.catalogEmpty === true ? [] : [player],
        strategyLabel: url.searchParams.get("strategy") ?? "balanced",
      });
    }
    if (url.pathname === "/practice-shortlist" && method === "GET") return response({ items: shortlist });
    if (url.pathname === "/practice-shortlist") {
      if (options.targetError === true && method === "PUT") {
        return response({ error: { code: "target_failed", message: "Target could not be saved." } }, 422);
      }
      const request = new Request(url, init);
      const submitted: unknown = await request.json();
      const parsed = bodySchema.parse(submitted);
      if (method === "DELETE") {
        shortlist = shortlist.filter(item => item.playerName !== parsed.playerName);
        return response({ removed: true });
      }
      const item = {
        ...target,
        ...(parsed.maxBid === undefined ? {} : { maxBid: parsed.maxBid }),
        playerName: parsed.playerName,
        position: parsed.position ?? "WR",
      };
      shortlist = [...shortlist.filter(candidate => candidate.playerName !== item.playerName), item];
      return response({ item });
    }
    if (url.pathname === "/season-simulations" && method === "GET") {
      if (historyFailures > 0) {
        historyFailures -= 1;
        return response({ error: { code: "history_unavailable", message: "History unavailable." } }, 503);
      }
      return response({ history: [{ completedAt: target.createdAt, id: "history-1", note: "Saved run", simulation: {
        completedCount: 1,
        draftFormat: "auction",
        runCount: 1,
        strategy: simulationSummary.strategy,
      } }] });
    }
    if (url.pathname === "/season-simulations" && method === "POST") {
      const result = { historyId: "history-new", note: "New run", summary: simulationSummary };
      return new Response([
        'event: progress\ndata: {"completed":1,"total":1}\n\n',
        `event: result\ndata: ${JSON.stringify(result)}\n\n`,
      ].join(""), { headers: { "content-type": "text/event-stream" }, status: 200 });
    }
    if (url.pathname === "/season-simulations/history-1" || url.pathname === "/season-simulations/history-new") {
      if (options.detailError === true) {
        return response({ error: { code: "history_failed", message: "Saved run unavailable." } }, 503);
      }
      const saved = url.pathname.endsWith("history-1");
      return response({ historyId: saved ? "history-1" : "history-new", note: saved ? "Saved run" : "New run", summary: simulationSummary });
    }
    if (/^\/season-simulations\/history-(?:1|new)\/runs\/[12]$/u.test(url.pathname)) {
      if (options.runDetailError === true) {
        return response({ error: { code: "run_failed", message: "Roster run unavailable." } }, 503);
      }
      const historyId = url.pathname.includes("history-1") ? "history-1" : "history-new";
      const runNumber = url.pathname.endsWith("/2") ? 2 : 1;
      return response({ historyId, run: { ...simulationRunFixture, label: `Run ${String(runNumber)}`, runNumber } });
    }
    return response({ error: { code: "not_found", message: "Not found." } }, 404);
  };
};
