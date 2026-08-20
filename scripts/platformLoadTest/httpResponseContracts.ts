import type { LoadMeasurement } from "./metrics.js";

export interface AuthenticatedLoadRequest {
  readonly body?: unknown;
  readonly jobId?: string | undefined;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly responseKind: "job" | "live-room-mutation" | "player-news" | "season-simulation";
  readonly roomId?: string | undefined;
  readonly sessionToken: string;
}

export interface QueuedLoadJob {
  readonly jobId: string;
  readonly sessionToken: string;
}

export interface AuthenticatedLoadResult extends LoadMeasurement {
  readonly jobStatus?: "canceled" | "completed" | "failed" | "queued" | "running" | undefined;
  readonly queuedJob?: QueuedLoadJob | undefined;
  readonly roomRevision?: number | undefined;
}

interface ValidatedResponse {
  readonly diagnostic: string;
  readonly jobStatus?: AuthenticatedLoadResult["jobStatus"];
  readonly queuedJob?: QueuedLoadJob | undefined;
  readonly roomRevision?: number | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPlayerNews = (value: unknown): boolean => {
  if (!isRecord(value) || !isRecord(value.summary)) return false;
  const summary = value.summary;
  const counts = ["totalCount", "filteredCount", "moveUpCount", "watchCount", "fadeCount", "noChangeCount"];
  return (value.sourceMode === "all" || value.sourceMode === "local" || value.sourceMode === "rotowire-rss")
    && typeof value.generatedAt === "string"
    && Array.isArray(value.providers)
    && Array.isArray(value.items)
    && counts.every(key => Number.isInteger(summary[key]) && Number(summary[key]) >= 0);
};

const expectedStatuses: Readonly<Record<AuthenticatedLoadRequest["responseKind"], readonly number[]>> = {
  job: [200],
  "live-room-mutation": [200],
  "player-news": [200],
  "season-simulation": [200, 202],
};

export const responseContractFor = async (
  response: Response,
  request: AuthenticatedLoadRequest,
): Promise<ValidatedResponse> => {
  if (!expectedStatuses[request.responseKind].includes(response.status)) {
    await response.arrayBuffer();
    return { diagnostic: `http_${String(response.status)}` };
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    await response.arrayBuffer();
    return { diagnostic: "unexpected_content_type" };
  }
  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    return { diagnostic: "invalid_json" };
  }
  if (request.responseKind === "player-news") {
    return { diagnostic: isPlayerNews(body) ? "ok" : "invalid_player_news" };
  }
  if (request.responseKind === "season-simulation" && isRecord(body)) {
    if (response.status === 200 && typeof body.historyId === "string" && isRecord(body.summary)) {
      return { diagnostic: "ok_synchronous" };
    }
    if (
      response.status === 202 && body.status === "queued" &&
      typeof body.historyId === "string" && typeof body.jobId === "string"
    ) {
      return {
        diagnostic: "ok_queued",
        queuedJob: { jobId: body.jobId, sessionToken: request.sessionToken },
      };
    }
    return { diagnostic: "invalid_simulation_response" };
  }
  if (request.responseKind === "live-room-mutation" && isRecord(body) && isRecord(body.room)) {
    if (
      body.room.roomId === request.roomId &&
      Number.isSafeInteger(body.room.revision) && Number(body.room.revision) > 0
    ) {
      return { diagnostic: "ok", roomRevision: Number(body.room.revision) };
    }
    return { diagnostic: "invalid_live_room_response" };
  }
  if (request.responseKind === "job" && isRecord(body) && isRecord(body.job)) {
    const status = body.job.status;
    if (
      body.job.id === request.jobId &&
      (status === "queued" || status === "running" || status === "completed" ||
        status === "failed" || status === "canceled")
    ) {
      return { diagnostic: "ok", jobStatus: status };
    }
    return { diagnostic: "invalid_job_response" };
  }
  return { diagnostic: "unsupported_response_contract" };
};
