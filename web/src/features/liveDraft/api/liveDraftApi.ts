import {
  requestPlatformJson,
  type PlatformFetch,
} from "../../../shared/api/http/requestPlatformJson";
import {
  liveDraftEventsResponseSchema,
  liveDraftExportSchema,
  liveDraftRoomResponseSchema,
} from "./liveDraftSchemas";

interface LiveDraftRequestOptions {
  readonly fetcher?: PlatformFetch;
  readonly signal?: AbortSignal;
}

interface MutationBase extends LiveDraftRequestOptions {
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly roomId: string;
}

export type LiveDraftMutation =
  | (MutationBase & { readonly action: "start" | "pause" | "resume" | "reopen" | "undo" })
  | (MutationBase & { readonly action: "sales"; readonly command: string })
  | (MutationBase & {
    readonly action: "corrections";
    readonly replacementSale: string;
    readonly saleEventId: string;
  })
  | (MutationBase & { readonly action: "end"; readonly allowIncomplete?: boolean });

const fetcherOption = (fetcher: PlatformFetch | undefined) =>
  fetcher === undefined ? {} : { fetcher };

const requestInit = (options: LiveDraftRequestOptions): RequestInit =>
  options.signal === undefined ? {} : { signal: options.signal };

const mutationBody = (input: LiveDraftMutation): Record<string, unknown> => {
  const concurrency = {
    expectedRevision: input.expectedRevision,
    idempotencyKey: input.idempotencyKey,
  };
  switch (input.action) {
    case "start":
    case "pause":
    case "resume":
    case "reopen":
    case "undo":
      return concurrency;
    case "sales":
      return { ...concurrency, command: input.command };
    case "corrections":
      return {
        ...concurrency,
        saleEventId: input.saleEventId,
        replacementSale: input.replacementSale,
      };
    case "end":
      return input.allowIncomplete === undefined
        ? concurrency
        : { ...concurrency, allowIncomplete: input.allowIncomplete };
  }
};

export const getLiveDraftRoom = async (
  roomId: string,
  viewedTeamId: string | undefined,
  options: LiveDraftRequestOptions = {},
) => {
  const query = viewedTeamId === undefined
    ? ""
    : `?viewedTeamId=${encodeURIComponent(viewedTeamId)}`;
  const response = await requestPlatformJson({
    path: `/live-rooms/${encodeURIComponent(roomId)}${query}`,
    responseSchema: liveDraftRoomResponseSchema,
    init: requestInit(options),
    ...fetcherOption(options.fetcher),
  });
  return response.room;
};

export const getLiveDraftEvents = async (
  roomId: string,
  afterRevision: number,
  options: LiveDraftRequestOptions = {},
) => {
  const response = await requestPlatformJson({
    path: `/live-rooms/${encodeURIComponent(roomId)}/events?afterRevision=${String(afterRevision)}`,
    responseSchema: liveDraftEventsResponseSchema,
    init: requestInit(options),
    ...fetcherOption(options.fetcher),
  });
  return response.events;
};

export const mutateLiveDraftRoom = async (input: LiveDraftMutation) => {
  const response = await requestPlatformJson({
    path: `/live-rooms/${encodeURIComponent(input.roomId)}/${input.action}`,
    responseSchema: liveDraftRoomResponseSchema,
    init: {
      ...requestInit(input),
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mutationBody(input)),
    },
    ...fetcherOption(input.fetcher),
  });
  return response.room;
};

export const createLiveDraftExport = async (
  roomId: string,
  exportedAt: string,
  options: LiveDraftRequestOptions = {},
) => await requestPlatformJson({
  path: `/live-rooms/${encodeURIComponent(roomId)}/export-artifacts`,
  responseSchema: liveDraftExportSchema,
  init: {
    ...requestInit(options),
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ exportedAt }),
  },
  ...fetcherOption(options.fetcher),
});
